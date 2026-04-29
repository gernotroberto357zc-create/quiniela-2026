/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Puedes añadir colores personalizados aquí si quieres
        'mundial-blue': '#0046A8',
        'mundial-red': '#E4002B',
      }
    },
  },
  plugins: [],
}