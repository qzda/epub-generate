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
    },
  },
  shortcuts: {
    btn: [
      "cursor-pointer",
      "border rounded",
      "px-4 py-1",
      "shadow-sm hover:shadow-lg active:shadow-sm dark:shadow-gray-800 outline-none",
      "hover:translate-y--0.5 active:translate-y-0",
      "transition-all",
    ],
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
