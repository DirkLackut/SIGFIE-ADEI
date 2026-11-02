import type { Metadata } from "next";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Alerta, Insignia, Seccion, Tabla, TituloPagina } from "@/componentes/ui";
import { fecha } from "@/dominio/formato";
import { EliminarRegla, FormularioRegla } from "./cliente";

export const metadata: Metadata = { title: "Regla de aprobación · SIGFIE-ADEI" };

type Regla = {
  id: string; programa: string; nivel_desde: number; nivel_hasta: number; vigente_desde: string;
  nota_minima: number; condicionado_desde: number | null; nota_condicion: number | null; provisional: boolean;
};

const niveles = (r: Regla) => r.nivel_hasta >= 99 ? (r.nivel_desde === 1 ? "Todos" : `${r.nivel_desde} en adelante`)
  : r.nivel_desde === r.nivel_hasta ? String(r.nivel_desde) : `${r.nivel_desde} a ${r.nivel_hasta}`;
const franja = (r: Regla) => r.condicionado_desde === null ? "Sin Condicionado"
  : `${r.condicionado_desde} a ${r.nota_minima - 1}; exige ${r.nota_condicion} en el siguiente`;

/**
 * 002·CE-20, CE-24 a CE-28, CE-58: la regla de aprobación. La Asistente la registra;
 * Dirección la consulta. Un grupo se evalúa con la regla vigente en su fecha de inicio.
 */
export default async function PaginaReglas() {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const asistente = estado.roles.includes("asistente");
  const { data } = await (await clienteSesion()).from("regla_aprobacion").select("*")
    .order("programa").order("vigente_desde", { ascending: false }).order("nivel_desde");
  const reglas = (data ?? []) as Regla[];

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Regla de aprobación"
        volver={asistente ? { href: "/catalogos", texto: "Catálogos" } : undefined}
        descripcion="La nota mínima depende del programa y del nivel. Cada grupo se evalúa con la regla vigente en su fecha de inicio; si se corrige una regla provisional, cambia el estado de todos los grupos evaluados con ella." />
      {reglas.some((r) => r.provisional) && (
        <Alerta tipo="cuidado" titulo="Hay valores provisionales">
          Son los que la academia todavía no confirmó. Los estados calculados con ellos pueden cambiar cuando se corrijan.
        </Alerta>
      )}
      {asistente && <Seccion titulo="Agregar regla"><FormularioRegla boton="Agregar regla" /></Seccion>}
      <Tabla resumen={`${reglas.length} reglas`} vacio="No hay reglas: el estado académico queda Pendiente hasta registrar una."
        columnas={[{ titulo: "Programa" }, { titulo: "Niveles" }, { titulo: "Vigente desde" }, { titulo: "Aprueba con", derecha: true },
                   { titulo: "Condicionado" }, { titulo: "" }, ...(asistente ? [{ titulo: "" }] : [])]}
        filas={reglas.map((r) => [r.programa, niveles(r), fecha(r.vigente_desde), r.nota_minima, franja(r),
          r.provisional ? <Insignia key="p" color="dorado">Provisional</Insignia> : <Insignia key="p" color="verde">Confirmada</Insignia>,
          ...(asistente ? [r.provisional ? (
            <div key="a" className="flex flex-wrap items-start gap-2">
              <details><summary className="inline-flex min-h-8 cursor-pointer items-center rounded-md px-2.5 text-xs font-semibold text-azul hover:bg-marino-suave">Corregir</summary>
                <div className="desplegable mt-2 min-w-80"><FormularioRegla boton="Guardar corrección" valores={{
                  id: r.id, programa: r.programa, nivel_desde: String(r.nivel_desde), nivel_hasta: String(r.nivel_hasta),
                  vigente_desde: r.vigente_desde, nota_minima: String(r.nota_minima),
                  condicionado_desde: r.condicionado_desde === null ? "" : String(r.condicionado_desde), provisional: r.provisional }} /></div>
              </details>
              <EliminarRegla id={r.id} nombre={`${r.programa} ${niveles(r)}`} />
            </div>
          ) : <span key="a" className="text-xs text-tinta-suave">Para cambiarla, agregue otra con fecha posterior</span>] : [])])} />
    </div>
  );
}
