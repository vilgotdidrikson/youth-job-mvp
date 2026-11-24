const MAX_IDLE_MS = 90 * 24 * 60 * 60 * 1000;

export function readPrivateCvWork<T extends object>(storage: Storage, key: string, now = Date.now()): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Number.isFinite(value.lastActiveAt)) {
    // Older entries have no reliable activity date. Start their clock at first access.
    storage.setItem(key, JSON.stringify({ ...value, lastActiveAt: now }));
  } else if (now - value.lastActiveAt >= MAX_IDLE_MS) {
    storage.removeItem(key);
    return null;
  }
  return value as T;
}

export function writePrivateCvWork(storage: Storage, key: string, value: object, now = Date.now()) {
  const existing = readPrivateCvWork<Record<string, unknown>>(storage, key, now);
  const current = existing && Object.fromEntries(Object.entries(existing).filter(([name]) => name !== "lastActiveAt"));
  if (current && JSON.stringify(current) === JSON.stringify(value)) return;
  storage.setItem(key, JSON.stringify({ ...value, lastActiveAt: now }));
}
