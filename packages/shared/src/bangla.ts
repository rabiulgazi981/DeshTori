const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Replace ASCII digits with Bangla digits. */
export const toBanglaDigits = (input: string | number): string =>
  String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

/** Group a whole number the South-Asian way: 1,23,45,678 */
export const groupIndian = (n: number): string => {
  const neg = n < 0;
  const s = String(Math.abs(Math.trunc(n)));
  if (s.length <= 3) return (neg ? '-' : '') + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + rest + ',' + last3;
};

export interface FormatBdtOptions {
  /** Use Bangla digits (default true). */
  bangla?: boolean;
  /** Show paisa decimals (default false → whole taka, rounded). */
  decimals?: boolean;
  /** Prefix with ৳ (default true). */
  symbol?: boolean;
}

/** Format paisa as taka, e.g. 1185800 → "৳১১,৮৫৮". */
export const formatBdt = (paisa: number, opts: FormatBdtOptions = {}): string => {
  const { bangla = true, decimals = false, symbol = true } = opts;
  const neg = paisa < 0;
  const abs = Math.abs(paisa);
  let out: string;
  if (decimals) {
    const whole = Math.trunc(abs / 100);
    const frac = String(abs % 100).padStart(2, '0');
    out = `${groupIndian(whole)}.${frac}`;
  } else {
    out = groupIndian(Math.round(abs / 100));
  }
  if (bangla) out = toBanglaDigits(out);
  return `${neg ? '− ' : ''}${symbol ? '৳' : ''}${out}`;
};
