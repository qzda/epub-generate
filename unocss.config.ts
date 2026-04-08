import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetMini,
  presetWind4,
} from "unocss";

export default defineConfig({
  theme: {
    colors: {
      primary: "var(--primary-color)",
      "studio-bg": "var(--background)",
      "studio-line": "var(--border)",
      "studio-text": "var(--foreground)",
      "studio-muted": "var(--muted)",
      "studio-accent": "var(--accent)",
      "studio-accent-soft": "var(--accent-soft)",
    },
  },
  shortcuts: {
    btn: [
      "inline-flex items-center gap-2.5 border rounded-lg font-600 px-3.5 py-2.5",
      "cursor-pointer select-none",
      "transition-[background-color,border-color,transform,box-shadow,opacity] duration-150",
      "hover:shadow-sm active:translate-y-[1px] active:shadow-none",
    ],
    "btn-primary": [
      "border-studio-accent bg-studio-accent text-white",
      "hover:brightness-95 active:brightness-90",
    ],
    "btn-disable": ["cursor-not-allowed opacity-60"],
    "studio-shell":
      "min-h-full text-studio-text p-3 md:p-5 grid gap-4 bg-studio-bg",
    "studio-hero":
      "grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center border border-studio-line rounded-xl p-2.5 md:p-3 bg-[var(--panel)]",
    "studio-panel":
      "border border-studio-line rounded-xl bg-[var(--panel)]",
    "studio-input":
      "w-full border border-studio-line rounded-lg bg-[var(--panel-muted)] text-studio-text px-2.5 py-2.5 outline-none transition-[border-color,box-shadow] duration-150 focus:border-studio-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
    "studio-label": "text-xs text-studio-muted tracking-[0.02em]",
    "studio-note": "m-0 text-xs text-studio-muted",
    "studio-panel-head":
      "flex justify-between items-baseline px-3 py-2.5 border-b border-studio-line",
    "studio-panel-body": "overflow-auto p-[10px_12px] min-h-[320px] md:min-h-[430px]",
    "studio-empty-shell":
      "min-h-[420px] border border-dashed border-studio-line rounded-xl grid place-content-center text-center gap-2 text-studio-muted bg-[var(--panel)]",
  },
  presets: [
    presetMini({
      dark: "media",
    }),
    presetWind4(),
    presetAttributify(),
    presetIcons({
      extraProperties: {
        display: "inline-block",
        height: "1.2em",
        width: "1.2em",
        "vertical-align": "text-bottom",
      },
    }),
  ],
});
