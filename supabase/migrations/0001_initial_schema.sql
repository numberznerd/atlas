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
