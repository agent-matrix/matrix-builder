import { redirect } from "next/navigation";

export default function HomePage() {
  // Skip the intro splash — land users directly on the Matrix Builder page.
  redirect("/matrix-builder");
}
