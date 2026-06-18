import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  FileSearch,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const moat = [
  {
    icon: Brain,
    title: "Firm-intelligence layer",
    body: "Meetings, client history, and internal SOPs in one searchable brain. No competitor does all three.",
  },
  {
    icon: MapPin,
    title: "Canadian-first",
    body: "Data residency in Canada (ca-central-1), PIPEDA / Québec Law 25-ready, CPA Code aligned.",
  },
  {
    icon: UserPlus,
    title: "New-hire onboarding",
    body: "Instant client context for new staff — aimed straight at the 22% first-year attrition pain.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop",
    body: "Nothing leaves the firm or touches a client without an explicit human approval.",
  },
];

const loop = [
  { icon: FileSearch, title: "Capture", body: "Upload a meeting; get a Canada-resident, speaker-diarized transcript." },
  { icon: BadgeCheck, title: "Structure", body: "An accounting-aware summary with decisions, commitments, and risk flags — every line linked to the transcript." },
  { icon: MessagesSquare, title: "Ask & act", body: "Ask anything about a client or firm procedure, with citations. Follow-ups tracked to done." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <Badge variant="accent" className="mb-5">
            For Canadian CPA firms
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            The AI junior employee that never forgets a client conversation
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Atlas captures every client meeting, turns it into searchable firm intelligence, and
            lets any staff member ask questions about a client or your firm&apos;s procedures —
            purpose-built for Canada, with data residency and CPA-grade compliance.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Create your firm workspace <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            A 10-seat firm pays roughly{" "}
            <span className="font-medium text-foreground">15% of the cost of one junior accountant</span>{" "}
            — and the institutional memory never quits.
          </p>
        </section>

        {/* The core loop */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              The core loop
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {loop.map((s) => (
                <div key={s.title} className="rounded-xl border border-border bg-background p-6">
                  <s.icon className="size-6 text-accent" />
                  <h3 className="mt-4 font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Moat */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
            Built where horizontal tools can&apos;t follow
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {moat.map((m) => (
              <div key={m.title} className="flex gap-4 rounded-xl border border-border bg-card p-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <m.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{m.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo showWord={false} />
            <span>Atlas — firm intelligence for Canadian CPAs</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal/data-residency" className="hover:text-foreground">Where your data lives</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
