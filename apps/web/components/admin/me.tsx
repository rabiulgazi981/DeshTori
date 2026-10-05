'use client';
import { createContext, useContext } from 'react';
import type { Me } from '@/lib/types';

export const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);
export const can = (me: Me | null, roles: string[]) => !!me && (me.roles.includes('OWNER') || roles.some((r) => me.roles.includes(r)));
