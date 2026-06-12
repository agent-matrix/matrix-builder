import type { ValidationReport } from "../../types/validation";

export function RepairPromptPanel({ report }: { report: ValidationReport }) {
  if (!report.repair_prompt) return null;
  return (
    <section className="darkpanel repair-panel">
      <p className="eyebrow">Bounded repair prompt</p>
      <h2>Give this to the AI coder</h2>
      <pre>{report.repair_prompt}</pre>
      <p className="muted">The repair prompt keeps the AI coder as a worker, not the architect.</p>
    </section>
  );
}
