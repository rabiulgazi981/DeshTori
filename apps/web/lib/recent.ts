/** The customer's last few searches, kept in this browser only (used for search hints and "আপনার জন্য" products). */
const KEY = 'dt-recent';

export function recentSearches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string) {
  const v = q.trim().slice(0, 60);
  if (!v) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([v, ...recentSearches().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 5)));
  } catch {
    /* storage blocked */
  }
}
