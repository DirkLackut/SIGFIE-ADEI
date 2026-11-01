import type { NextConfig } from "next";
import { ENCABEZADOS_FIJOS } from "./src/dominio/seguridad";

const nextConfig: NextConfig = {
  // Caché de componentes y prefetch parcial vienen activados en la plantilla de
  // Next 16. Se desactivan a propósito: cada pantalla de este sistema muestra
  // datos de un usuario concreto, filtrados por su organización y su rol. Una
  // respuesta reutilizada entre usuarios sería una fuga de datos de estudiantes,
  // incluidos menores de edad (constitución, principio 3).
  cacheComponents: false,
  partialPrefetching: false,

  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },

  // Encabezados de seguridad (CE-103, hallazgo A02 de T34). La CSP, que lleva un
  // nonce por respuesta, la pone proxy.ts. Sin «X-Powered-By: Next.js».
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: ENCABEZADOS_FIJOS }];
  },

  // Sin telemetría hacia terceros.
  typedRoutes: true,
};

export default nextConfig;
