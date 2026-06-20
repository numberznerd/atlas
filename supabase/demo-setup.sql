-- =============================================================================
-- Atlas — one-shot demo setup (generated).
-- Paste this ENTIRE file into the Supabase SQL editor and click Run.
-- It creates the schema, security, search functions, storage, and the
-- Browns CPA demo data. Safe to re-run.
-- =============================================================================
set search_path = public, extensions;

-- ============================ migrations/0001 ============================
-- =============================================================================
-- Atlas — AI Junior Employee for Canadian CPA Firms
-- Migration 0001: Extensions, enums, and core schema
--
-- Implements the data model from PRD §8. Every tenant-scoped row carries a
-- `firm_id`; Row-Level Security (migration 0002) restricts all access to the
-- requesting user's firm. Designed for Supabase Postgres in ca-central-1.
-- =============================================================================

-- --- Extensions -------------------------------------------------------------
-- pgvector powers semantic retrieval for the knowledge base / RAG chat (§6.6).
create extension if not exists vector with schema extensions;

-- --- Enums ------------------------------------------------------------------
-- Roles & membership (PRD §5)
create type user_role        as enum ('admin', 'member', 'lite');
create type user_status      as enum ('active', 'invited', 'disabled');
create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- Residency tier drives the transcription pipeline choice (PRD §7.3)
create type residency_tier   as enum ('managed', 'canada_only');

-- Clients (PRD §6.2)
create type client_type      as enum ('individual', 'corporation', 'partnership', 'trust', 'nonprofit', 'other');

-- Meetings (PRD §6.3)
create type meeting_source   as enum ('upload', 'recorder');
create type meeting_status   as enum ('uploaded', 'transcribing', 'transcribed', 'summarizing', 'ready', 'failed');

-- Action items (PRD §6.5)
create type action_owner_type as enum ('firm', 'client');
create type action_status     as enum ('open', 'done', 'dismissed');

-- Knowledge base documents (PRD §6.6)
create type document_type     as enum ('sop', 'transcript', 'summary', 'upload');
create type document_status   as enum ('pending', 'processing', 'indexed', 'failed');

-- Chat (PRD §6.7)
create type chat_scope        as enum ('client', 'firm');
create type chat_role         as enum ('user', 'assistant', 'system');

-- Approval queue / trust gate (PRD §6.8)
create type approval_action_type as enum ('email_draft', 'client_message', 'external_task');
create type approval_status      as enum ('pending', 'approved', 'rejected');

-- =============================================================================
-- Core tenant tables
-- =============================================================================

-- Firms — the tenant boundary. retention_months defaults to 84 (7yr) to honour
-- CRA's 6-year minimum with a safety margin (PRD §9, compliance research §3.7).
create table public.firms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  residency_tier   residency_tier not null default 'managed',
  retention_months integer not null default 84 check (retention_months >= 72),
  privacy_contact  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Users — one row per member, keyed to the Supabase auth user. firm_id/role are
-- null until the user creates or is invited into a firm (see migration 0004).
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  firm_id     uuid references public.firms (id) on delete set null,
  email       text not null,
  full_name   text,
  role        user_role,
  status      user_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index users_firm_id_idx on public.users (firm_id);

-- Invitations — admin invites a teammate by email; the new auth user is
-- auto-joined to the firm on signup (migration 0004) without a service-role key.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms (id) on delete cascade,
  email       text not null,
  role        user_role not null default 'member',
  status      invitation_status not null default 'pending',
  invited_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (firm_id, email)
);
create index invitations_email_idx on public.invitations (lower(email)) where status = 'pending';

-- =============================================================================
-- Clients (PRD §6.2)
-- =============================================================================
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.firms (id) on delete cascade,
  name             text not null,
  type             client_type not null default 'individual',
  engagement_types text[] not null default '{}',           -- tax, bookkeeping, advisory, audit
  fiscal_year_end  text,                                    -- e.g. '12-31' or 'Dec 31'
  contacts         jsonb not null default '[]',             -- [{name, email, phone, role}]
  notes            text,
  -- Per-client access control (PRD §5): restricted clients are visible only to
  -- admins and explicitly assigned members.
  is_restricted    boolean not null default false,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index clients_firm_id_idx on public.clients (firm_id);

