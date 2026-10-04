/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '420px',
      },
      colors: {
        life: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#00A8FF', // Primary Futuristic Blue
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          cyan: '#00D9FF',
          purple: '#8B5CF6',
          pink: '#C026D3',
          bg: '#05070B',
          bgSecondary: '#0A0F18',
          card: '#101722',
          cardElevated: '#141C28',
          border: '#202B3D',
          muted: '#94A3B8'
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'ripple': 'ripple 1.5s infinite cubic-bezier(0, 0.2, 0.8, 1)',
        'wave': 'waveBar 1.2s infinite ease-in-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 30px rgba(0, 217, 255, 0.35)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 55px rgba(139, 92, 246, 0.6)' },
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
