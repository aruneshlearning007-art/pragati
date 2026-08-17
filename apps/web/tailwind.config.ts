import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        primary: {
          DEFAULT: "var(--color-primary)",
          dark: "var(--color-primary-dark)",
        },
        ink: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
        },
        border: "var(--color-border)",
        mastered: {
          bg: "var(--color-mastered-bg)",
          fg: "var(--color-mastered-fg)",
          dot: "var(--color-mastered-dot)",
        },
        revision: {
          bg: "var(--color-revision-bg)",
          fg: "var(--color-revision-fg)",
          dot: "var(--color-revision-dot)",
        },
        "not-started": {
          bg: "var(--color-notstarted-bg)",
          fg: "var(--color-notstarted-fg)",
          dot: "var(--color-notstarted-dot)",
        },
      },
      fontFamily: {
        heading: ["var(--font-fredoka)", "sans-serif"],
        body: ["var(--font-karla)", "var(--font-noto-devanagari)", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
