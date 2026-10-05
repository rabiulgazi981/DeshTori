/** Normalise a Bangladeshi mobile number to E.164 (+8801XXXXXXXXX). Returns null if invalid. */
export const normalizeBdPhone = (input: string): string | null => {
  const digits = input.replace(/[^\d]/g, '');
  let local = digits;
  if (local.startsWith('880')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  // operators: 013-019
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
};

export const maskPhone = (e164: string): string => e164.replace(/^(\+8801\d)\d{6}(\d{2})$/, '$1XXXXXX$2');
