import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070A0F",
        surface: "#0B1220",
        surface2: "#0F1A2D",
        border: "rgba(255,255,255,0.08)",
        primary: "#F4F7FF",
        secondary: "rgba(244,247,255,0.70)",
        muted: "rgba(244,247,255,0.45)",
        accent: {
          DEFAULT: "#5EE7FF", // Cyan
          blue: "#7AA7FF", // Arctic Blue
        },
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(90deg, #5EE7FF 0%, #7AA7FF 100%)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '24px',
        '3xl': '32px',
      }
    },
  },
  plugins: [typography],
};
export default config;
