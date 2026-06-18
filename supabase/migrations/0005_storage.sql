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
