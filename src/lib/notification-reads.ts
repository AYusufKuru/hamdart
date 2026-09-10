const STORAGE_PREFIX = "hamdart-notif-read:";
const MAX_IDS = 300;

function keyFor(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadReadNoticeIds(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function saveReadNoticeIds(userId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  const trimmed = [...ids].slice(-MAX_IDS);
  window.localStorage.setItem(keyFor(userId), JSON.stringify(trimmed));
}
