/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "soft-gray": "#f5f5f7",
        "silver": "#e1e1e3",
        "midnight": "#1a1a1a",
      },
      boxShadow: {
        soft: "0 20px 40px -20px rgba(15, 23, 42, 0.3)",
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
