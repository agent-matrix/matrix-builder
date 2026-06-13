import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = { title: "Terms of Service · Matrix Builder" };

const h2 = { color: "#f7fff9", fontSize: 19, fontWeight: 600, margin: "26px 0 8px" } as const;
const a = { color: "#53f39d", textDecoration: "none" } as const;

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="13 June 2026">
      <p>
        Matrix Builder is a free, open-source project (MIT License). By using the hosted app at{" "}
        <code>builder.matrixhub.io</code> (or any deployment of it), you agree to these simple terms.
      </p>

      <h2 style={h2}>1. The service</h2>
      <p>
        Matrix Builder turns an idea into a controlled “Matrix Bundle” (a blueprint, locked standards,
        and tasks) an AI coder can follow. It is provided <strong>as is</strong>, without warranty.
        It is a community project — no SLA, and the hosted demo may change or go offline anytime.
      </p>

      <h2 style={h2}>2. Accounts</h2>
      <p>
        Sign in with Google or email + password (verified by an email link). Provide a valid email,
        keep your credentials secure, and you’re responsible for activity under your account. We may
        suspend accounts that abuse the service.
      </p>

      <h2 style={h2}>3. Acceptable use</h2>
      <p>
        Don’t use Matrix Builder for unlawful, harmful, or infringing content, to attack or overload
        the service, or to violate others’ rights. <strong>You are responsible for what your AI coder
        builds</strong> and for reviewing generated code before using it.
      </p>

      <h2 style={h2}>4. Your content</h2>
      <p>
        Your ideas and the bundles you generate are yours. The software itself is open source under
        the MIT License — read, self-host, and modify it.
      </p>

      <h2 style={h2}>5. No warranty / liability</h2>
      <p>
        The software and hosted service are provided “AS IS”, without warranties, and the authors are
        not liable for damages arising from its use, to the extent permitted by law.
      </p>

      <h2 style={h2}>6. Changes</h2>
      <p>We may update these terms; material changes are noted by the “last updated” date.</p>

      <h2 style={h2}>7. Contact</h2>
      <p>
        Email <a style={a} href="mailto:contact@ruslanmv.com">contact@ruslanmv.com</a> or open an
        issue on{" "}
        <a style={a} href="https://github.com/agent-matrix/matrix-builder" target="_blank" rel="noreferrer">GitHub</a>.
      </p>
    </LegalShell>
  );
}
