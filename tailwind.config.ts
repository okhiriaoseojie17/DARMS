import type { Config } from 'tailwindcss';

// Design direction: "the departmental archive" — a catalog/ledger feel that suits
// a CS/MIS academic repository without leaning on generic AI-default palettes.
// Ink-blue as the structural color, warm paper for surfaces, amber as the one
// accent reserved for status/action (pending review, approve).
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B1220',
          900: '#111A2E',
          700: '#22314F',
          500: '#3C4E73',
        },
        paper: {
          50: '#FBFAF7',
          100: '#F4F1E9',
          200: '#E7E1D1',
        },
        amber: {
          500: '#C4841D',
          600: '#A66A12',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};

export default config;
