import { CampoFecha } from "./ui-cliente";
import { claseBoton } from "./ui";
import type { ReactNode } from "react";

/** Período de un panel o reporte (003·CE-76, CE-83): GET, así la dirección lo guarda. */
export function FormularioPeriodo({ desde, hasta, extra }: { desde: string; hasta: string; extra?: ReactNode }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="w-44"><CampoFecha nombre="desde" etiqueta="Desde" requerido defaultValue={desde} /></div>
      <div className="w-44"><CampoFecha nombre="hasta" etiqueta="Hasta" requerido defaultValue={hasta} /></div>
      {extra}
      <button type="submit" className={claseBoton("primario")}>Ver</button>
    </form>
  );
}

/** Una cifra grande con su nombre. El número siempre escrito (003·CE-87). */
export function Cifra({ nombre, valor, aviso = false }: { nombre: string; valor: number; aviso?: boolean }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${aviso && valor > 0 ? "border-dorado/50 bg-dorado-suave" : "border-borde bg-papel"}`}>
      <p className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">{nombre}</p>
      <p className={`cifra text-2xl font-bold ${aviso && valor > 0 ? "text-dorado-texto" : "text-marino"}`}>{valor.toLocaleString("en-US")}</p>
    </div>
  );
}
