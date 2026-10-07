import { API_URL } from './api';
export const DEFAULT_APPEARANCE = { primary: '#0E2A6B', accent: '#D4A93A', secondary: '#0F6B4F', background: '#F6F2E8', defaultTheme: 'light', headerLogo: '/brand/logo-header.png', footerLogo: '/brand/logo-footer.png', showImageSearch: true, showShipping: true, showMobileNav: true };
export type Appearance = typeof DEFAULT_APPEARANCE;
export async function getAppearance(): Promise<Appearance> {
  try { const r = await fetch(`${API_URL}/appearance`, { cache: 'no-store', signal: AbortSignal.timeout(5000) }); return r.ok ? { ...DEFAULT_APPEARANCE, ...await r.json() } : DEFAULT_APPEARANCE; } catch { return DEFAULT_APPEARANCE; }
}
