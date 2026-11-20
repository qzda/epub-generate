import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: {
    watch: {
      // 覆盖率报告是测试产物，不应触发开发服务器热更新。
      ignored: ["**/coverage/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 所有第三方依赖统一进 vendor，业务代码仍按入口拆分。
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
