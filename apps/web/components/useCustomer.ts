'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiError, errText } from '@/lib/api';

/** Load customer data; sends to login (and back) when the session is missing. */
export function useCustomer<T>(path: string) {
  const router = useRouter();
  const here = usePathname();
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(here ?? '/account')}`);
      else setErr(errText(e));
    }
  }, [path, router, here]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, err, reload };
}
