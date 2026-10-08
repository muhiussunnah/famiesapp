/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-satoshi)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-satoshi)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand (only two). DEFAULT / 500 / secondary DEFAULT read CSS
        // variables so /admin/theme can recolor the site without a deploy
        // (defaults live in globals.css :root).
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          50:  '#fff4f8',
          100: '#ffe1ec',
          200: '#ffc6d7',
          300: '#ffa8c0',
          400: '#ff8faf',
          500: 'rgb(var(--color-primary-hover-rgb) / <alpha-value>)',
          600: '#ef4f7f',
          700: '#c73d67',
          800: '#9a2e50',
          900: '#6e223a',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
          50:  '#f4fef6',
          100: '#e9fdef',
          200: '#ccfad6',
          300: '#a8f0ba',
          400: '#85e29c',
          500: '#62d180',
          600: '#45b566',
          700: '#358e50',
          800: '#286a3c',
          900: '#1c4c2b',
        },
        ink: {
          50:  '#faf9fc',
          100: '#efecf2',
          200: '#d8d3e0',
          300: '#b4afc1',
          500: '#615c72',
          700: '#2b2540',
          900: '#0c0a13',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'pink': '0 20px 60px -20px rgba(255, 143, 175, 0.45)',
        'mint': '0 20px 60px -20px rgba(168, 240, 186, 0.55)',
        'soft': '0 12px 40px -12px rgba(12, 10, 19, 0.08)',
        'glow-pink': '0 0 48px 0 rgba(255, 143, 175, 0.5)',
      },
      backgroundImage: {
        'grid': "linear-gradient(to right, rgba(12,10,19,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,10,19,0.04) 1px, transparent 1px)",
        'radial-pink': 'radial-gradient(ellipse at center, rgba(255,143,175,0.45) 0%, transparent 65%)',
        'radial-mint': 'radial-gradient(ellipse at center, rgba(204,250,214,0.55) 0%, transparent 65%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.8s ease-out both',
        'scale-in': 'scale-in 0.6s ease-out both',
        'wiggle': 'wiggle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
