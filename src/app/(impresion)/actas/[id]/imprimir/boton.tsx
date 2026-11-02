"use client";
import { claseBoton } from "@/componentes/ui";

/** El navegador imprime o guarda en PDF («Guardar como PDF» en el destino). */
export function BotonImprimir() {
  return <button type="button" className={claseBoton("primario")} onClick={() => window.print()}>Imprimir o guardar en PDF</button>;
}
