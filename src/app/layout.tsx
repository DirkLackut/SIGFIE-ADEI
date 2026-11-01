import type { Metadata, Viewport } from "next";
import { ProveedorMovimiento } from "@/componentes/movimiento";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGFIE-ADEI",
  description:
    "Sistema de Gestión y Filtrado de Información Estudiantil — Academia de Enseñanza en Inglés ADEI",
};

/** Barra del navegador del celular en el marino de ADEI. */
export const viewport: Viewport = { themeColor: "#03214c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-NI" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ProveedorMovimiento>{children}</ProveedorMovimiento>
      </body>
    </html>
  );
}
