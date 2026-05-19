/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0F0F12",
        secondary: "#1E1E24",
        accent: "#2563EB",
        danger: "#EF4444",
        success: "#22C55E",
      },
    },
  },
  corePlugins: {
    aspectRatio: false,
  },
  plugins: [],
};
