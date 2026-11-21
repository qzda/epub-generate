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
      "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-studio-line bg-[var(--panel)] text-studio-text text-[13px] font-700 whitespace-nowrap",
      "cursor-pointer select-none shadow-[0_8px_20px_-18px_rgba(21,34,56,0.4)]",
      "transition-[background-color,border-color,transform,box-shadow,filter] duration-150",
      "hover:shadow-[0_14px_28px_-20px_rgba(21,34,56,0.55)] active:translate-y-[1px]",
    ],
    "btn-primary": [
      "border-transparent bg-[linear-gradient(135deg,#3b76ff,#2453d8)] text-white",
      "shadow-[0_14px_26px_-14px_rgba(47,99,233,0.85)] hover:brightness-105 active:brightness-95",
    ],
    "btn-disable": ["cursor-not-allowed opacity-60"],
    "studio-shell": "min-h-full text-studio-text bg-studio-bg",
    "studio-panel":
      "bg-[var(--panel)] border border-studio-line rounded-[16px] overflow-hidden shadow-[0_18px_44px_-40px_rgba(21,34,56,0.42)]",
    "studio-input":
      "w-full h-[40px] px-3 rounded-[10px] border border-studio-line bg-[var(--panel-muted)] text-studio-text text-[13px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-studio-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
    "studio-textarea":
      "w-full min-h-[168px] px-3 py-2 rounded-[11px] border border-studio-line bg-[var(--panel-muted)] text-studio-text text-[12px] leading-[1.7] font-mono outline-none resize-y transition-[border-color,box-shadow] duration-150 focus:border-studio-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
    "studio-label": "text-[12px] font-600 text-studio-muted",
    "studio-note": "m-0 text-[11px] leading-[1.5] text-studio-muted",
    "studio-panel-head":
      "flex justify-between items-center gap-3 px-5 py-4 border-b border-studio-line",
    "studio-panel-body": "overflow-auto p-5 min-h-[320px] md:min-h-[430px]",
    "studio-empty-shell":
      "min-h-[340px] border border-dashed border-studio-line rounded-[18px] grid place-content-center text-center gap-2 text-studio-muted bg-[var(--panel)]",
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
