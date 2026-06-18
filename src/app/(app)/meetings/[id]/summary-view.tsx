import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gavel,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";
import type { SummaryPoint, SummarySections } from "@/lib/types/database";

const SECTIONS: {
  key: keyof SummarySections;
  label: string;
  icon: typeof MessageSquare;
  tone?: string;
}[] = [
  { key: "discussion_points", label: "Discussion points", icon: MessageSquare },
  { key: "decisions", label: "Decisions made", icon: Gavel },
  { key: "client_commitments", label: "Client commitments", icon: ListChecks },
  { key: "firm_commitments", label: "Firm commitments", icon: CheckCircle2 },
  { key: "risks", label: "Risks & flags", icon: AlertTriangle, tone: "text-warning" },
];

export function SummaryView({ sections }: { sections: SummarySections }) {
  const hasAny = SECTIONS.some((s) => (sections[s.key] as SummaryPoint[] | undefined)?.length) ||
    sections.next_meeting?.text;

  if (!hasAny) {
    return <p className="text-sm text-muted-foreground">The summary is empty.</p>;
  }

  return (
    <div className="space-y-5">
      {SECTIONS.map((s) => {
        const points = sections[s.key] as SummaryPoint[] | undefined;
        if (!points || points.length === 0) return null;
        const Icon = s.icon;
        return (
          <div key={s.key}>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon className={`size-4 ${s.tone ?? "text-muted-foreground"}`} />
              {s.label}
            </h4>
            <ul className="mt-2 space-y-1.5">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                  <span>{p.text}</span>
                  {typeof p.ts === "number" ? (
                    <Badge variant="muted" className="mt-0.5 shrink-0 font-mono text-[10px]">
                      {formatTimestamp(p.ts * 1000)}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {sections.next_meeting?.text ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <CalendarClock className="size-4 text-accent" />
          <span className="font-medium text-foreground">Next meeting:</span>
          <span className="text-muted-foreground">{sections.next_meeting.text}</span>
        </div>
      ) : null}
    </div>
  );
}
