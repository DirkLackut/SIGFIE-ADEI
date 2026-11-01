import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { ProveedorMovimiento } from "@/componentes/movimiento";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGFIE-ADEI",
  description:
    "Sistema de Gestión y Filtrado de Información Estudiantil — Academia de Enseñanza en Inglés ADEI",
};

/** Barra del navegador del celular en el marino de ADEI. */
export const viewport: Viewport = { themeColor: "#03214c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Cada página se genera al pedirla (nunca prearmada): así lleva el nonce de su
  // CSP (CE-102). Las pantallas de este sistema ya eran dinámicas por la sesión.
  await connection();
  return (
    <html lang="es-NI" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ProveedorMovimiento>{children}</ProveedorMovimiento>
      </body>
    </html>
  );
}
