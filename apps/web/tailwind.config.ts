import type { Config } from 'tailwindcss';

// DeshTori palette (navy · gold · emerald · ivory) – same as the approved design
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: 'rgb(var(--dt-navy) / <alpha-value>)', 600: '#163A85', 400: '#2C4E94' },
        gold: { DEFAULT: 'rgb(var(--dt-gold) / <alpha-value>)', light: '#E7C25A', chip: '#FBF0D5', ink: '#7A5512' },
        emerald: { DEFAULT: 'rgb(var(--dt-emerald) / <alpha-value>)', dark: '#0A4F3A', light: '#E3F1EA' },
        ivory: { DEFAULT: 'rgb(var(--dt-ivory) / <alpha-value>)', line: '#E6DCC3', ph: '#EEE8DA', soft: '#F1ECDF' },
        muted: '#4A5B6A',
        danger: '#9A2B1F',
      },
      fontFamily: {
        sans: ['var(--font-hind)', 'system-ui', 'sans-serif'],
        brand: ['var(--font-cinzel)', 'serif'],
      },
      boxShadow: {
        card: 'inset 0 1px 0 #fff, 0 1px 2px rgba(14,42,107,.06), 0 14px 30px -16px rgba(14,42,107,.30)',
        gold: 'inset 0 1px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(90,60,10,.25), 0 6px 14px -4px rgba(168,120,30,.55)',
      },
    },
  },
  plugins: [],
};
export default config;
