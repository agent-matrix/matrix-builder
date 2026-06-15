// Build status + generated thumbnail ("picture") variants for build cards.
//
// Every build — real ones created in the app — gets a deterministic generated thumbnail from its id
// via thumbVariant() + <BundleThumbnail>. The previous demo SAVED_BUNDLES seed was removed (fresh
// accounts now start empty with the My Builds empty state); the thumbnail generation stays.

export type BuildStatus = "ready" | "validated" | "draft";

const THUMB_VARIANTS = ["sphere", "wave", "mesh", "radial", "spiral", "pyramid", "beam", "grid"];

export function thumbVariant(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return THUMB_VARIANTS[Math.abs(h) % THUMB_VARIANTS.length];
}
