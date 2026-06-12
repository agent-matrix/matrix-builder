import { RepairPromptPanel } from "../../../components/builder/RepairPromptPanel";
import { ValidationReportPanel } from "../../../components/builder/ValidationReportPanel";
import { demoValidationReports } from "../../../types/validation";

export default function Page() {
  return (
    <main className="l-dark" style={{ minHeight: "100vh", padding: "48px" }}>
      <section className="container">
        <p className="eyebrow">Matrix Builder validation</p>
        <h1>Approved. Needs repair. Rejected.</h1>
        <p className="muted">
          Matrix Builder closes the loop after an AI coder works on a bundle. It checks the patch
          against the Matrix contract, detects drift, and generates bounded repair prompts.
        </p>
        <div className="bundle-grid" style={{ marginTop: "32px" }}>
          {demoValidationReports.map((report) => (
            <div key={report.report_id}>
              <ValidationReportPanel report={report} />
              <RepairPromptPanel report={report} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
