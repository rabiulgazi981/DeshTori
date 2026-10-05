/**
 * All money is stored and calculated as integers to avoid floating-point errors.
 *  - BDT amounts are in paisa (1 taka = 100 paisa).
 *  - CNY amounts are in fen (1 yuan = 100 fen).
 */
export type Paisa = number;
export type Fen = number;

export const toFen = (yuan: number): Fen => Math.round(yuan * 100);
export const toPaisa = (taka: number): Paisa => Math.round(taka * 100);
export const paisaToTaka = (p: Paisa): number => p / 100;

/** Round paisa UP to the next whole taka (we never undercharge on display). */
export const ceilToTaka = (p: Paisa): Paisa => Math.ceil(p / 100) * 100;
/** Round paisa to the nearest whole taka. */
export const roundToTaka = (p: Paisa): Paisa => Math.round(p / 100) * 100;

/** Percentage of an amount, rounded to the nearest paisa. `pct` may have decimals (e.g. 2.5). */
export const percentOf = (amount: Paisa, pct: number): Paisa => Math.round((amount * pct) / 100);

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
