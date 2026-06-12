export function useBundleDownload() {
  return { status: "ready", downloadPath: (bundleId: string) => `/api/v1/bundles/${bundleId}/download` } as const;
}
