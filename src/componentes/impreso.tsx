import type { ReactNode } from "react";
import { Emblema } from "./ui";

/**
 * Hoja de un impreso de la spec 003 sin formato en papel (listado, historial;
 * plan §5c). Usa el encabezado del acta (emblema a la izquierda, «Academia de
 * Enseñanza en Inglés», título en mayúsculas) y «Hoja N de M» al pie.
 */
export function HojaImpresa({ titulo, numero, de, pie, horizontal = true, children }: {
  titulo: string; numero: number; de: number; pie?: ReactNode; horizontal?: boolean; children: ReactNode;
}) {
  const tam = horizontal ? "hoja-horizontal min-h-[215.9mm] max-w-[279.4mm]" : "min-h-[279mm] max-w-[216mm]";
  return (
    <article className={`hoja ${tam} relative mx-auto mb-6 flex flex-col overflow-hidden border border-borde bg-papel px-[12mm] py-[10mm] text-[9pt] text-tinta`}>
      <header className="flex items-center gap-5 border-b-2 border-marino pb-2">
        <Emblema className="size-[17mm] text-marino" titulo="Emblema de ADEI" />
        <div className="flex-1">
          <p className="font-titulo text-[13pt] font-bold leading-tight text-marino">Academia de Enseñanza en Inglés</p>
          <p className="font-titulo text-[10pt] leading-tight text-marino">English Teaching Academy</p>
        </div>
        <h1 className="font-titulo text-[12pt] font-bold tracking-wide text-marino">{titulo}</h1>
      </header>
      <div className="mt-3 flex-1">{children}</div>
      <footer className="mt-3 flex flex-wrap justify-between gap-2 border-t border-borde pt-1.5 text-[7.5pt] text-tinta-suave">
        <span>{pie}</span>
        <span>Hoja {numero} de {de}</span>
      </footer>
    </article>
  );
}

/** Estilos de la tabla de un impreso: bordes finos, encabezado marino. Los códigos y
 *  las fechas no se parten (cada fila ocupa lo menos posible, hallazgo 1 de T23). */
export const TABLA_IMPRESA = "w-full border-collapse text-[8pt] leading-tight [&_th]:border [&_th]:border-tinta [&_th]:bg-marino-suave [&_th]:px-1 [&_th]:py-0.5 [&_th]:text-left [&_th]:align-bottom [&_td]:border [&_td]:border-borde [&_td]:px-1 [&_td]:py-0.5 [&_td]:align-top [&_td.font-mono]:whitespace-nowrap [&_td.fecha]:whitespace-nowrap";
