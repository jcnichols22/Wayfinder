/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#150f26",
        surfaceLight: "#241b3d",
        surfaceInput: "#1c1533",
        borderMuted: "#342a52",
        accent: "#d4af6a",
      },
    },
  },
  plugins: [],
};
