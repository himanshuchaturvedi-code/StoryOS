import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dce5ff',
          200: '#bfceff',
          300: '#93acff',
          400: '#607dff',
          500: '#3b52f5',
          600: '#2a3de8',
          700: '#2330d0',
          800: '#2229a8',
          900: '#222985',
          950: '#141851',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
