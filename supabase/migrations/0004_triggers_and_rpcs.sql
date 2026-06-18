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
