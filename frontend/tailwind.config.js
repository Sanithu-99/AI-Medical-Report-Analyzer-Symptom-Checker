/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "sea-salt": "#f8fbff",
        "sky": "#e5f0ff",
        "ocean": "#1f3b57",
        "ocean-light": "#3f6ea1",
        "teal": "#34b3a0",
        "sand": "#d8e4f5",
      },
      boxShadow: {
        soft: "0 24px 48px -24px rgba(15, 39, 57, 0.25)",
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
