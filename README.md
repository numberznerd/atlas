# Atlas

**An AI junior employee for Canadian CPA firms.** Atlas captures every client
conversation, builds a searchable institutional memory (client history +
internal SOPs), surfaces follow-ups, and lets any staff member ask
natural-language questions about a client or a firm procedure — purpose-built
for Canada with data residency and CPA-confidentiality-grade compliance.

> This is the **MVP first working version** built from the PRD. It implements
> the full core loop end-to-end and the complete database schema, with a
> provider-agnostic AI layer that lights up when you add API keys.

> **Naming note:** the product is called **Atlas** here (matching the repo). The
> PRD left branding open — it's a one-line change in `src/components/brand.tsx`
> and layout metadata if you pick something else.

---

## The core loop

```
Upload / paste a meeting
        │
        ▼
 Transcription (Canada-resident)  ──►  Accounting-aware summary + action items
        │                                          │
        ▼                                          ▼
 Indexed into the firm                     Follow-up tracking
 knowledge base                                    │
        │                                          ▼
        ▼                                Human approval gate
 Ask Atlas: "anything about              (before anything leaves the firm)
 this client / our firm's process"  — with citations
```

## What's implemented

| PRD feature | Status |
|---|---|
| Email/password + magic-link auth | ✅ |
| Firm workspace (multi-tenant) + onboarding | ✅ |
| Roles & permissions (admin / member / lite) | ✅ via Postgres RLS |
| Client profiles, timeline, client brief | ✅ |
| Meeting upload (mp3/m4a/wav/mp4) to Canadian storage | ✅ |
| Transcription w/ diarization | ✅ (Deepgram adapter; manual paste fallback) |
| Accounting-aware structured summary | ✅ (LLM) |
| Action-item extraction + follow-up tracking | ✅ |
| Knowledge base: SOPs + meetings, hybrid search | ✅ (keyword always; semantic w/ embeddings) |
| RAG chat with citations + "not enough info" fallback | ✅ |
| Human approval queue + audit trail | ✅ |
| Canadian data residency, consent capture, retention, audit log | ✅ (build-time) |

Deferred per PRD §4.4 (live meeting bot, email send, PM integrations, SSO,
bilingual UI) are intentionally out of scope for v1.

## Tech stack

- **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind v4
- **Supabase** — Postgres + Auth + Storage + **pgvector** (target region: `ca-central-1`)
- **Row-Level Security** for airtight tenant isolation and RAG-with-permissions
- Provider-agnostic **AI layer**: LLM (Azure OpenAI / OpenAI-compatible),
  embeddings, and STT (Deepgram, extensible) — all optional

---

## Setup

### 1. Create a Supabase project
Create a project in the **Canada Central (`ca-central-1`)** region for data
residency. Grab the project URL and anon key from **Settings → API**.

### 2. Configure environment
```bash
cp .env.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The AI
keys are optional (see "AI configuration" below).

### 3. Apply the database schema
Using the Supabase CLI (recommended):
```bash
supabase link --project-ref <your-ref>
supabase db push          # runs supabase/migrations/*.sql in order
# optional local stack with seed data:
supabase start && supabase db reset
```
Or paste each file in `supabase/migrations/` (0001→0005) into the SQL editor,
in order. The migrations create all tables, RLS policies, search functions,
triggers, and storage buckets.

### 4. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000, click **Start free**, create your account, then set
up your firm. (If you ran the local seed, log in with `damon@brownscpa.test` /
`browns-demo-2026` to land in the pre-loaded **Browns CPA** demo workspace.)

For a guided walkthrough with realistic data, see **[docs/demo-script.md](docs/demo-script.md)**.

---

## AI configuration (optional)

Atlas runs in **manual mode** with no AI keys: paste transcripts, write
summaries by hand, and search runs keyword-only. Add providers to switch on
automation. Inference should use **regional, no-training endpoints in Canada**.

| Capability | Env vars | Notes |
|---|---|---|
| Summaries + RAG chat | `ATLAS_LLM_PROVIDER`, `ATLAS_LLM_ENDPOINT`, `ATLAS_LLM_API_KEY`, `ATLAS_LLM_MODEL` | `azure-openai` (Canada Central) or `openai` |
| Semantic / hybrid search | `ATLAS_EMBEDDING_MODEL` | must output **1536** dims (e.g. `text-embedding-3-small`) to match the pgvector column |
| Transcription | `ATLAS_STT_PROVIDER`, `ATLAS_STT_API_KEY` | `deepgram` implemented; `assemblyai` / `whisper-ca` are stubs |

> **Residency tiers** (PRD §7.3): firms can be set to *Standard* (managed STT
> under a no-training DPA, disclosed) or *Canada-only* (self-hosted Canadian STT
> for Québec / Law 25). The `whisper-ca` adapter is the extension point for the
> Canada-only pipeline.

---

## Project structure

```
atlas/
├── supabase/
│   ├── migrations/        # 0001 schema · 0002 RLS · 0003 search · 0004 triggers/RPCs · 0005 storage
│   ├── seed.sql           # Browns CPA demo: 3 clients, 2 meetings, SOP, brain-dump
│   └── config.toml
└── src/
    ├── proxy.ts           # session refresh + route protection (Next 16 "proxy")
    ├── app/
    │   ├── page.tsx                  # landing
    │   ├── (auth)/{login,signup}     # auth
    │   ├── onboarding/               # create firm/workspace
    │   ├── auth/{callback,signout}   # auth route handlers
    │   ├── legal/{privacy,data-residency}  # compliance-kit pages
    │   └── (app)/                    # authenticated app shell
    │       ├── dashboard · clients · meetings · knowledge · chat · approvals · settings
    │       └── each feature: page.tsx + actions.ts + client components
    ├── components/        # ui/ primitives + app/ shell + shared
    └── lib/
        ├── supabase/      # browser / server / proxy clients
        ├── ai/            # provider · summary · transcription · knowledge (RAG) · indexing
        ├── types/         # typed database schema
        ├── auth.ts        # getCurrentUser / requireFirm / logAudit
        └── env.ts         # config + AI-capability flags
```

## Data model & security

- 15 tables, all tenant-scoped by `firm_id`; see `supabase/migrations/0001`.
- **RLS** restricts every read/write to the user's firm. Restricted clients are
  visible only to admins and assigned members. The `chunks` policy is the RAG
  safety boundary — retrieval physically cannot surface another firm's or a
  restricted client's data.
- **Hybrid search** (`hybrid_search`) fuses Postgres full-text and pgvector
  cosine similarity with reciprocal rank fusion; `keyword_search` is the
  no-embeddings fallback.
- **Audit log** records logins, uploads, summaries, approvals, exports, and
  deletions for PIPEDA accountability (admin-visible in Settings).

## Compliance posture (build-time, per PRD §9)

Canadian residency by design · recording-consent capture before processing ·
configurable retention with a CRA 6-year floor · no-training-on-customer-data ·
human-in-the-loop approval gate · audit trail · public privacy &
data-residency pages as the start of the sell-side compliance kit.

## Roadmap (PRD phases)

Phase 0 (auth, workspace, RLS, audit) and most of Phase 1 (capture → summary)
are built, with Phases 2–3 (knowledge/chat, trust gate) functional. Next:
real STT/LLM keys, the `whisper-ca` Canada-only adapter, persisted chat
sessions, PDF/DOCX text extraction for SOP upload, and the v1.1 items (live
recorder, email integration, bilingual, SSO).
