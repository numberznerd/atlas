-- =============================================================================
-- Atlas — local development seed
--
-- Run automatically by `supabase db reset`. Two parts:
--   A) Reliable: a demo firm with clients, an SOP, meetings, summaries, and
--      action items (created_by left NULL so it has no auth dependency).
--   B) Best-effort: a loginable demo user (demo@atlas.test / atlas-demo-1234)
--      linked to the demo firm. Guarded so a GoTrue schema mismatch can't break
--      the reset — if it fails, just sign up normally and create your own firm.
--
-- Chunks are seeded WITHOUT embeddings, so keyword search works out of the box;
-- hybrid (semantic) search lights up once you configure an AI provider and
-- re-index. NOTE: seed data is for local dev only — never load it in prod.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Part A — demo firm + business data
-- ---------------------------------------------------------------------------
do $$
declare
  v_firm    uuid := '00000000-0000-0000-0000-0000000000f1';
  v_browns  uuid := '00000000-0000-0000-0000-0000000000c1';
  v_jane    uuid := '00000000-0000-0000-0000-0000000000c2';
  v_sop_doc uuid := '00000000-0000-0000-0000-0000000000d1';
  v_hist_doc uuid := '00000000-0000-0000-0000-0000000000d2';
  v_meeting uuid := '00000000-0000-0000-0000-0000000000e1';
