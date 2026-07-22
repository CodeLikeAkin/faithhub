/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
      },
      /* Type scale — the single source of truth for font sizes.
         Values mirror Tailwind's defaults (incl. line-heights) so existing
         text-xs/sm/base/... usages are unchanged. Rules for this codebase:
         - 12px floor: no readable text below text-xs (12px). Don't reintroduce
           arbitrary text-[9px]/text-[10px]/etc.
         - 16px input floor: any <input>/<textarea> must be >= text-base (16px)
           or iOS Safari focus-zooms the page on tap.
         Prefer these named steps over arbitrary text-[Npx] values. */
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],       /* 12px — smallest readable / mobile floor */
        sm: ["0.875rem", { lineHeight: "1.25rem" }],   /* 14px */
        base: ["1rem", { lineHeight: "1.5rem" }],      /* 16px — input floor */
        lg: ["1.125rem", { lineHeight: "1.75rem" }],   /* 18px */
        xl: ["1.25rem", { lineHeight: "1.75rem" }],    /* 20px */
        "2xl": ["1.5rem", { lineHeight: "2rem" }],     /* 24px */
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],/* 30px */
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],  /* 36px */
        "5xl": ["3rem", { lineHeight: "1" }],          /* 48px */
        "6xl": ["3.75rem", { lineHeight: "1" }],       /* 60px */
        "7xl": ["4.5rem", { lineHeight: "1" }],        /* 72px */
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* HOF NG brand palette — hofng.org is the source of truth */
        brand: {
          navy: "#173A68",  /* primary — the logo blue */
          deep: "#102A4E",  /* darker blue for overlays/hover */
          ink: "#17233B",   /* heading text */
          sky: "#EAF2FB",   /* light blue tint surface */
          mist: "#C6DAEE",  /* deeper tint for gradients */
          green: "#489E3E", /* secondary — rare accents only */
          gray: "#7A7A7A",  /* body text */
          light: "#F8F9FA",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
