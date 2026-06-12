export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "matrix-agent";
}

export function generateBundleId(): string {
  const first = Math.random().toString(36).slice(2, 8);
  const second = Math.random().toString(36).slice(2, 6);
  return `mb_${first}${second}`;
}
