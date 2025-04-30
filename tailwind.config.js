// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          serif: ['"Source Serif Pro"', 'serif'],
          display: ['"Playfair Display"', 'serif'],
        },
        colors: {
          stone: {
            50: '#fafaf9',
            100: '#f5f5f4',
            200: '#e7e5e4',
            300: '#d6d3d1',
            400: '#a8a29e',
            500: '#78716c',
            600: '#57534e',
            700: '#44403c',
            800: '#292524',
            900: '#1c1917',
          },
        },
      },
    },
    plugins: [
      require('@tailwindcss/typography'),
    ],
  }