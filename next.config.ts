import type { NextConfig } from "next";

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

  // Sin telemetría hacia terceros.
  typedRoutes: true,
};

export default nextConfig;
