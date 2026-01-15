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
    "border-base": ["border border-gray-300 rounded outline-none"],
    "shadow-base": ["shadow-sm  dark:shadow-gray-800 outline-none"],
    btn: [
      "border-base",
      "shadow-base hover:shadow-lg active:shadow-sm",
      "cursor-pointer",
      "px-3 py-1.5",
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
