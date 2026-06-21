import { open } from "@tauri-apps/plugin-shell";

export function toFileUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("file://")) {
    return pathOrUrl;
  }

  return `file://${pathOrUrl.split("/").map((part, index) =>
    index === 0 ? part : encodeURIComponent(part)
  ).join("/")}`;
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export type OpenPath = (path: string) => Promise<void>;

export async function openLocalPath(
  pathOrUrl: string,
  openPath: OpenPath = open
): Promise<void> {
  await openPath(toFileUrl(pathOrUrl));
}
