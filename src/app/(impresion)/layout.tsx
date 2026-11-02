import { exigirAcceso } from "@/servidor/sesion";

/** Páginas para imprimir (002·CE-50): sin el encabezado ni el menú del sistema,
 *  pero con la misma sesión, el mismo aviso y los mismos permisos. */
export default async function LayoutImpresion({ children }: { children: React.ReactNode }) {
  await exigirAcceso();
  return <div className="min-h-dvh bg-papel-alt print:bg-papel">{children}</div>;
}
