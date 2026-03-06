const CACHE_MAX_SIZE = 2048;
const cache = new Map<string, string>();

function cacheKey(chatId: number | string, threadId: number): string {
  return `${chatId}:${threadId}`;
}

export function cacheTopicName(chatId: number | string, threadId: number, name: string): void {
  const key = cacheKey(chatId, threadId);
  if (cache.size >= CACHE_MAX_SIZE && !cache.has(key)) {
    const oldest = cache.keys().next();
    if (oldest.done === false) {
      cache.delete(oldest.value);
    }
  }
  cache.set(key, name);
}

export function getTopicName(chatId: number | string, threadId: number): string | undefined {
  return cache.get(cacheKey(chatId, threadId));
}
