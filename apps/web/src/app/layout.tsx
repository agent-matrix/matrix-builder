import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = "https://build.matrixhub.io";
const DESCRIPTION =
  "Matrix Builder turns one sentence into a controlled, signed Matrix Bundle — a blueprint, locked standards, and an allowed-files scope that Claude Code, Codex, Cursor, GitPilot, or IBM Bob build inside — then validates the result. Controlled, auditable, open-source AI coding.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Matrix Builder — Give AI coders a contract, not a prompt",
    template: "%s · Matrix Builder",
  },
  description: DESCRIPTION,
  applicationName: "Matrix Builder",
  keywords: [
    "AI coding",
    "controlled AI code generation",
    "AI coder governance",
    "AI code review",
    "Claude Code",
    "Codex",
    "Cursor",
    "GitPilot",
    "IBM Bob",
    "Matrix Bundle",
    "signed standards",
    "agent-generator",
    "MatrixHub",
    "Ruslan Magana",
  ],
  authors: [{ name: "Ruslan Magana", url: "https://ruslanmv.com" }],
  creator: "Ruslan Magana",
  publisher: "Ruslan Magana",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Matrix Builder",
    title: "Matrix Builder — Give AI coders a contract, not a prompt",
    description: "Turn one sentence into a controlled, validated Matrix Bundle for any AI coder.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Matrix Builder — Give AI coders a contract, not a prompt",
    description: "Turn one sentence into a controlled, validated Matrix Bundle for any AI coder.",
    creator: "@ruslanmv",
  },
  manifest: "/manifest.webmanifest",
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#02170f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Extend under the iPhone notch / Android cutouts so env(safe-area-inset-*) works edge-to-edge.
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Matrix Builder",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE,
  description: DESCRIPTION,
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  creator: { "@type": "Person", name: "Ruslan Magana", url: "https://ruslanmv.com" },
  license: "https://opensource.org/licenses/MIT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
