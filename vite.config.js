import { defineConfig } from "vite";

export default defineConfig({
  base: "/matter-js-playground/",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        map: "map-integration.html",
      },
    },
  },
});