-- Explicit member↔client assignments for restricted clients.
create table public.client_assignments (
  client_id  uuid not null references public.clients (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  firm_id    uuid not null references public.firms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index client_assignments_user_idx on public.client_assignments (user_id);

-- =============================================================================
-- Meetings, transcripts, summaries (PRD §6.3 / §6.4)
-- =============================================================================
create table public.meetings (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.firms (id) on delete cascade,
  client_id        uuid references public.clients (id) on delete set null,
  title            text not null,
  occurred_at      timestamptz,
  source           meeting_source not null default 'upload',
  status           meeting_status not null default 'uploaded',
  -- Recording consent (PRD §6.3 F-3.6, compliance research §3.5): PIPEDA requires
  -- the firm to inform clients and obtain consent before collecting their audio.
  consent_recorded boolean not null default false,
  consent_note     text,
  audio_path       text,                 -- path within the Supabase Storage bucket
  duration_seconds integer,
  language         text default 'en',
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index meetings_firm_id_idx on public.meetings (firm_id);
create index meetings_client_id_idx on public.meetings (client_id);
create index meetings_occurred_at_idx on public.meetings (occurred_at desc);

-- Transcripts — speaker-diarized segments stored as jsonb:
-- [{ speaker, start_ms, end_ms, text }]
create table public.transcripts (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  firm_id     uuid not null references public.firms (id) on delete cascade,
  segments    jsonb not null default '[]',
  language    text default 'en',
  provider    text,                       -- e.g. 'deepgram', 'assemblyai', 'whisper-ca'
  word_count  integer,
  created_at  timestamptz not null default now()
);
create unique index transcripts_meeting_id_idx on public.transcripts (meeting_id);

-- Summaries — accounting-aware structured summary (PRD §6.4 F-4.1). Each section
-- entry can carry a transcript timestamp ref so the UI can jump to the source.
-- sections shape:
-- { discussion_points:[{text, ts}], decisions:[...], client_commitments:[...],
--   firm_commitments:[...], risks:[...], next_meeting:{text, ts} }
create table public.summaries (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  firm_id     uuid not null references public.firms (id) on delete cascade,
  sections    jsonb not null default '{}',
  finalized   boolean not null default false,
  model       text,
  edited_by   uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index summaries_meeting_id_idx on public.summaries (meeting_id);

-- =============================================================================
-- Action items & follow-up tracking (PRD §6.5)
-- =============================================================================
create table public.action_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  meeting_id    uuid references public.meetings (id) on delete set null,
  owner_user_id uuid references public.users (id) on delete set null,
  owner_type    action_owner_type not null default 'firm',
  description   text not null,
  due_date      date,
  status        action_status not null default 'open',
  source_ref    jsonb,                    -- { meeting_id, ts } back-link to transcript
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index action_items_firm_id_idx on public.action_items (firm_id);
create index action_items_client_id_idx on public.action_items (client_id);
create index action_items_owner_idx on public.action_items (owner_user_id) where status = 'open';
create index action_items_due_idx on public.action_items (due_date) where status = 'open';

-- =============================================================================
-- Knowledge base: documents + chunks (PRD §6.6)
-- =============================================================================
-- documents: firm SOPs (client_id null) and per-meeting artifacts.
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  meeting_id  uuid references public.meetings (id) on delete set null,
  type        document_type not null,
  title       text not null,
  file_path   text,
  mime_type   text,
  status      document_status not null default 'pending',
  uploaded_by uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index documents_firm_id_idx on public.documents (firm_id);

-- chunks: retrievable units with full-text (tsv) + semantic (embedding) vectors.
-- Embedding dimension 1536 = OpenAI/Azure text-embedding-3-small (PRD §7.1).
create table public.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  firm_id     uuid not null references public.firms (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  content     text not null,
  chunk_index integer not null default 0,
  token_count integer,
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index chunks_firm_id_idx on public.chunks (firm_id);
create index chunks_document_id_idx on public.chunks (document_id);
-- Full-text index for the keyword half of hybrid search.
create index chunks_tsv_idx on public.chunks using gin (tsv);
-- HNSW index for the semantic half (cosine distance).
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding vector_cosine_ops);

-- =============================================================================
-- Chat (PRD §6.7)
-- =============================================================================
create table public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  scope       chat_scope not null default 'firm',
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index chat_sessions_user_idx on public.chat_sessions (user_id);

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions (id) on delete cascade,
  firm_id     uuid not null references public.firms (id) on delete cascade,
  role        chat_role not null,
  content     text not null,
  citations   jsonb not null default '[]',   -- [{document_id, title, ts, snippet}]
  created_at  timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- =============================================================================
-- Approval queue — the trust gate (PRD §6.8)
-- =============================================================================
create table public.approval_queue (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms (id) on delete cascade,
  action_type        approval_action_type not null,
  draft_content      jsonb not null,           -- { subject?, body, recipient? }
  related_client_id  uuid references public.clients (id) on delete set null,
  related_meeting_id uuid references public.meetings (id) on delete set null,
  status             approval_status not null default 'pending',
  created_by         uuid references public.users (id) on delete set null,
  reviewed_by        uuid references public.users (id) on delete set null,
  reviewed_at        timestamptz,
  review_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index approval_queue_firm_idx on public.approval_queue (firm_id, status);

-- =============================================================================
-- Audit log (PRD §6.1 F-1.5, compliance research §4.5) — append-only record of
-- sensitive events: login, upload, export, approval, delete, etc.
-- =============================================================================
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid references public.firms (id) on delete set null,
  actor_user_id uuid references public.users (id) on delete set null,
  event_type    text not null,            -- e.g. 'meeting.uploaded', 'approval.approved'
  target_type   text,
  target_id     uuid,
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index audit_log_firm_idx on public.audit_log (firm_id, created_at desc);

comment on table public.firms is 'Tenant boundary. Every other tenant table FKs to this.';
comment on table public.chunks is 'RAG retrieval units; hybrid keyword (tsv) + semantic (embedding) search.';
comment on table public.approval_queue is 'Human-in-the-loop trust gate: nothing external sends without explicit approval.';
comment on table public.audit_log is 'Append-only compliance audit trail (PIPEDA accountability).';

-- ============================ migrations/0002 ============================
-- =============================================================================
-- Migration 0002: Row-Level Security
--
-- Tenant isolation is enforced at the database layer (PRD §5, §8): a user can
-- never read or write another firm's data, and restricted clients are visible
-- only to admins and assigned members. This is the "RAG with permissions"
-- pattern — retrieval physically cannot surface another client's chunks.
-- =============================================================================

-- --- Helper functions -------------------------------------------------------
-- SECURITY DEFINER so they bypass RLS when reading public.users / clients,
-- which avoids infinite recursion inside the policies that call them.

create or replace function public.current_firm_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select firm_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns user_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid();
$$;

-- True when the current user may see a given client: same firm AND
-- (client is not restricted, OR user is an admin, OR user is assigned to it).
create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.firm_id = public.current_firm_id()
      and (
        not c.is_restricted
        or public.current_user_role() = 'admin'
        or exists (
          select 1 from public.client_assignments a
          where a.client_id = c.id and a.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.current_firm_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_client_access(uuid) to authenticated;

-- --- Enable RLS on every table ----------------------------------------------
alter table public.firms              enable row level security;
alter table public.users              enable row level security;
alter table public.invitations        enable row level security;
alter table public.clients            enable row level security;
alter table public.client_assignments enable row level security;
alter table public.meetings           enable row level security;
alter table public.transcripts        enable row level security;
alter table public.summaries          enable row level security;
alter table public.action_items       enable row level security;
alter table public.documents          enable row level security;
alter table public.chunks             enable row level security;
alter table public.chat_sessions      enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.approval_queue     enable row level security;
alter table public.audit_log          enable row level security;

-- --- Table privileges -------------------------------------------------------
-- PostgREST executes logged-in requests as the `authenticated` role. It needs
-- table-level privileges; RLS (above) then filters which rows it can touch.
-- Supabase usually grants these via default privileges, but we make them
-- explicit so the schema is self-contained and portable.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============================ firms ========================================
create policy firms_select on public.firms
  for select using (id = public.current_firm_id());
create policy firms_update on public.firms
  for update using (id = public.current_firm_id() and public.current_user_role() = 'admin')
  with check (id = public.current_firm_id());
-- INSERT is performed only by the create_firm() SECURITY DEFINER RPC (0004).

-- ============================ users ========================================
-- See firm-mates, and always your own row (needed before you join a firm).
create policy users_select on public.users
  for select using (firm_id = public.current_firm_id() or id = auth.uid());
-- Update your own profile; admins may update any member in their firm.
create policy users_update on public.users
  for update using (
    id = auth.uid()
    or (firm_id = public.current_firm_id() and public.current_user_role() = 'admin')
  )
  with check (
    id = auth.uid()
    or (firm_id = public.current_firm_id() and public.current_user_role() = 'admin')
  );

-- ============================ invitations ==================================
create policy invitations_select on public.invitations
  for select using (firm_id = public.current_firm_id());
create policy invitations_write on public.invitations
  for all using (firm_id = public.current_firm_id() and public.current_user_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_user_role() = 'admin');

-- ============================ clients ======================================
create policy clients_select on public.clients
  for select using (firm_id = public.current_firm_id() and public.has_client_access(id));
create policy clients_insert on public.clients
  for insert with check (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  );
create policy clients_update on public.clients
  for update using (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
    and public.has_client_access(id)
  )
  with check (firm_id = public.current_firm_id());
create policy clients_delete on public.clients
  for delete using (
    firm_id = public.current_firm_id() and public.current_user_role() = 'admin'
  );

-- ====================== client_assignments =================================
create policy client_assignments_select on public.client_assignments
  for select using (firm_id = public.current_firm_id());
create policy client_assignments_write on public.client_assignments
  for all using (firm_id = public.current_firm_id() and public.current_user_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_user_role() = 'admin');

-- ============================ meetings =====================================
create policy meetings_select on public.meetings
  for select using (
    firm_id = public.current_firm_id()
    and (client_id is null or public.has_client_access(client_id))
  );
create policy meetings_insert on public.meetings
  for insert with check (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  );
create policy meetings_update on public.meetings
  for update using (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  )
  with check (firm_id = public.current_firm_id());
create policy meetings_delete on public.meetings
  for delete using (
    firm_id = public.current_firm_id() and public.current_user_role() = 'admin'
  );

-- ============================ transcripts ==================================
create policy transcripts_select on public.transcripts
  for select using (firm_id = public.current_firm_id());
create policy transcripts_write on public.transcripts
  for all using (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  )
  with check (firm_id = public.current_firm_id());

-- ============================ summaries ====================================
create policy summaries_select on public.summaries
  for select using (firm_id = public.current_firm_id());
create policy summaries_write on public.summaries
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ============================ action_items =================================
create policy action_items_select on public.action_items
  for select using (
    firm_id = public.current_firm_id()
    and (client_id is null or public.has_client_access(client_id))
  );
create policy action_items_write on public.action_items
  for all using (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  )
  with check (firm_id = public.current_firm_id());

-- ============================ documents ====================================
create policy documents_select on public.documents
  for select using (
    firm_id = public.current_firm_id()
    and (client_id is null or public.has_client_access(client_id))
  );
create policy documents_write on public.documents
  for all using (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  )
  with check (firm_id = public.current_firm_id());

-- ============================ chunks =======================================
-- The retrieval safety boundary: firm scope + per-client access.
create policy chunks_select on public.chunks
  for select using (
    firm_id = public.current_firm_id()
    and (client_id is null or public.has_client_access(client_id))
  );
create policy chunks_write on public.chunks
  for all using (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  )
  with check (firm_id = public.current_firm_id());

-- ============================ chat_sessions ================================
-- Chat history is private to its owner (PRD §6.7 F-7.4).
create policy chat_sessions_select on public.chat_sessions
  for select using (firm_id = public.current_firm_id() and user_id = auth.uid());
create policy chat_sessions_write on public.chat_sessions
  for all using (firm_id = public.current_firm_id() and user_id = auth.uid())
  with check (firm_id = public.current_firm_id() and user_id = auth.uid());

-- ============================ chat_messages ================================
create policy chat_messages_select on public.chat_messages
  for select using (
    firm_id = public.current_firm_id()
    and exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    firm_id = public.current_firm_id()
    and exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );

-- ============================ approval_queue ===============================
create policy approval_queue_select on public.approval_queue
  for select using (firm_id = public.current_firm_id());
create policy approval_queue_insert on public.approval_queue
  for insert with check (
    firm_id = public.current_firm_id() and public.current_user_role() in ('admin', 'member')
  );
-- Admins approve/reject; a creator may edit their own draft while it is pending.
create policy approval_queue_update on public.approval_queue
  for update using (
    firm_id = public.current_firm_id()
    and (
      public.current_user_role() = 'admin'
      or (created_by = auth.uid() and status = 'pending')
    )
  )
  with check (firm_id = public.current_firm_id());

-- ============================ audit_log ====================================
-- Admin-only read (PRD §6.1 F-1.5). Inserts happen via the log_audit_event()
-- SECURITY DEFINER RPC (0004), so no direct insert policy is granted.
create policy audit_log_select on public.audit_log
  for select using (
    firm_id = public.current_firm_id() and public.current_user_role() = 'admin'
  );

-- ============================ migrations/0003 ============================
-- =============================================================================
-- Migration 0003: Retrieval functions for the knowledge base & RAG chat
--
-- These run as SECURITY INVOKER (the default), so the chunks RLS policy from
-- 0002 applies automatically — a query can never retrieve another firm's or a
-- restricted client's chunks (PRD §6.6 F-6.3, "RAG with permissions").
--
-- Scope semantics (p_client_id):
--   * NULL  -> firm-wide scope: everything the caller can access.
--   * <id>  -> per-client scope: that client's chunks PLUS firm-wide SOPs
--              (chunks with client_id IS NULL).
-- =============================================================================

-- --- Keyword-only search (works without any AI provider configured) ---------
create or replace function public.keyword_search(
  query_text  text,
  p_client_id uuid default null,
  match_limit int  default 10
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  document_type  document_type,
  client_id      uuid,
  content        text,
  score          real
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.type,
    c.client_id,
    c.content,
    ts_rank_cd(c.tsv, websearch_to_tsquery('english', query_text))::real as score
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.tsv @@ websearch_to_tsquery('english', query_text)
    and (p_client_id is null or c.client_id = p_client_id or c.client_id is null)
  order by score desc
  limit match_limit;
$$;

-- --- Hybrid search: full-text + semantic, fused with reciprocal rank fusion --
-- RRF is the production-proven fusion for bounded corpora (PRD §6.6 F-6.2).
create or replace function public.hybrid_search(
  query_text       text,
  query_embedding  vector(1536),
  p_client_id      uuid default null,
  match_limit      int  default 10,
  full_text_weight real default 1.0,
  semantic_weight  real default 1.0,
  rrf_k            int  default 50
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  document_type  document_type,
  client_id      uuid,
  content        text,
  score          real
)
language sql stable
as $$
  with fts as (
    select
      c.id,
      row_number() over (
        order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', query_text)) desc
      ) as rank_ix
    from public.chunks c
    where c.tsv @@ websearch_to_tsquery('english', query_text)
      and (p_client_id is null or c.client_id = p_client_id or c.client_id is null)
    limit greatest(match_limit, 1) * 4
  ),
  semantic as (
    select
      c.id,
      row_number() over (order by c.embedding <=> query_embedding) as rank_ix
    from public.chunks c
    where c.embedding is not null
      and (p_client_id is null or c.client_id = p_client_id or c.client_id is null)
    order by c.embedding <=> query_embedding
    limit greatest(match_limit, 1) * 4
  )
  select
    c.id,
    c.document_id,
    d.title,
    d.type,
    c.client_id,
    c.content,
    (
      coalesce(1.0 / (rrf_k + fts.rank_ix), 0.0) * full_text_weight
      + coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
    )::real as score
  from fts
  full outer join semantic on fts.id = semantic.id
  join public.chunks c    on c.id = coalesce(fts.id, semantic.id)
  join public.documents d on d.id = c.document_id
  order by score desc
  limit match_limit;
$$;

grant execute on function public.keyword_search(text, uuid, int) to authenticated;
grant execute on function public.hybrid_search(text, vector, uuid, int, real, real, int) to authenticated;

-- ============================ migrations/0004 ============================
-- =============================================================================
-- Migration 0004: Onboarding triggers, RPCs, and updated_at maintenance
-- =============================================================================

-- --- New auth user -> public.users -----------------------------------------
-- On signup, mirror the auth user into public.users. If a pending invitation
-- matches their email, auto-join them to that firm with the invited role — no
-- service-role key required (PRD §6.1 F-1.3).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_invite public.invitations;
begin
  select * into v_invite
  from public.invitations
  where lower(email) = lower(new.email) and status = 'pending'
  order by created_at desc
  limit 1;

  if v_invite.id is not null then
    insert into public.users (id, email, full_name, firm_id, role, status)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name',
            v_invite.firm_id, v_invite.role, 'active');

    update public.invitations
    set status = 'accepted', accepted_at = now()
    where id = v_invite.id;

    insert into public.audit_log (firm_id, actor_user_id, event_type, target_type, target_id, payload)
    values (v_invite.firm_id, new.id, 'member.joined', 'user', new.id,
            jsonb_build_object('via', 'invitation', 'email', new.email));
  else
    insert into public.users (id, email, full_name, status)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'active');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Create a firm (workspace) ----------------------------------------------
-- SECURITY DEFINER so a freshly-signed-up user (no firm yet) can atomically
-- create a firm and become its admin (PRD §6.1 F-1.2).
create or replace function public.create_firm(
  p_name           text,
  p_residency_tier residency_tier default 'managed'
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_firm_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if (select firm_id from public.users where id = v_uid) is not null then
    raise exception 'You already belong to a firm';
  end if;

  insert into public.firms (name, residency_tier)
  values (p_name, p_residency_tier)
  returning id into v_firm_id;

  update public.users
  set firm_id = v_firm_id, role = 'admin', updated_at = now()
  where id = v_uid;

  insert into public.audit_log (firm_id, actor_user_id, event_type, target_type, target_id, payload)
  values (v_firm_id, v_uid, 'firm.created', 'firm', v_firm_id,
          jsonb_build_object('name', p_name, 'residency_tier', p_residency_tier));

  return v_firm_id;
end;
$$;

grant execute on function public.create_firm(text, residency_tier) to authenticated;

-- --- Audit logging RPC ------------------------------------------------------
-- App code calls this to record sensitive events. SECURITY DEFINER so it can
-- insert into the append-only audit_log without a direct insert policy.
create or replace function public.log_audit_event(
  p_event_type  text,
  p_target_type text default null,
  p_target_id   uuid default null,
  p_payload     jsonb default '{}'
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_firm uuid := public.current_firm_id();
begin
  if v_firm is null then
    return; -- no firm context yet; nothing to log against
  end if;

  insert into public.audit_log (firm_id, actor_user_id, event_type, target_type, target_id, payload)
  values (v_firm, v_uid, p_event_type, p_target_type, p_target_id, coalesce(p_payload, '{}'));
end;
$$;

grant execute on function public.log_audit_event(text, text, uuid, jsonb) to authenticated;

-- --- updated_at maintenance -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.firms
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.summaries
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.action_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.chat_sessions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.approval_queue
  for each row execute function public.set_updated_at();

-- ============================ migrations/0005 ============================
-- =============================================================================
-- Migration 0005: Storage buckets & policies
--
-- Two private buckets. Objects are namespaced by firm: the first path segment
-- is the firm_id, e.g.  <firm_id>/<meeting_id>/audio.m4a. Policies enforce that
-- a user can only touch objects under their own firm's prefix.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('meeting-audio', 'meeting-audio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Helper: the firm folder for an object is its first path segment.
-- (storage.foldername(name))[1] = '<firm_id>'

-- --- meeting-audio ----------------------------------------------------------
create policy "meeting_audio_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-audio'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
  );

create policy "meeting_audio_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-audio'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.current_user_role() in ('admin', 'member')
  );

create policy "meeting_audio_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meeting-audio'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.current_user_role() in ('admin', 'member')
  );

-- --- documents (firm SOPs and uploads) --------------------------------------
create policy "documents_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
  );

create policy "documents_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.current_user_role() in ('admin', 'member')
  );

create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.current_user_role() in ('admin', 'member')
  );

-- ============================ migrations/0006 ============================
-- =============================================================================
-- Migration 0006: Client memory (rolling AI brief)
--
-- Atlas is a voice-first AI employee, not a static doc store: every processed
-- conversation should make it understand the client better. The AI brief is the
-- visible proof of that learning — a rolling, regenerated summary of who the
-- client is, their history, open items, and risks. Kept separate from the
-- manually-authored `notes` so we never overwrite what a human typed.
-- =============================================================================

alter table public.clients
  add column if not exists ai_brief text,
  add column if not exists ai_brief_updated_at timestamptz;

comment on column public.clients.ai_brief is
  'Atlas-maintained rolling brief, regenerated as conversations are processed.';

-- ============================ seed (Browns CPA demo) ============================
-- =============================================================================
-- Atlas — Browns CPA demo dataset (fictional, but realistic)
--
-- Run by `supabase db reset`, or paste into the SQL editor of a fresh project.
-- Creates Browns CPA Professional Corporation (the practice using Atlas, run by
-- Damon Karjala) with three fictional clients, two processed meetings (transcript
-- + accounting-aware summary + action items), one firm SOP, one partner
-- brain-dump, and pre-built "Atlas memory" briefs — so you can ask Atlas
-- questions about clients and procedures the moment you log in.
--
-- Themes: GST/HST · bookkeeping cleanup · year-end prep · payroll/source
-- deductions · missing documents · client follow-ups.
--
-- Chunks are seeded WITHOUT embeddings; keyword search works immediately, and
-- the full-text half of hybrid search surfaces them too. All data is fictional.
-- =============================================================================

-- Make the demo idempotent: clear any prior seed of this firm, then reload.
delete from public.firms where id = 'b1111111-1111-1111-1111-111111111111';

-- --------------------------------------------------------------------------
-- Firm
-- --------------------------------------------------------------------------
insert into public.firms (id, name, residency_tier, retention_months, privacy_contact)
values ('b1111111-1111-1111-1111-111111111111', 'Browns CPA Professional Corporation',
        'managed', 84, 'privacy@brownscpa.example');

-- --------------------------------------------------------------------------
-- Clients
-- --------------------------------------------------------------------------
insert into public.clients (id, firm_id, name, type, engagement_types, fiscal_year_end, contacts, notes, ai_brief, ai_brief_updated_at)
values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'Northwind Landscaping Ltd.', 'corporation',
   array['bookkeeping','tax','payroll','advisory'], '12-31',
   $j$[{"name":"Rob Mackenzie","email":"rob@northwind.example","role":"Owner"},{"name":"Linda Mackenzie","email":"linda@northwind.example","role":"Bookkeeping (informal)"}]$j$::jsonb,
   $n$Owner Rob is hopeless with paperwork but well-meaning. Company credit card is used for personal spend constantly.$n$,
   $b$Northwind Landscaping Ltd. is an owner-managed landscaping corporation (Dec 31 year-end) run by Rob Mackenzie, with his wife Linda helping informally on the books. Revenue is highly seasonal (busy May–September, quiet in winter), which is when compliance tends to slip. Currently two GST/HST quarters behind, with CRA interest accruing, and has remitted payroll source deductions late twice — moving to pre-authorized debit to stop further penalties. QuickBooks Online has been unreconciled since last August, with personal and business spending mixed on the company card; a bookkeeping cleanup to December 31 is underway. Outstanding from the client: August–October bank statements and the F-350 truck purchase invoice (overdue). Rob is price-sensitive — frame work around avoiding CRA penalties — and is considering selling the business in about five years, so begin tidying the balance sheet now.$b$,
   now()),
  ('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'Birchwood Consulting Inc.', 'corporation',
   array['tax','advisory','bookkeeping'], '12-31',
   $j$[{"name":"Aisha Patel","email":"aisha@birchwood.example","role":"Owner"}]$j$::jsonb,
   null,
   $b$Birchwood Consulting Inc. is a tidy owner-managed consulting corporation (Dec 31 year-end) run by Aisha Patel. Books are well maintained; GST/HST is filed quarterly and current (watch for a possible instalment requirement next year as revenue grows). For 2026 the plan is a salary of about $90,000 plus dividends to top up draws while preserving RRSP room, with the integration documented. A shareholder loan drawn in the spring has been confirmed repaid. Outstanding from the client: the invoice for a newly purchased laptop (to be capitalized). Year-end close is planned for December.$b$,
   now()),
  ('c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'Daniel Okafor', 'individual',
   array['tax','bookkeeping'], '12-31',
   $j$[{"name":"Daniel Okafor","email":"daniel@okafordesign.example","role":"Client"}]$j$::jsonb,
   $n$Freelance graphic designer (sole proprietor), T1 with self-employment income. Chronically slow to send receipts. Approaching the $30,000 small-supplier threshold — GST/HST registration question is open. Waiting on 2025 expense receipts and home-office details.$n$,
   null, null);

-- --------------------------------------------------------------------------
-- Meetings (status 'ready' = fully processed)
-- --------------------------------------------------------------------------
insert into public.meetings (id, firm_id, client_id, title, occurred_at, source, status, consent_recorded, consent_note, language)
values
  ('aa111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'c1111111-1111-1111-1111-111111111111', 'Northwind — mid-year cleanup & HST catch-up',
   now() - interval '9 days', 'upload', 'ready', true,
   $c$Verbal consent to record obtained at start of call; AI note-taking disclosed.$c$, 'en'),
  ('aa222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'c2222222-2222-2222-2222-222222222222', 'Birchwood — year-end planning & remuneration',
   now() - interval '4 days', 'upload', 'ready', true,
   $c$Verbal consent to record obtained at start of call; AI note-taking disclosed.$c$, 'en');

-- --------------------------------------------------------------------------
-- Transcripts (speaker-labelled segments)
-- --------------------------------------------------------------------------
insert into public.transcripts (meeting_id, firm_id, segments, language, provider, word_count)
values
('aa111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
$seg$[
{"speaker":"Damon","start_ms":0,"end_ms":12000,"text":"Thanks for coming in, Rob. Before we get into year-end, I want to talk about where things stand with the bookkeeping and the HST, because a few things have slipped."},
{"speaker":"Rob","start_ms":12000,"end_ms":24000,"text":"Yeah, I know. Summer was nuts. We had three crews running flat out and I just didn't keep up with the paperwork."},
{"speaker":"Damon","start_ms":24000,"end_ms":39000,"text":"That's the thing — your GST/HST is two quarters behind. The returns from last fall haven't been filed, and CRA is already charging interest on what's owed."},
{"speaker":"Rob","start_ms":39000,"end_ms":45000,"text":"Oof. How bad is it?"},
{"speaker":"Damon","start_ms":45000,"end_ms":62000,"text":"Manageable if we move now. We'll file the overdue returns oldest first. I'll need the sales numbers and the expense records for those periods so I can calculate the net tax and your input tax credits."},
{"speaker":"Rob","start_ms":62000,"end_ms":68000,"text":"The bank stuff should all be in QuickBooks."},
{"speaker":"Damon","start_ms":68000,"end_ms":88000,"text":"That's the other issue. The bank feed hasn't been reconciled since the start of August. There are a few hundred uncategorized transactions, and I'm seeing personal charges mixed in on the company card — looks like a family trip in July and some grocery runs."},
{"speaker":"Rob","start_ms":88000,"end_ms":98000,"text":"Yeah, Linda and I use that card for everything. I'll be honest, we're not great at separating it."},
{"speaker":"Damon","start_ms":98000,"end_ms":115000,"text":"We'll sort it out, but it means we need a proper cleanup before we can even start the year-end. I'd propose a bookkeeping cleanup engagement to get the books reconciled and accurate to December 31."},
{"speaker":"Rob","start_ms":115000,"end_ms":122000,"text":"Whatever it costs, I don't want another mess with CRA."},
{"speaker":"Damon","start_ms":122000,"end_ms":140000,"text":"Speaking of which — your source deductions. You remitted late in August and again in October. If that keeps happening the penalty jumps to ten percent. I want to get you on pre-authorized debit so the payroll remittances go out automatically and on time."},
{"speaker":"Rob","start_ms":140000,"end_ms":145000,"text":"That's fine, set it up."},
{"speaker":"Damon","start_ms":145000,"end_ms":162000,"text":"I also don't have your August, September, and October bank statements, and I need the purchase invoice for the new truck — the F-350 — so we can capitalize it properly and claim the right CCA."},
{"speaker":"Rob","start_ms":162000,"end_ms":170000,"text":"I'll dig those up this week. The truck invoice is from the dealership, I can get a copy."},
{"speaker":"Damon","start_ms":170000,"end_ms":188000,"text":"Perfect. If you get me the statements and the truck invoice by the end of next week, we'll file the HST and start the cleanup, then book the year-end once the books are clean."},
{"speaker":"Rob","start_ms":188000,"end_ms":200000,"text":"Sounds good. And hey — I'm thinking about selling the business in maybe five years. Anything we should be doing now?"},
{"speaker":"Damon","start_ms":200000,"end_ms":216000,"text":"Good question. Let's start tidying the balance sheet and tracking everything properly — clean books are worth real money at sale. We'll dig into it at year-end."}
]$seg$::jsonb, 'en', 'demo-seed', 360),
('aa222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
$seg$[
{"speaker":"Damon","start_ms":0,"end_ms":10000,"text":"Aisha, your books are in good shape this year, so let's focus on year-end planning and your remuneration."},
{"speaker":"Aisha","start_ms":10000,"end_ms":18000,"text":"Great. I mainly want to make sure I'm putting enough into my RRSP."},
{"speaker":"Damon","start_ms":18000,"end_ms":34000,"text":"Right — to create RRSP room you need salary, not just dividends. Based on your numbers I'd suggest a salary of around ninety thousand, then top up with dividends for whatever else you need to draw."},
{"speaker":"Aisha","start_ms":34000,"end_ms":40000,"text":"That works. What about CPP?"},
{"speaker":"Damon","start_ms":40000,"end_ms":55000,"text":"Salary means CPP contributions on both sides, but it also builds your RRSP room and future CPP. I'll document the integration so you can see the trade-off clearly."},
{"speaker":"Aisha","start_ms":55000,"end_ms":60000,"text":"Okay. And HST — I think I'm all caught up?"},
{"speaker":"Damon","start_ms":60000,"end_ms":74000,"text":"You are — you file quarterly and everything's current. One heads-up: CRA may ask for instalments next year given your growth. I'll flag it now so it isn't a surprise."},
{"speaker":"Aisha","start_ms":74000,"end_ms":80000,"text":"Good. Anything you need from me to close the year?"},
{"speaker":"Damon","start_ms":80000,"end_ms":96000,"text":"A couple of things to get ahead of the December year-end — send me the invoice for the new laptop so we capitalize it, and can you confirm the shareholder loan you drew in the spring was repaid?"},
{"speaker":"Aisha","start_ms":96000,"end_ms":106000,"text":"The loan's repaid, yes. I'll send the laptop invoice this week."},
{"speaker":"Damon","start_ms":106000,"end_ms":120000,"text":"Perfect. I'll prepare your remuneration calculation now so payroll is set for the year, and we'll line up the year-end close for December."}
]$seg$::jsonb, 'en', 'demo-seed', 250);

-- --------------------------------------------------------------------------
-- Summaries (accounting-aware structured sections, with transcript ts links)
-- --------------------------------------------------------------------------
insert into public.summaries (meeting_id, firm_id, sections, finalized, model)
values
('aa111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
$sec${
 "discussion_points":[
   {"text":"GST/HST is two quarters behind; returns from last fall unfiled and CRA interest accruing.","ts":24},
   {"text":"QuickBooks Online unreconciled since August; personal and business spending mixed on the company card.","ts":68},
   {"text":"Payroll source deductions remitted late in August and October.","ts":122},
   {"text":"New F-350 truck to be capitalized for CCA.","ts":145},
   {"text":"Owner considering selling the business in about five years.","ts":188}
 ],
 "decisions":[
   {"text":"File the overdue GST/HST returns, oldest period first.","ts":45},
   {"text":"Proceed with a bookkeeping cleanup engagement to December 31.","ts":98},
   {"text":"Set up pre-authorized debit for payroll source deductions.","ts":122}
 ],
 "client_commitments":[
   {"text":"Rob to send August–October bank statements and the F-350 truck purchase invoice by end of next week.","ts":145}
 ],
 "firm_commitments":[
   {"text":"File the two overdue GST/HST returns once records are received.","ts":45},
   {"text":"Perform bookkeeping cleanup to December 31.","ts":98},
   {"text":"Set Northwind up on pre-authorized debit for source deductions.","ts":122}
 ],
 "risks":[
   {"text":"Overdue HST returns — interest and penalties accruing.","ts":24},
   {"text":"Repeated late source-deduction remittances risk the 10% penalty tier.","ts":122},
   {"text":"Personal expenses on the company card must be identified and removed.","ts":68}
 ],
 "next_meeting":{"text":"Year-end meeting once the books are cleaned up.","ts":170}
}$sec$::jsonb, true, 'demo-seed'),
('aa222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
$sec${
 "discussion_points":[
   {"text":"Year-end planning and owner remuneration.","ts":0},
   {"text":"Creating RRSP room requires salary, not just dividends.","ts":18},
   {"text":"GST/HST filed quarterly and currently up to date.","ts":60}
 ],
 "decisions":[
   {"text":"Pay a salary of about $90,000 plus dividends to top up draws.","ts":18},
   {"text":"Document the salary/dividend integration and CPP trade-off.","ts":40}
 ],
 "client_commitments":[
   {"text":"Aisha to send the new laptop invoice this week; confirmed the spring shareholder loan is repaid.","ts":80}
 ],
 "firm_commitments":[
   {"text":"Prepare the 2026 remuneration calculation so payroll is set for the year.","ts":106},
   {"text":"Flag a possible GST/HST instalment requirement for next year.","ts":60}
 ],
 "risks":[
   {"text":"CRA may require GST/HST instalments next year as revenue grows.","ts":60}
 ],
 "next_meeting":{"text":"Year-end close in December.","ts":106}
}$sec$::jsonb, true, 'demo-seed');

-- --------------------------------------------------------------------------
-- Action items (the follow-up list; mix of firm/client owners, some overdue)
-- --------------------------------------------------------------------------
insert into public.action_items (firm_id, client_id, meeting_id, owner_type, description, due_date, status, source_ref)
values
-- Northwind
('b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','aa111111-1111-1111-1111-111111111111',
 'client','Send August–October bank statements and the F-350 truck purchase invoice', current_date - 2, 'open',
 $r${"meeting_id":"aa111111-1111-1111-1111-111111111111","ts":145}$r$::jsonb),
('b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','aa111111-1111-1111-1111-111111111111',
 'firm','File the two overdue GST/HST returns (oldest period first)', current_date + 5, 'open',
 $r${"meeting_id":"aa111111-1111-1111-1111-111111111111","ts":45}$r$::jsonb),
('b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','aa111111-1111-1111-1111-111111111111',
 'firm','Perform bookkeeping cleanup to December 31 in QuickBooks Online', current_date + 21, 'open',
 $r${"meeting_id":"aa111111-1111-1111-1111-111111111111","ts":98}$r$::jsonb),
('b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','aa111111-1111-1111-1111-111111111111',
 'firm','Set up pre-authorized debit for payroll source deductions', current_date + 7, 'open',
 $r${"meeting_id":"aa111111-1111-1111-1111-111111111111","ts":122}$r$::jsonb),
-- Birchwood
('b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222','aa222222-2222-2222-2222-222222222222',
 'client','Send the new laptop invoice for capitalization', current_date + 5, 'open',
 $r${"meeting_id":"aa222222-2222-2222-2222-222222222222","ts":80}$r$::jsonb),
('b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222','aa222222-2222-2222-2222-222222222222',
 'firm','Prepare 2026 remuneration calculation (≈$90k salary + dividends)', current_date + 10, 'open',
 $r${"meeting_id":"aa222222-2222-2222-2222-222222222222","ts":106}$r$::jsonb),
('b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222','aa222222-2222-2222-2222-222222222222',
 'firm','Flag potential GST/HST instalment requirement for next year', current_date + 25, 'open',
 $r${"meeting_id":"aa222222-2222-2222-2222-222222222222","ts":60}$r$::jsonb),
-- Daniel
('b1111111-1111-1111-1111-111111111111','c3333333-3333-3333-3333-333333333333', null,
 'client','Send 2025 expense receipts and home-office details (outstanding ~3 weeks)', current_date - 5, 'open', null),
('b1111111-1111-1111-1111-111111111111','c3333333-3333-3333-3333-333333333333', null,
 'firm','Advise on GST/HST registration once 2025 revenue is confirmed (near $30k threshold)', current_date + 14, 'open', null);

-- --------------------------------------------------------------------------
-- Knowledge base documents + chunks (SOP, brain-dump, transcripts, summaries)
-- Idempotent: clear these doc ids' chunks first, then (re)insert.
-- --------------------------------------------------------------------------
delete from public.chunks where document_id in (
  'd1111111-1111-1111-1111-111111111111','d2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333','d4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555','d6666666-6666-6666-6666-666666666666',
  'd7777777-7777-7777-7777-777777777777');

insert into public.documents (id, firm_id, client_id, meeting_id, type, title, status)
values
  ('d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111', null, null,
   'sop','SOP — Year-End Preparation for Owner-Managed Corporations (T2)','indexed'),
  ('d2222222-2222-2222-2222-222222222222','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111', null,
   'upload','Partner brain-dump — Northwind Landscaping (Damon)','indexed'),
  ('d3333333-3333-3333-3333-333333333333','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','aa111111-1111-1111-1111-111111111111',
   'transcript','Transcript — Northwind mid-year cleanup & HST catch-up','indexed'),
  ('d4444444-4444-4444-4444-444444444444','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','aa111111-1111-1111-1111-111111111111',
   'summary','Summary — Northwind mid-year cleanup & HST catch-up','indexed'),
  ('d5555555-5555-5555-5555-555555555555','b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222','aa222222-2222-2222-2222-222222222222',
   'transcript','Transcript — Birchwood year-end planning & remuneration','indexed'),
  ('d6666666-6666-6666-6666-666666666666','b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222','aa222222-2222-2222-2222-222222222222',
   'summary','Summary — Birchwood year-end planning & remuneration','indexed'),
  ('d7777777-7777-7777-7777-777777777777','b1111111-1111-1111-1111-111111111111','c3333333-3333-3333-3333-333333333333', null,
   'upload','Client note — Daniel Okafor','indexed')
on conflict (id) do nothing;

insert into public.chunks (document_id, firm_id, client_id, content, chunk_index) values
-- SOP (firm-wide, client_id null)
('d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111', null,
$ck$Year-End Preparation SOP for owner-managed corporations (T2). 1) Document request and kickoff: at year-end we send the standard prepared-by-client (PBC) list — bank and credit-card statements for every month, GST/HST returns and filing confirmations, payroll records with T4/T4A summaries, loan statements, invoices for major capital purchases, shareholder-loan details, and the prior-year working papers. Give the client three weeks and chase missing items weekly until complete.$ck$, 0),
('d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111', null,
$ck$Year-End SOP, GST/HST reconciliation: reconcile filed GST/HST to the books — net tax per the returns versus GST/HST collected less input tax credits in the general ledger. Flag any unfiled or late periods; CRA charges interest and penalties. For catch-up, file outstanding returns oldest period first and confirm the filing frequency on file with CRA (annual vs quarterly) matches the client's actual sales.$ck$, 1),
('d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111', null,
$ck$Year-End SOP, payroll and source deductions: reconcile the T4 box totals to general-ledger wages and to the PD7A remittances. Confirm CPP, EI, and income tax were remitted on time — late remittances trigger a penalty of 3% to 10% depending on lateness. Verify the remitter frequency and that the December remittance is captured. Where a client is repeatedly late, move them to pre-authorized debit.$ck$, 2),
('d1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111', null,
$ck$Year-End SOP, owner-manager remuneration and close: decide salary versus dividends with the client before year-end — salary creates RRSP room and CPP, dividends do not; document the integration. Record shareholder-loan movements and ensure any draw is repaid within one year of year-end to avoid a subsection 15(2) income inclusion. Post adjusting entries, update the capital asset and CCA continuity, finalize the financial statements, prepare and file the T2 within six months of year-end, and retain working papers for the CRA six-year minimum.$ck$, 3),
-- Northwind brain-dump
('d2222222-2222-2222-2222-222222222222','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',
$ck$Partner brain-dump on Northwind Landscaping (Rob Mackenzie). Rob is a great guy but hopeless with paperwork and always behind. Cash comes in lumpy — busy May through September, dead in winter — which is exactly when he falls behind on HST and source deductions. He has had a couple of CRA late-remittance penalties already; we want him on pre-authorized debit. He mixes personal and business constantly on the company card — watch for the family trip and grocery runs. His wife Linda does some of the books but it is hit and miss. Rob is price-sensitive, so frame our work around avoiding CRA penalties, not bookkeeping for its own sake. Long term he wants to sell the business in about five years, so we should start tidying the balance sheet now so it shows well at sale.$ck$, 0),
-- Northwind transcript
('d3333333-3333-3333-3333-333333333333','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',
$ck$Northwind mid-year cleanup and HST catch-up meeting. Damon told Rob the GST/HST is two quarters behind, with last fall's returns unfiled and CRA interest accruing; the firm will file the overdue returns oldest first once sales and expense records arrive. QuickBooks Online has not been reconciled since August, with personal charges (a July family trip, groceries) mixed on the company card. Agreed to a bookkeeping cleanup engagement to December 31. Source deductions were remitted late in August and October — moving to pre-authorized debit to avoid the 10% penalty tier. Rob to provide August–October bank statements and the F-350 truck invoice for capitalization. Rob mentioned wanting to sell the business in about five years.$ck$, 0),
-- Northwind summary
('d4444444-4444-4444-4444-444444444444','b1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',
$ck$Summary — Northwind: Decisions — file overdue GST/HST returns oldest first; proceed with bookkeeping cleanup to December 31; set up pre-authorized debit for source deductions. Client to send Aug–Oct bank statements and the F-350 truck invoice. Firm to file the overdue HST returns, perform the cleanup, and arrange PAD. Risks — overdue HST interest/penalties; repeated late source deductions; personal spend on the company card. Next: year-end meeting once books are clean.$ck$, 0),
-- Birchwood transcript
('d5555555-5555-5555-5555-555555555555','b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222',
$ck$Birchwood year-end planning and remuneration meeting. Books are in good shape. Damon recommended a salary of about ninety thousand plus dividends to top up draws, because salary (not dividends) creates RRSP room; CPP applies on both sides and the integration will be documented. GST/HST is filed quarterly and current, but CRA may require instalments next year as revenue grows. Aisha confirmed the spring shareholder loan is repaid and will send the new laptop invoice for capitalization. Firm to prepare the 2026 remuneration calculation and the T2; year-end close planned for December.$ck$, 0),
-- Birchwood summary
('d6666666-6666-6666-6666-666666666666','b1111111-1111-1111-1111-111111111111','c2222222-2222-2222-2222-222222222222',
$ck$Summary — Birchwood: Decisions — pay ≈$90k salary plus dividends; document salary/dividend integration. Client to send the new laptop invoice; shareholder loan confirmed repaid. Firm to prepare 2026 remuneration calculation and flag a possible GST/HST instalment requirement next year. HST currently filed quarterly and up to date. Next: year-end close in December.$ck$, 0),
-- Daniel note
('d7777777-7777-7777-7777-777777777777','b1111111-1111-1111-1111-111111111111','c3333333-3333-3333-3333-333333333333',
$ck$Client note — Daniel Okafor: freelance graphic designer, sole proprietor, T1 with self-employment income. Chronically slow to send receipts; we are waiting on 2025 expense receipts and his home-office details. Revenue is approaching the $30,000 small-supplier threshold, so GST/HST registration is an open question — advise once 2025 revenue is confirmed.$ck$, 0);

-- --------------------------------------------------------------------------
-- Best-effort loginable demo user: Damon Karjala (managing partner)
--   damon@brownscpa.test / browns-demo-2026
-- Guarded so a GoTrue schema mismatch can't break the reset.
-- --------------------------------------------------------------------------
do $$
declare
  v_firm uuid := 'b1111111-1111-1111-1111-111111111111';
  v_uid  uuid := 'a0000000-0000-0000-0000-0000000000a1';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'damon@brownscpa.test', crypt('browns-demo-2026', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Damon Karjala"}'::jsonb, false
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'damon@brownscpa.test', 'email_verified', true),
    'email', now(), now(), now()
  )
  on conflict (provider, provider_id) do nothing;

  update public.users set firm_id = v_firm, role = 'admin', full_name = 'Damon Karjala'
  where id = v_uid;

  raise notice 'Atlas demo ready -> damon@brownscpa.test / browns-demo-2026';
exception when others then
  raise notice 'Skipped demo auth user (auth schema mismatch: %). Sign up in-app, then attach to Browns CPA (see docs/demo-script.md).', sqlerrm;
end $$;
