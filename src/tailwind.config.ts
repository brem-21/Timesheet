import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: "#1e1e2e",
          hover: "#2a2a3e",
          active: "#3b3b5c",
          text: "#a0a0b8",
          "text-active": "#ffffff",
        },
        brand: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          light: "#e0e7ff",
        },
        status: {
          done: "#10b981",
          "in-progress": "#3b82f6",
          review: "#f59e0b",
          todo: "#6b7280",
          blocked: "#ef4444",
        },
        priority: {
          high: "#ef4444",
          medium: "#f97316",
          low: "#6b7280",
          highest: "#b91c1c",
          lowest: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
