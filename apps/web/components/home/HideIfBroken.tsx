'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Wraps a banner and removes it from the page when its image no longer exists on the server. */
export function HideIfBroken({ src, children }: { src?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!src) return;
    const probe = new Image();
    probe.onerror = () => ref.current && (ref.current.style.display = 'none');
    probe.src = src;
  }, [src]);
  return <div ref={ref}>{children}</div>;
}
