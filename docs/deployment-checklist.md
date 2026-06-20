# Atlas — Hosted Deployment Checklist

**For a non-technical founder.** Goal: get Atlas live on the internet (HTTPS) so
you can test it on your phone and show Damon. **Time:** ~45–60 minutes.

You'll do four things: (1) create a database in Canada (**Supabase**), (2) load
the schema + demo data, (3) put the website online (**Vercel**), (4) add your
**OpenAI** key. Then log in as Damon on your phone.

**Accounts you'll need:** GitHub (the code lives there), Supabase, Vercel, and
OpenAI (with ~$5 of credit). All have free tiers.

> Tip: do this on a laptop; test on your phone at the end.

---

## 1. Create the Supabase project (the database)

1. Go to **supabase.com** → sign in → **New project**.
2. Name it `atlas-demo`. Set a strong **database password** and save it somewhere.
3. **Region:** choose **Canada (Central)**. ⬅️ important — this is where client
   data physically lives, and it's the core of the Canadian-compliance story.
4. Click **Create new project** and wait ~2 minutes for it to finish setting up.

## 2. Confirm the Canada region

- On the project's **Settings → General**, confirm **Region = Canada (Central)**.
- ⚠️ You can't change a project's region later. If it's wrong, delete the project
  and recreate it in Canada (Central). Don't skip this — it's the whole pitch.

## 3. Load the schema and demo data

You'll paste SQL files into Supabase's SQL editor. No coding — just copy/paste.

1. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
2. From the repo, open the files in **`supabase/migrations/`** and run them **in
   order, one at a time**:
   `0001` → `0002` → `0003` → `0004` → `0005` → `0006`.
   For each: open the file on GitHub, copy all of it, paste into the editor, click
   **Run**. Wait for **Success** before the next one.
3. Then open **`supabase/seed.sql`**, copy all of it, paste, and **Run**. This
   loads Browns CPA with three clients, two meetings, an SOP, and the demo login.
   You should see a notice like *"Atlas demo ready → damon@brownscpa.test …"*.

✅ Check: SQL Editor → run `select name from public.firms;` — you should see
**Browns CPA Professional Corporation**.

## 4. Copy your Supabase keys

- Supabase → **Settings → API** (newer projects: **API Keys**).
- Copy two values (save them for step 6):
  - **Project URL** (looks like `https://abcd1234.supabase.co`)
  - **anon / public key** — in newer projects this is labelled the
    **"publishable" key**. Either name is correct; it's the public client key.
- Do **not** use the `service_role` / "secret" key in the website.

## 5. Deploy the website to Vercel

1. Go to **vercel.com** → **Add New → Project** → **Import** the GitHub repo
   `numberznerd/atlas` (authorize GitHub if asked).
2. **Set the branch to deploy:** after importing, go to **Settings → Git** and set
   the **Production Branch** to `claude/inspiring-wozniak-8z2qwk`, *or* simply
   deploy the branch as a Preview. (Otherwise Vercel builds `main`, which is empty.)
3. Framework should auto-detect as **Next.js**. **Don't click Deploy yet** — add
   the environment variables first (step 6), or the site won't connect.

## 6. Environment variables (add these BEFORE the first build)

In Vercel's import screen (or **Settings → Environment Variables**), add each of
these as Name = Value:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase **anon/publishable key** |
| `ATLAS_LLM_PROVIDER` | `openai` |
| `ATLAS_LLM_API_KEY` | your OpenAI key (step 7) |
| `ATLAS_LLM_MODEL` | `gpt-4o-mini` |
| `ATLAS_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `ATLAS_STT_PROVIDER` | `openai` |
| `ATLAS_STT_API_KEY` | the **same** OpenAI key |

Then click **Deploy**.

> ⚠️ Why "before the first build": the two `NEXT_PUBLIC_…` values get baked into
> the website when it builds. If you add them later, you must click **Redeploy**
> (Deployments → ⋯ → Redeploy) for them to take effect.

> `gpt-4o-mini` is fast and cheap and is plenty for the demo. You can switch to
> `gpt-4o` later for slightly richer summaries.

## 7. Get your OpenAI API key

1. Go to **platform.openai.com → API keys → Create new secret key**. Copy it
   (starts with `sk-`). You won't see it again, so paste it into Vercel now.
2. **Billing:** OpenAI → Settings → Billing → add ~$5 of credit. (A demo costs
   pennies; without any credit, transcription and answers will fail.)
3. Use the **same** key for both `ATLAS_LLM_API_KEY` and `ATLAS_STT_API_KEY`.

## 8. Point Supabase Auth at your live site

1. After Vercel finishes, copy your site URL (e.g.
   `https://atlas-demo-xxxx.vercel.app`).
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** paste your Vercel URL.
   - **Redirect URLs:** add your Vercel URL too.
