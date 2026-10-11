/**
 * Where to go after login. Kept in sessionStorage so the login link stays a clean "/login"
 * (no ?next=%2Fship in the address bar).
 */
const KEY = 'dt-next';

export const loginHref = (back: string) => {
  try {
    sessionStorage.setItem(KEY, back);
  } catch {
    /* private mode: fall back to the default page after login */
  }
  return '/login';
};

/** Read and clear the saved page; only same-site paths are accepted. */
export const takeLoginNext = (fallback: string) => {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (v && v.startsWith('/') && !v.startsWith('//')) return v;
  } catch {
    /* ignore */
  }
  return fallback;
};
