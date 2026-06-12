import type { ValidationReport } from "../../types/validation";

export function ValidationReportPanel({ report }: { report: ValidationReport }) {
  return (
    <section className="darkpanel validation-panel">
      <p className="eyebrow">Validation result</p>
      <h2>{statusLabel(report.status)}</h2>
      <p>{report.summary}</p>
      <div className="score-row">
        <strong>{report.score}</strong>
        <span>contract score</span>
      </div>
      <div className="checks-grid">
        {report.checks.map((check) => (
          <article key={check.check_id} className="mini-card">
            <strong>{check.status}</strong>
            <span>{check.check_id}</span>
            {check.message ? <small>{check.message}</small> : null}
          </article>
        ))}
      </div>
      {report.violations.length ? (
        <div className="violation-list">
          {report.violations.map((violation) => (
            <article key={`${violation.rule_id}-${violation.path ?? "repo"}`} className="violation-card">
              <strong>{violation.rule_id}</strong>
              <span>{violation.severity}</span>
              <p>{violation.message}</p>
              {violation.path ? <code>{violation.path}</code> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="success-note">Ready for MatrixHub dry-run publication.</p>
      )}
    </section>
  );
}

function statusLabel(status: ValidationReport["status"]) {
  if (status === "approved") return "Approved";
  if (status === "needs-repair") return "Needs repair";
  if (status === "rejected") return "Rejected";
  return "Not run";
}
