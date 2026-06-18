export const metadata = { title: "Privacy — Atlas" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Privacy &amp; data handling</h1>
      <p className="text-muted-foreground">
        Atlas is built for Canadian CPA firms and designed around PIPEDA, Québec Law 25, and the CPA
        Code of Professional Conduct (Rule 208). This page is a plain-language summary; a full Data
        Processing Agreement (DPA) is provided to every firm.
      </p>

      <h2 className="pt-4 text-lg font-semibold">The essentials</h2>
      <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
        <li><span className="font-medium text-foreground">We never train models on your data.</span> Client data is used only to provide the service to your firm — contractually and technically.</li>
        <li><span className="font-medium text-foreground">Your data lives in Canada.</span> Application data, files, and search vectors are stored in <code>ca-central-1</code>. See &ldquo;Where your data lives.&rdquo;</li>
        <li><span className="font-medium text-foreground">You stay in control.</span> Per-client and full-workspace export, and hard-delete on request.</li>
        <li><span className="font-medium text-foreground">Everything sensitive is logged.</span> Logins, uploads, exports, approvals, and deletions are recorded in an audit trail.</li>
      </ul>

      <h2 className="pt-4 text-lg font-semibold">PIPEDA fair information principles</h2>
      <p className="text-muted-foreground">
        Atlas supports all ten principles — accountability, identifying purposes, consent, limiting
        collection, limiting use/disclosure/retention, accuracy, safeguards, openness, individual
        access, and challenging compliance. The CPA firm remains the accountable party for client
        personal information; Atlas acts as a processor under a DPA.
      </p>

      <h2 className="pt-4 text-lg font-semibold">Recording consent</h2>
      <p className="text-muted-foreground">
        Recording a client meeting is a collection of personal information under PIPEDA. Atlas
        requires firms to confirm consent before audio is processed and provides template consent
        language for client engagement letters.
      </p>

      <h2 className="pt-4 text-lg font-semibold">Retention</h2>
      <p className="text-muted-foreground">
        Records are retained for a configurable period (default 84 months) and are never auto-deleted
        below the CRA six-year minimum.
      </p>

      <p className="pt-6 text-xs text-muted-foreground">
        This is a template for the MVP and not legal advice. Finalize with counsel before production
        use.
      </p>
    </>
  );
}
