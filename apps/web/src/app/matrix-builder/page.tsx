import type { Metadata } from "next";
import MatrixBuilderClient from "./MatrixBuilderClient";
import { matrixBuilderDescription, matrixBuilderTitle } from "./metadata";

export const metadata: Metadata = {
  title: matrixBuilderTitle,
  description: matrixBuilderDescription,
  openGraph: {
    title: "Give AI coders a contract, not a prompt.",
    description: matrixBuilderDescription,
    type: "website",
  },
};

export default function MatrixBuilderPage() {
  return <MatrixBuilderClient />;
}
