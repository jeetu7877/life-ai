/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        jeet: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Primary Accent Orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          dark: '#0a0a0c',
          card: '#121216',
          border: '#24242e',
          muted: '#8e8ea0'
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'ripple': 'ripple 1.5s infinite cubic-bezier(0, 0.2, 0.8, 1)',
        'wave': 'waveBar 1.2s infinite ease-in-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 25px rgba(249, 115, 22, 0.4)' },
          '50%': { transform: 'scale(1.06)', boxShadow: '0 0 45px rgba(249, 115, 22, 0.75)' },
        },
        ripple: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        waveBar: {
          '0%, 100%': { height: '8px' },
          '50%': { height: '32px' },
        }
      }
    },
  },
  plugins: [],
}
