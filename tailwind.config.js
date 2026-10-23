/** @type {import('tailwindcss').Config} */

/*
 * Design tokens, following the SpaceX-inspired design system (DESIGN.md).
 *
 * The palette is black, white and nothing else. Existing token names are kept
 * (base, surface, ink, primary ...) so the screens do not change; what they
 * resolve to does. "primary" is white now, not a brand hue.
 *
 * Status colours (good / warn / bad) are the one deliberate exception. A space
 * data product has to say "stale" or "failed" in a way that survives a glance,
 * so they stay, muted, and only ever appear on status marks, never as chrome.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest.
        void: '#000000', //        canvas-night
        // Careful: Tailwind's `text-base` (font size) also matches this colour,
        // so `sm:text-base` paints text black. Write `text-[1rem]` instead.
        base: '#000000', //        canvas-night
        surface: '#0a0a0a', //     canvas-night-soft
        raised: '#101012', //      menus and dialogs, lifted just off the canvas
        overlay: '#151517', //     hover fills, chips
        line: '#232326', //        internal dividers: hairline-on-dark at ~60%
        'line-strong': '#3a3a3f', // hairline-on-dark
        cool: '#f0f0fa', //        canvas-cool: filled-button fill, ghost hover

        // Text.
        ink: '#ffffff', //         on-primary
        'ink-dim': '#c4c4cc',
        'ink-faint': '#86868f',

        // "Accent". There is no brand accent: it is white, stepped down.
        primary: {
          DEFAULT: '#ffffff',
          soft: '#1b1b1f',
          dim: '#8a8a93',
          bright: '#f0f0fa',
        },

        // Status. Muted, and always paired with a word or an icon.
        good: { DEFAULT: '#3fd49b', soft: '#0a1a14' },
        warn: { DEFAULT: '#e8ac4a', soft: '#1c1507' },
        bad: { DEFAULT: '#f0706f', soft: '#220e0e' },
        info: { DEFAULT: '#d2d2e6', soft: '#111114' },
      },
      fontFamily: {
        // D-DIN is the brand face. Where it is not installed, Barlow is the
        // closest free DIN-style cut; Inter and Arial are the last resorts.
        sans: ['"D-DIN"', 'Barlow', 'Inter', 'Arial', 'Verdana', 'sans-serif'],
        display: [
          '"D-DIN-Bold"',
          '"Barlow Semi Condensed"',
          '"D-DIN"',
          'Barlow',
          '"Arial Narrow"',
          'Arial',
          'sans-serif',
        ],
        // The brand has no monospace. Telemetry numerals use the same face with
        // tabular figures (see index.css) so columns still line up.
        mono: ['"D-DIN"', 'Barlow', 'Inter', 'Arial', 'Verdana', 'sans-serif'],
        // For the few places that really are fixed-column text: element-set
        // lines, JSON, stack traces.
        code: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        // Type scale from the design system.
        cap: ['0.8125rem', { lineHeight: '1', letterSpacing: '0.09em', fontWeight: '700' }],
        micro: ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.08em' }],
        'display-lg': ['3rem', { lineHeight: '1.25', letterSpacing: '0.02em', fontWeight: '700' }],
        'display-xl': ['3.75rem', { lineHeight: '1.2', letterSpacing: '0.02em', fontWeight: '700' }],
        'display-xxl': ['5rem', { lineHeight: '0.95', letterSpacing: '0.02em', fontWeight: '700' }],
      },
      letterSpacing: {
        cap: '0.09em', //     button-cap, 1.17px at 13px
        micro: '0.08em', //   micro-cap, 0.96px at 12px
        display: '0.02em', // display tiers, 1.6px at 80px
      },
      borderRadius: {
        // xs 4px for inputs and panels, 32px for the signature pill.
        card: '0.25rem',
        md: '0.25rem',
        pill: '2rem',
      },
      // Elevation is photographic, not a shadow. The tokens stay so a stray
      // class resolves, but they draw nothing.
      boxShadow: {
        panel: 'none',
        pop: 'none',
        glow: 'none',
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
