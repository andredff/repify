/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts,scss}"],
  theme: {
    extend: {
      colors: {
        bg:        "#080C10",
        card:      "#0E151D",
        "card-2":  "#131C26",
        border:    "#1A2535",
        "border-2":"#243040",
        primary:   "#00FF88",
        "primary-dim": "#00FF8822",
        secondary: "#00C2FF",
        danger:    "#FF3D5A",
        muted:     "#4A5568",
        "text-2":  "#8896A8",
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow:      "0 0 24px #00FF8830",
        "glow-sm": "0 0 12px #00FF8820",
        "glow-lg": "0 0 48px #00FF8840",
        card:      "0 4px 24px #00000060",
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        "grid-lines": "linear-gradient(#1A253508 1px, transparent 1px), linear-gradient(90deg, #1A253508 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "32px 32px",
      },
      keyframes: {
        "slide-up":   { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in":    { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-ring": { "0%,100%": { opacity: "0.4", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.05)" } },
        "bar-grow":   { from: { width: "0%" }, to: {} },
        "shimmer":    { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        "check-pop":  { "0%": { transform: "scale(0) rotate(-10deg)" }, "60%": { transform: "scale(1.2) rotate(3deg)" }, "100%": { transform: "scale(1) rotate(0deg)" } },
      },
      animation: {
        "slide-up":   "slide-up 0.4s ease both",
        "fade-in":    "fade-in 0.3s ease both",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "bar-grow":   "bar-grow 1s ease both",
        "shimmer":    "shimmer 2s linear infinite",
        "check-pop":  "check-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};
