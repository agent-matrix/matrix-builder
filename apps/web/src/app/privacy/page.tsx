import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = { title: "Privacy Policy · Matrix Builder" };

const h2 = { color: "#f7fff9", fontSize: 19, fontWeight: 600, margin: "26px 0 8px" } as const;
const a = { color: "#53f39d", textDecoration: "none" } as const;
const li = { margin: "4px 0" } as const;

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="13 June 2026">
      <p>
        Matrix Builder is an open-source project. We keep data collection to the minimum needed to
        run the service, and we <strong>never sell your data</strong>.
      </p>

      <h2 style={h2}>What we collect</h2>
      <ul>
        <li style={li}><strong>Account:</strong> your email, and (if you use Google) your name and profile photo.</li>
        <li style={li}><strong>Your work:</strong> the ideas you describe and the Matrix Bundles you generate.</li>
        <li style={li}><strong>Basic logs:</strong> standard request/error logs to operate and secure the service.</li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <p>
        Only to provide the service: authenticate you, save and show your bundles, send account
        emails (verification, password reset), and keep things secure. That’s it.
      </p>

      <h2 style={h2}>Where it lives (sub-processors)</h2>
      <ul>
        <li style={li}><strong>Google</strong> — “Sign in with Google” (only if you choose it).</li>
        <li style={li}><strong>Resend</strong> — sends account emails.</li>
        <li style={li}><strong>Aiven (PostgreSQL)</strong> — stores your account and bundles.</li>
        <li style={li}><strong>Hugging Face / Vercel</strong> — host the application.</li>
      </ul>

      <h2 style={h2}>Storage in your browser</h2>
      <p>
        A sign-in token is stored in your browser’s <code>localStorage</code> to keep you signed in.
        We don’t use advertising or tracking cookies.
      </p>

      <h2 style={h2}>Security</h2>
      <p>
        Passwords are hashed (PBKDF2-HMAC-SHA256, never plain text), connections use TLS, and
        per-user row-level security isolates each user’s data in the database.
      </p>

      <h2 style={h2}>Your choices</h2>
      <ul>
        <li style={li}>Want your account and data deleted? Email <a style={a} href="mailto:contact@ruslanmv.com">contact@ruslanmv.com</a>.</li>
        <li style={li}>Prefer full control? Matrix Builder is open source — <strong>self-host it</strong> and own your data end to end.</li>
      </ul>

      <h2 style={h2}>Changes & contact</h2>
      <p>
        We may update this policy; material changes are reflected in the “last updated” date.
        Contact <a style={a} href="mailto:contact@ruslanmv.com">contact@ruslanmv.com</a> ·{" "}
        <a style={a} href="https://github.com/agent-matrix/matrix-builder" target="_blank" rel="noreferrer">GitHub</a>.
      </p>
    </LegalShell>
  );
}
