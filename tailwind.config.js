/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2d6a4f',
          strong: '#1f4f3b',
        },
        accent: {
          DEFAULT: '#f2e6cb',
          cream: '#f9f4e7',
        },
        muted: '#576353',
        danger: '#8f1d1d',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
      },
    },
  },
  plugins: [],
}
