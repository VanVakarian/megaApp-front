import { CACHE_SCHEMA_VERSION, USER_SCOPED_CACHE_BASE_KEYS } from '@app/shared/const';

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function getCacheUserId(): string {
  const token = localStorage.getItem('access_token');
  if (!token) return 'guest';

  try {
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]));
    return payload.id ? String(payload.id) : 'guest';
  } catch {
    return 'guest';
  }
}

export function buildCacheKey(baseKey: string): string {
  return `${baseKey}:${getCacheUserId()}:v${CACHE_SCHEMA_VERSION}`;
}

export function clearAllUserScopedCaches(): void {
  const keysToRemove = Object.keys(localStorage).filter((key) =>
    USER_SCOPED_CACHE_BASE_KEYS.some((baseKey) => key.startsWith(`${baseKey}:`)),
  );

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function purgeStaleCacheVersions(): void {
  const currentSuffix = `:v${CACHE_SCHEMA_VERSION}`;

  const keysToRemove = Object.keys(localStorage).filter((key) =>
    USER_SCOPED_CACHE_BASE_KEYS.some((baseKey) => key.startsWith(`${baseKey}:`) && !key.endsWith(currentSuffix)),
  );

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
