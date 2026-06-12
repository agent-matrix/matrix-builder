import { validateBundle } from "../lib/api-client";

export function useValidation() {
  return { status: "ready", validateBundle } as const;
}
