/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest.
        void: '#05070c',
        base: '#080b12',
        surface: '#0c111b',
        raised: '#111826',
        overlay: '#161f30',
        line: '#1c2636',
        'line-strong': '#27344a',

        // Text.
        ink: '#e8edf6',
        'ink-dim': '#a3b0c4',
        'ink-faint': '#6c7a91',

        // Accent and semantic.
        primary: {
          DEFAULT: '#4d9bff',
          soft: '#1d3a63',
          dim: '#2e5f9e',
          bright: '#7db6ff',
        },
        good: { DEFAULT: '#2fbf8f', soft: '#12372e' },
        warn: { DEFAULT: '#e0a03a', soft: '#3a2d12' },
        bad: { DEFAULT: '#e8605f', soft: '#3c1a1e' },
        info: { DEFAULT: '#8b7bf0', soft: '#241f45' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.625rem',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.8)',
        pop: '0 16px 48px -12px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(77,155,255,0.35), 0 0 24px -6px rgba(77,155,255,0.35)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        'radial-fade':
          'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(77,155,255,0.16), transparent 70%)',
      },
      backgroundSize: {
        grid: '48px 48px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.7', transform: 'scale(0.9)' },
          '70%, 100%': { opacity: '0', transform: 'scale(2.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.14s ease-out',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.3, 1) infinite',
      },
    },
  },
  plugins: [],
};