3. *(Optional, only if you want to create brand-new accounts in the app)*
   **Authentication → Providers → Email** → turn **off "Confirm email"** for the
   demo. You don't need this if you just use the Damon login (already confirmed).

## 9. Verify recording works on your phone

1. On your phone, open the **Vercel URL** (it's HTTPS — the microphone only works
   on a secure `https://` address, which is exactly why we host it).
2. Log in as Damon (step 10) → tap **Record** in the bottom bar → **Allow** the
   microphone → record ~10 seconds → **Stop**. It should upload and open a new
   meeting.
3. If the mic is blocked, tap **Upload** and pick an audio file instead, or fix
   the browser's microphone permission and retry.

## 10. Log in as Damon

- **Email:** `damon@brownscpa.test`
- **Password:** `browns-demo-2026`

You'll land in the **Browns CPA** workspace with three clients already loaded.

## ▶️ Run the 10-minute demo

Follow **[docs/demo-script.md](demo-script.md)**: show what Atlas already knows
about Northwind → record a short call → see the summary + action items → watch
the client memory update → ask Atlas questions (with citations).

---

## Common errors & quick fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| White screen / "Missing … environment variable" | Env vars missing or added after the build | Add all vars (step 6), then **Redeploy** |
| Damon login fails | Seed didn't run, or ran on a different project | Re-run `seed.sql`; confirm Vercel's `NEXT_PUBLIC_SUPABASE_URL` matches the project you seeded |
| "Invalid login credentials" | Typo, or you're on the wrong project | Use exact creds; the seeded user is pre-confirmed (no email needed) |
| Mic doesn't work on phone | Not using the HTTPS URL, or permission denied | Open the `…vercel.app` URL (not an IP/localhost); allow the mic; or use **Upload** |
| "Invalid file format" during transcription | (Fixed in code) or wrong STT settings | Ensure `ATLAS_STT_PROVIDER=openai` and the key has credit; keep clips < 25 MB |
| Processing spins, then "failed"/timeout | Long clip + slow model | Keep demo clips short; use `gpt-4o-mini`; (Vercel **Pro** allows longer processing) |
| "permission denied for table …" | Migrations didn't all run (esp. `0002`) | Re-run migrations `0001`→`0006` in order |
| Audio upload fails | Storage buckets missing | Make sure migration **`0005`** ran |
| Vercel deployed an empty site | It built `main` instead of the feature branch | Set **Production Branch** (step 5) and redeploy |
| OpenAI errors about quota/billing | No credit on the OpenAI account | Add ~$5 credit (step 7) |

---

## A note on data residency (say this if Damon asks)

For this demo, **your client data, files, and search index live in Canada**
(Supabase `ca-central-1`). Because the demo uses **OpenAI** for transcription and
answers, that *inference* runs in the **US** — this is exactly the PRD's
"Standard tier: managed provider, disclosed." The fully **in-Canada inference**
("Canada-only") tier is a planned build, not part of this demo. Being upfront
about this is itself part of the compliance story.

*(Optional) To pin the website's compute to Montréal too: Vercel → Settings →
Functions → Region → **Montréal (yul1)**. This is cosmetic for the demo — the
data that matters is already in Canada via Supabase.)*
