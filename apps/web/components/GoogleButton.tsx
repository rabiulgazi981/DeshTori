'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type Gsi = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

/** "Sign in with Google" button. Renders nothing until the server has a Google client id. */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    api<{ clientId: string | null }>('/auth/google/config').then((r) => setClientId(r.clientId)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const draw = () => {
      const g = (window as unknown as { google?: Gsi }).google;
      if (!g || !box.current) return;
      g.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
      g.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'bn', width: Math.min(box.current.offsetWidth || 320, 400) });
    };
    const id = 'google-gsi';
    const old = document.getElementById(id);
    if (old) return draw();
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = draw;
    document.head.appendChild(s);
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-ivory-line" />অথবা<span className="h-px flex-1 bg-ivory-line" /></div>
      <div ref={box} className="flex min-h-[44px] w-full justify-center" />
    </div>
  );
}
