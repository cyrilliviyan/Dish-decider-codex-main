import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        leaf: "#26734d",
        saffron: "#d97706",
        linen: "#faf7f0"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 33, 28, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
