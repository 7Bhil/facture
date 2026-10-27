/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aglNavy: '#102C57',
        aglNavyLight: '#16407B',
        aglGreen: '#0D7C66',
        aglOrange: '#E65100'
      }
    },
  },
  plugins: [],
}
