/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
          980: '#01040a',
        },
        black: '#000000',
        accent: {
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(96, 165, 250, 0.28), 0 0 22px rgba(59, 130, 246, 0.16)',
        'glow-amber': '0 0 0 1px rgba(245, 158, 11, 0.28), 0 0 18px rgba(245, 158, 11, 0.15)',
        'glow-emerald': '0 0 0 1px rgba(16, 185, 129, 0.28), 0 0 18px rgba(16, 185, 129, 0.12)',
      },
      borderColor: {
        glow: 'rgba(96, 165, 250, 0.38)',
      },
      backgroundImage: {
        'grid-faint': 'radial-gradient(circle, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
