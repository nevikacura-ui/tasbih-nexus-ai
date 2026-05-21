/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        deep: "#0F3D36",
        forest: "#123F39",
        gold: "#C9A46A",
        ivory: "#F7F3EC",
        sand: "#E8DFCB",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Inter", "serif"],
      },
      animation: {
        breathe: "breathe 4s ease-in-out infinite",
        "float-up": "float-up 0.6s ease-out both",
        shimmer: "shimmer 3s linear infinite",
        "noor-pulse": "noor-pulse 6s ease-in-out infinite",
      },
      keyframes: {
        breathe: {
          "0%,100%": { transform: "scale(1)", opacity: 0.9 },
          "50%": { transform: "scale(1.05)", opacity: 1 },
        },
        "float-up": {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "noor-pulse": {
          "0%,100%": { opacity: 0.7, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.08)" },
        },
      },
    },
  },
  plugins: [],
};
