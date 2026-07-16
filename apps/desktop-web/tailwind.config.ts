import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-hover': '#1D4ED8',
        'on-primary': '#FFFFFF',
        secondary: '#3B82F6',
        accent: '#0284C7',
        background: '#F8FAFC',
        foreground: '#0F172A',
        muted: '#F1F5F9',
        'muted-foreground': '#64748B',
        border: '#E2E8F0',
        destructive: '#DC2626',
        ring: '#2563EB',
        status: {
          available: '#059669',
          busy: '#D97706',
          offline: '#94A3B8',
          pending: '#94A3B8',
          progress: '#2563EB',
          reached: '#7C3AED',
          rejected: '#DC2626',
          verified: '#059669',
          unverified: '#D97706',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        popover: '0 10px 15px -3px rgb(15 23 42 / 0.1), 0 4px 6px -4px rgb(15 23 42 / 0.1)',
        // Elevation scale for dimensional layering (floating map cards, dropdowns, timelines).
        'elevation-1': '0 1px 3px rgb(15 23 42 / 0.06)',
        'elevation-2': '0 4px 10px rgb(15 23 42 / 0.08)',
        'elevation-3': '0 10px 24px rgb(15 23 42 / 0.12)',
        'elevation-4': '0 20px 40px rgb(15 23 42 / 0.16)',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
