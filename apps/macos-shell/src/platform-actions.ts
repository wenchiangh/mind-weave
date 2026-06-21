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

export function openLocalPath(pathOrUrl: string): void {
  window.open(toFileUrl(pathOrUrl), "_blank", "noopener,noreferrer");
}
