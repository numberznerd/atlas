export const metadata = { title: "Where your data lives — Atlas" };

export default function DataResidencyPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Where your data lives</h1>
      <p className="text-muted-foreground">
        Data residency is a first-class design constraint for Atlas, not a configuration afterthought.
      </p>

      <h2 className="pt-4 text-lg font-semibold">In Canada by default</h2>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Layer</th>
            <th className="py-2 pr-4 font-medium">Where</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          <tr className="border-b border-border"><td className="py-2 pr-4">App database, auth, storage, vectors</td><td className="py-2 pr-4">Supabase — Canada Central (ca-central-1, Montréal)</td></tr>
          <tr className="border-b border-border"><td className="py-2 pr-4">App hosting / serverless functions</td><td className="py-2 pr-4">Vercel — Montréal region (yul1)</td></tr>
          <tr className="border-b border-border"><td className="py-2 pr-4">AI inference (summaries, chat, embeddings)</td><td className="py-2 pr-4">Azure OpenAI or AWS Bedrock — Canada Central, regional no-training endpoints</td></tr>
          <tr><td className="py-2 pr-4">Transcription (speech-to-text)</td><td className="py-2 pr-4">See residency tiers below</td></tr>
        </tbody>
      </table>

      <h2 className="pt-4 text-lg font-semibold">Transcription residency tiers</h2>
      <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Standard:</span> a managed speech-to-text
          provider under a no-training DPA. Where audio is processed transiently outside Canada, it
          is disclosed in the DPA and to clients, consistent with CPABC guidance.
        </li>
        <li>
          <span className="font-medium text-foreground">Canada-only:</span> self-hosted transcription
          on Canadian infrastructure for Québec / Law 25 and strict-residency firms — no audio leaves
          Canada. Selectable per firm.
        </li>
      </ul>

      <h2 className="pt-4 text-lg font-semibold">Sub-processors &amp; CLOUD Act</h2>
      <p className="text-muted-foreground">
        We disclose all sub-processors in the DPA, including whether any is US-headquartered (relevant
        to a Law 25 Transfer Impact Assessment). Atlas provides TIA-supporting documentation for
        Québec customers.
      </p>
    </>
  );
}
