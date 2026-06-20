# Atlas — Demo Script (Browns CPA / Damon)

A 10–12 minute walkthrough that proves the one sentence that matters:
**"Atlas listens, remembers, and helps like a junior employee."**

The demo data is fictional but realistic: **Browns CPA Professional Corporation**
(Damon's practice) with three clients — **Northwind Landscaping** (messy, behind
on HST and payroll), **Birchwood Consulting** (tidy, year-end planning), and
**Daniel Okafor** (sole proprietor, missing documents).

---

## 0. Setup (do this before the meeting)

### Recommended: local Supabase
```bash
cp .env.example .env.local        # fill in Supabase + the one-key OpenAI block
supabase start
supabase db reset                 # runs migrations + seeds the Browns CPA dataset
npm install && npm run dev
```
Log in as the seeded partner:
- **Email:** `damon@brownscpa.test`
- **Password:** `browns-demo-2026`

### For the AI to talk (recommended for the live demo)
Set the one-key OpenAI block in `.env.local` so transcription, summaries, and
chat all work:
```
ATLAS_LLM_PROVIDER=openai
ATLAS_LLM_API_KEY=sk-...          ATLAS_LLM_MODEL=gpt-4o
ATLAS_EMBEDDING_MODEL=text-embedding-3-small
ATLAS_STT_PROVIDER=openai         ATLAS_STT_API_KEY=sk-...   # same key
```
Without keys the demo still works in **manual mode**: seeded summaries, action
items, and client memory all display, and "Ask Atlas" returns the relevant
**cited passages** (it just won't compose a prose answer).

### Hosted Supabase instead of local
Apply `supabase/migrations/` (0001→0006), then run `supabase/seed.sql` in the
SQL editor. If the demo login doesn't take (GoTrue version differences), sign up
in-app with any email, then attach yourself to Browns CPA:
```sql
update public.users
set firm_id = 'b1111111-1111-1111-1111-111111111111', role = 'admin'
where email = 'you@example.com';
```

### Pre-flight checklist
- [ ] Logged in as Damon; dashboard shows clients, meetings, and overdue follow-ups.
- [ ] Open **Northwind Landscaping** once — confirm the **Atlas memory** card is populated.
- [ ] Mic permission granted in the browser you'll demo with.

---

## The story arc

> "A client call happens. Atlas sits in, takes the notes, extracts the
> follow-ups, updates what it knows about the client — and any of us can ask it
> questions later. The longer it works here, the more it knows."

---

## 1. Show what Atlas already knows (30 seconds)

Open **Clients → Northwind Landscaping**. Point at:
- **Atlas memory** — the rolling brief (seasonal cash flow, two HST quarters
  behind, late source deductions, cleanup underway, waiting on bank statements +
  truck invoice, wants to sell in ~5 years).
- **Timeline** — the prior "mid-year cleanup & HST catch-up" meeting.
- **Follow-ups** — including the **overdue** client item (bank statements + truck invoice).

> "This is what a new hire would read to understand Northwind in 30 seconds.
> Atlas built it from a past meeting and my own brain-dump."

## 2. Record a new meeting (2 minutes)

Tap **Record** (bottom nav on mobile, or **Upload meeting**). Select client
**Northwind Landscaping**, tick **recording consent**, hit the mic, and read this
aloud (or play it):

> **Damon:** Hi Rob, thanks for calling back.
> **Rob:** Hey Damon — good news, I found those bank statements, August through October. I'll email them this afternoon.
> **Damon:** That unblocks the HST filing — I'll get both overdue returns filed this week.
> **Rob:** Perfect. One more thing — I took on a new seasonal worker last month, Tyler, and I haven't set him up on payroll yet.
> **Damon:** That's important. We need to get him on payroll, do his TD1, and make sure source deductions come off his pay so we don't create another remittance problem. Send me his details and his SIN.
> **Rob:** Will do. Also, a customer cheque for four thousand dollars bounced last week — does that matter?
> **Damon:** We'll record it as a reversal and follow up. Let's talk again once the statements are in.

Stop the recording → **Create meeting** → on the meeting page click
**Transcribe & summarize**.

## 3. See the summary + action items (2 minutes)

When processing finishes, point at:
- **Summary** — discussion points, decisions, client/firm commitments, and
  **risks** (e.g., new employee not yet on payroll → remittance risk), each
  linked to a transcript timestamp.
- **Action items** — newly extracted, e.g. *send Tyler's payroll details/SIN*
  (client), *file the two overdue HST returns* and *set Tyler up on payroll*
  (firm).

> "I didn't write any of this. Atlas listened and produced the notes and the
> follow-ups."

## 4. See client memory update (1 minute)

Go back to **Northwind**. The **Atlas memory** card now reflects the new call —
the incoming bank statements and the new hire, Tyler, who needs to go on payroll.

> "That's the difference between a recorder and an employee. It didn't just
> transcribe — it *updated what it knows about this client*."

## 5. Ask Atlas questions (3 minutes)

Open **Ask Atlas**. Set scope to **Northwind**, then ask (each answer shows
**citations**):

- *"What's the status of Northwind's GST/HST?"* → two quarters behind; filing the overdue returns; statements now incoming.
- *"What are we still waiting on from Rob?"* → bank statements (now arriving), F-350 truck invoice, and Tyler's payroll details/SIN.
- *"What does Rob tend to get wrong?"* → mixes personal/business on the company card; falls behind off-season — *from the brain-dump*.

Switch scope to **Firm-wide** and ask a procedure question:
- *"How do we handle year-ends for owner-managed corporations?"* → answers from the **SOP** (document request list, HST reconciliation, payroll/T4 reconciliation, salary-vs-dividends, filing).
- *"What did we decide about Aisha's salary versus dividends?"* → ~$90k salary + dividends to preserve RRSP room — *from Birchwood's meeting*.

> "Any staff member can get senior-level context on any client, instantly, with
> the sources to back it up — and it never guesses on financial questions."

---

## Closing line

> "Today Atlas knows three clients. Imagine it after a year of sitting in every
> meeting at Browns. That's the institutional memory you can't hire — and it
> doesn't quit."

---

## Backup questions that work against the seeded data
- "Why is Northwind behind on its filings?" (seasonality — brain-dump/meeting)
- "What's the risk with Northwind's source deductions?" (repeated late remittances → 10% penalty)
- "Is Birchwood caught up on HST?" (yes, quarterly; possible instalments next year)
- "What's outstanding for Daniel Okafor?" (2025 receipts + home-office details; HST registration question near the $30k threshold)
- "What's our document request list for a year-end?" (from the SOP)

## If something misbehaves
- **Mic blocked / iOS:** use **Upload** and drop an audio file instead of recording.
- **No AI keys:** skip steps 2–4; demo the seeded data (steps 1 and 5). "Ask Atlas" will show cited passages without a composed answer.
- **Whisper error on a long file:** Whisper caps uploads at 25 MB — keep the demo clip short, or set `ATLAS_STT_PROVIDER=deepgram`.
