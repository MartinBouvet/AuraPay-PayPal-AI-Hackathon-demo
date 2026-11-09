import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1915",
        paper: "#f3efe6",
        foam: "#faf7f2",
        line: "#e4dccb",
        gold: "#9a5b16",
        pine: "#1d5a48",
        clay: "#8e3a2f",
        mist: "#6d675e",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sheet: "0 1px 0 rgba(28, 25, 21, 0.04), 0 18px 40px rgba(28, 25, 21, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
