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
