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
        teal: {
          DEFAULT: "#1c5d5f",
          deep: "#1c5d5f",
          pine: "#0e4749",
          sage: "#65b8a2",
          lake: "#2a7779",
          forest: "#156152",
        },
        navy: "#16325a",
        rose: "#d6aec1",
        mint: {
          DEFAULT: "#e4f0f1",
          mist: "#a2cbcd",
          foam: "#cae1e2",
        },
        blush: "#f2e8e2",
        paper: "#f2f8f7",
        charcoal: "#283338",
        slate: "#333333",
        soft: {
          black: "#1a1a1a",
        },
        ink: "#231e21",
      },
      fontFamily: {
        sans: [
          "Inter",
          "DM Sans",
          "Manrope",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: ["Lora", "Source Serif 4", "Crimson Pro", "ui-serif", "Georgia", "serif"],
        mono: [
          "'IBM Plex Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        caption: ["12px", { lineHeight: "1.5", letterSpacing: "0.52px" }],
        "body-sm": ["14px", { lineHeight: "1.43" }],
        body: ["16px", { lineHeight: "1.5" }],
        subheading: ["20px", { lineHeight: "1.4", letterSpacing: "-0.2px" }],
        "heading-sm": ["24px", { lineHeight: "1.38", letterSpacing: "-0.24px" }],
        heading: ["44px", { lineHeight: "1.2" }],
        "heading-lg": ["50px", { lineHeight: "1.16" }],
        display: ["64px", { lineHeight: "1.2" }],
      },
      letterSpacing: {
        eyebrow: "0.045em",
        tightui: "-0.01em",
      },
      spacing: {
        "8": "8px",
        "16": "16px",
        "24": "24px",
        "32": "32px",
        "40": "40px",
        "48": "48px",
        "56": "56px",
        "64": "64px",
        "88": "88px",
        "112": "112px",
      },
      maxWidth: {
        page: "1200px",
      },
      borderRadius: {
        nav: "88px",
        tag: "100px",
        card: "12px",
        pill: "1000px",
        button: "48px",
      },
      boxShadow: {
        none: "none",
        sm: "none",
        DEFAULT: "none",
        md: "none",
        lg: "none",
        xl: "none",
      },
    },
  },
  plugins: [],
};

export default config;
