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
