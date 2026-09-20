// Media URLs are frozen absolute in a session snapshot (PUBLIC_URL + /uploads/…). Opened from another
// address — a LAN IP, the PC plugged into the projector — `localhost` would point at the wrong machine.
// Uploads are always served next to the page, so the path alone loads wherever the page was opened.

export function mediaSrc(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.startsWith('/uploads/') ? `${parsed.pathname}${parsed.search}` : url;
  } catch {
    return url;
  }
}
