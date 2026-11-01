import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000, // las pruebas de base levantan PGlite
    // Cada archivo arma su banco en beforeAll; con todos los archivos a la vez, en
    // una PC más lenta eso pasa de los 10 s por defecto.
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/apoyo/vacio.ts", import.meta.url)),
    },
  },
});
