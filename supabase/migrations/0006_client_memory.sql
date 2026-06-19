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
