/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff8e6',
          100: '#ffefc0',
          200: '#ffe399',
          300: '#ffd466',
          400: '#fbc433',
          500: '#FAAF1D', // Brand Yellow
          600: '#d4920f',
          700: '#a7710a',
          800: '#7a5206',
          900: '#341E0D', // Dark Coffee
        },
        dark: {
          900: '#181b1d', // Slightly deeper black-carbon
          800: '#202528', // Carbon Black
          700: '#282e32',
          600: '#31383d',
          500: '#465057',
          400: '#5c6972',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #FAAF1D 0%, #341E0D 100%)',
        'gradient-dark': 'linear-gradient(180deg, #202528 0%, #181b1d 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(32, 37, 40, 0.9) 0%, rgba(24, 28, 30, 0.7) 100%)',
      },
      boxShadow: {
        'glow-brand': '0 0 20px rgba(250, 175, 29, 0.35)',
        'glow-orange': '0 0 25px rgba(250, 175, 29, 0.25)',
        'glow-green': '0 0 20px rgba(16,185,129,0.25)',
        'glow-red': '0 0 20px rgba(239,68,68,0.25)',
        'card': '0 10px 40px -10px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.8s infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