begin
  -- Firm
  insert into public.firms (id, name, residency_tier, retention_months, privacy_contact)
  values (v_firm, 'Maple & Co. CPA (Demo)', 'managed', 84, 'privacy@mapleco.example')
  on conflict (id) do nothing;

  -- Clients
  insert into public.clients (id, firm_id, name, type, engagement_types, fiscal_year_end, contacts, notes)
  values
    (v_browns, v_firm, 'Browns Manufacturing Ltd.', 'corporation',
     array['tax', 'advisory', 'bookkeeping'], '12-31',
     '[{"name": "Sam Brown", "email": "sam@browns.example", "role": "Owner"}]'::jsonb,
     'Family-owned manufacturer. Pursuing SR&ED credits for shop-floor automation R&D.'),
    (v_jane, v_firm, 'Jane Doe', 'individual',
     array['tax'], '12-31',
     '[{"name": "Jane Doe", "email": "jane@example.com", "role": "Client"}]'::jsonb,
     'Personal T1 client. Rental property in BC; recurring questions on depreciation (CCA).')
  on conflict (id) do nothing;

  -- Firm-wide SOP document (client_id NULL -> visible firm-wide)
  insert into public.documents (id, firm_id, client_id, type, title, status)
  values (v_sop_doc, v_firm, null, 'sop', 'SOP — SR&ED Claim Preparation', 'indexed')
  on conflict (id) do nothing;

  insert into public.chunks (document_id, firm_id, client_id, content, chunk_index)
  values
    (v_sop_doc, v_firm, null,
     'SR&ED claim procedure: Our firm prepares Scientific Research and Experimental Development (SR&ED) claims by first confirming the work meets the three eligibility criteria — scientific or technological advancement, scientific or technological uncertainty, and systematic investigation. We collect contemporaneous documentation (project notes, time tracking, prototypes) before drafting Form T661.', 0),
    (v_sop_doc, v_firm, null,
     'SR&ED documentation standard: For each project we require a technical narrative under 1,400 words describing the uncertainty and the work performed, plus a breakdown of eligible expenditures (salaries, materials, subcontractors at 80%, and overhead via the proxy method). File the T661 with the T2 return no later than 18 months after the fiscal year-end; the deadline is strict and non-extendable.', 1)
  on conflict do nothing;

  -- Client history document for Browns (per-client knowledge)
  insert into public.documents (id, firm_id, client_id, type, title, status)
  values (v_hist_doc, v_firm, v_browns, 'upload', 'Browns — Engagement History Notes', 'indexed')
  on conflict (id) do nothing;

  insert into public.chunks (document_id, firm_id, client_id, content, chunk_index)
  values
    (v_hist_doc, v_firm, v_browns,
     'Browns Manufacturing has claimed SR&ED in each of the last three fiscal years. In FY2024 the claim was $142,000 in eligible expenditures, largely automation control software developed in-house. CRA reviewed the FY2023 claim and accepted it without adjustment after we provided the technical narratives.', 0)
  on conflict do nothing;

  -- A meeting with a finalized summary + action items for Browns
  insert into public.meetings (id, firm_id, client_id, title, occurred_at, source, status, consent_recorded, consent_note, language)
  values (v_meeting, v_firm, v_browns, 'Browns — FY2025 year-end planning',
          now() - interval '6 days', 'upload', 'ready', true,
          'Verbal consent to record obtained at start of call; disclosed AI note-taking.', 'en')
  on conflict (id) do nothing;

  insert into public.summaries (meeting_id, firm_id, sections, finalized, model)
  values (v_meeting, v_firm,
    jsonb_build_object(
      'discussion_points', jsonb_build_array(
        jsonb_build_object('text', 'Reviewed FY2025 R&D activity for SR&ED eligibility.', 'ts', 45),
        jsonb_build_object('text', 'Discussed timing of new equipment purchase before year-end.', 'ts', 320)
      ),
      'decisions', jsonb_build_array(
        jsonb_build_object('text', 'Proceed with SR&ED claim for the automation project.', 'ts', 210)
      ),
      'client_commitments', jsonb_build_array(
        jsonb_build_object('text', 'Sam to send shop-floor time-tracking logs for the R&D team.', 'ts', 260)
      ),
      'firm_commitments', jsonb_build_array(
        jsonb_build_object('text', 'Draft the T661 technical narrative for review.', 'ts', 280)
      ),
      'risks', jsonb_build_array(
        jsonb_build_object('text', 'T661 must be filed within 18 months of year-end — deadline is strict.', 'ts', 300)
      ),
      'next_meeting', jsonb_build_object('text', 'Reconvene in 3 weeks once logs are in.', 'ts', 540)
    ),
    true, 'seed')
  on conflict (meeting_id) do nothing;

  insert into public.action_items (firm_id, client_id, meeting_id, owner_type, description, due_date, status, source_ref)
  values
    (v_firm, v_browns, v_meeting, 'client', 'Send shop-floor time-tracking logs for the R&D team',
     current_date + 7, 'open', jsonb_build_object('meeting_id', v_meeting, 'ts', 260)),
    (v_firm, v_browns, v_meeting, 'firm', 'Draft T661 technical narrative for review',
     current_date + 14, 'open', jsonb_build_object('meeting_id', v_meeting, 'ts', 280))
  on conflict do nothing;

  raise notice 'Atlas seed: demo firm and business data loaded.';
end $$;

-- ---------------------------------------------------------------------------
-- Part B — best-effort loginable demo user (local dev only)
-- ---------------------------------------------------------------------------
do $$
declare
  v_firm uuid := '00000000-0000-0000-0000-0000000000f1';
  v_uid  uuid := 'a0000000-0000-0000-0000-0000000000a1';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'demo@atlas.test', crypt('atlas-demo-1234', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Admin"}'::jsonb, false
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'demo@atlas.test', 'email_verified', true),
    'email', now(), now(), now()
  )
  on conflict (provider, provider_id) do nothing;

  -- handle_new_user() created the public.users row (firm_id NULL); attach to demo firm.
  update public.users set firm_id = v_firm, role = 'admin', full_name = 'Demo Admin'
  where id = v_uid;

  raise notice 'Atlas seed: demo login ready -> demo@atlas.test / atlas-demo-1234';
exception when others then
  raise notice 'Atlas seed: skipped demo auth user (auth schema mismatch: %). Sign up normally instead.', sqlerrm;
end $$;
