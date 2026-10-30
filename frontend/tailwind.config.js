/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: '#F3EFEA',
          sidebar: '#ECE7E1',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E8E2D9',
          'border-subtle': '#F0ECE6',
          muted: '#E4DFD7',
          pill: '#EFEBE5',
          'pill-active': '#FFFFFF',
          active: '#DDD8CF',
        },
        dark: {
          bg: '#151311',
          sidebar: '#1C1916',
          surface: '#221F1B',
          card: '#24201C',
          border: '#35302A',
          'border-subtle': '#2B2621',
          muted: '#2E2924',
          pill: '#2D2823',
          'pill-active': '#39332D',
          active: '#403932',
        },
        ink: {
          primary: '#2A2420',
          secondary: '#7A726B',
          muted: '#9E968F',
          light: '#BAAE9F',
        },
        'dark-ink': {
          primary: '#EDE8E1',
          secondary: '#ABA197',
          muted: '#7F766C',
          light: '#5B544C',
        },
        verdict: {
          verified: {
            text: '#1E6B3C',
            bg: '#EAF5ED',
            border: '#BDE3CA',
          },
          notverified: {
            text: '#9A6218',
            bg: '#FEF7EC',
            border: '#F7DFC0',
          },
          failed: {
            text: '#9C2A2A',
            bg: '#FDF2F2',
            border: '#F6C8C8',
          },
          blocked: {
            text: '#5A534D',
            bg: '#F4F1ED',
            border: '#DDD7CF',
          },
          running: {
            text: '#27618D',
            bg: '#EEF5FA',
            border: '#C8E1F3',
          },
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        card: '20px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(42, 36, 32, 0.04), 0 1px 2px rgba(42, 36, 32, 0.02)',
        card: '0 2px 6px rgba(42, 36, 32, 0.03), 0 1px 3px rgba(42, 36, 32, 0.02)',
        elevated: '0 8px 24px rgba(42, 36, 32, 0.06)',
      },
    },
  },
  plugins: [],
};
