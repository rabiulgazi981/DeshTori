/**
 * Google Sign-In: the browser gets an ID token from Google Identity Services and we check it with
 * Google's tokeninfo endpoint (no extra library). Only tokens issued for our client id are accepted.
 */
export interface GoogleProfile { sub: string; email?: string; name?: string }

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID?.trim() || '';

export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile | null> {
  const clientId = googleClientId();
  if (!clientId || !credential) return null;
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const t = (await res.json()) as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; exp?: string };
  if (t.aud !== clientId) return null;
  if (t.iss !== 'accounts.google.com' && t.iss !== 'https://accounts.google.com') return null;
  if (!t.sub || Number(t.exp ?? 0) * 1000 < Date.now()) return null;
  const verified = t.email_verified === true || t.email_verified === 'true';
  return { sub: t.sub, email: verified ? t.email?.toLowerCase() : undefined, name: t.name };
}
