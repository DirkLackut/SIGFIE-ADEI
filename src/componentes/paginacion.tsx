import Link from "next/link";
import type { Route } from "next";

/**
 * Páginas de un resultado (003·CE-12, como 001·CE-85): el total real y todas las
 * páginas recorribles, sin límite. `enlace(n)` da la dirección de la página n.
 */
export function Paginacion({ pagina, total, porPagina, enlace }: {
  pagina: number; total: number; porPagina: number; enlace: (n: number) => string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas === 1 && pagina === 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const boton = "boton inline-flex min-h-9 items-center rounded-md border border-borde bg-papel px-3 text-sm font-semibold hover:bg-papel-alt";
  return (
    <nav aria-label="Páginas del resultado" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-tinta-suave">
        {pagina > paginas ? `La página ${pagina} no existe: el resultado tiene ${paginas}.`
          : `Mostrando ${desde.toLocaleString("en-US")}–${hasta.toLocaleString("en-US")} de ${total.toLocaleString("en-US")} · página ${pagina} de ${paginas}`}
      </p>
      <div className="flex gap-2">
        {pagina > 1 && <Link className={boton} href={enlace(1) as Route}>« Primera</Link>}
        {pagina > 1 && <Link className={boton} href={enlace(Math.min(pagina - 1, paginas)) as Route}>‹ Anterior</Link>}
        {pagina < paginas && <Link className={boton} href={enlace(pagina + 1) as Route}>Siguiente ›</Link>}
        {pagina < paginas && <Link className={boton} href={enlace(paginas) as Route}>Última »</Link>}
      </div>
    </nav>
  );
}
