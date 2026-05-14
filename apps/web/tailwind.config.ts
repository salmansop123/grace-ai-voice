import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bgBase: "var(--bg-base)",
        bgSurface: "var(--bg-surface)",
        bgElevated: "var(--bg-elevated)",
        border: "var(--border)",
        borderStrong: "var(--border-strong)",
        accent: "var(--accent)",
        accentDim: "var(--accent-dim)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)"
      },
      keyframes: {
        "mesh-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(3%, -2%) scale(1.03)" },
          "66%": { transform: "translate(-2%, 3%) scale(0.98)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.75" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "glow-shift": {
          "0%, 100%": { opacity: "0.35", filter: "hue-rotate(0deg)" },
          "50%": { opacity: "0.55", filter: "hue-rotate(8deg)" }
        }
      },
      animation: {
        "mesh-drift": "mesh-drift 22s ease-in-out infinite",
        "pulse-soft": "pulse-soft 8s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        "glow-shift": "glow-shift 10s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
