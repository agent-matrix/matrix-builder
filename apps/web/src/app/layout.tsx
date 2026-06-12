import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matrix Builder by Ruslan Magana",
  description: "Give AI coders a contract, not a prompt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
