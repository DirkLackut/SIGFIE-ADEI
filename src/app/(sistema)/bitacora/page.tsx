import type { Metadata } from "next";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { bitacora, type FiltrosBitacora, type RegistroBitacora } from "@/datos/consultas";
import { Alerta, Seccion, Tabla, TituloPagina, claseBoton } from "@/componentes/ui";
import { Selector } from "@/componentes/campos";
import { CampoFecha } from "@/componentes/ui-cliente";
import { Desplegable } from "@/componentes/movimiento";
import { Paginacion } from "@/componentes/paginacion";
import { fechaHora } from "@/dominio/formato";

export const metadata: Metadata = { title: "Bitácora · SIGFIE-ADEI" };
const CLAVES = ["desde", "hasta", "usuario_id", "tipo_accion", "entidad"] as const;
const TIPOS = ["Consulta", "Creación", "Modificación", "Eliminación", "Acceso", "Denegación", "Incidente"];

/**
 * CE-89 a CE-94: la bitácora, solo para Dirección y solo para leer (RN-15).
 * Cédulas y teléfonos llegan enmascarados desde la base (D37).
 */
export default async function PaginaBitacora({ searchParams }: PageProps<"/bitacora">) {
  await exigirAcceso(["direccion"]);
  const sp = await searchParams;
  const filtros: FiltrosBitacora = {};
  for (const k of CLAVES) if (typeof sp[k] === "string" && sp[k]) filtros[k] = sp[k] as string;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const r = await bitacora(rpcDeSupabase(await clienteSesion()), filtros, pagina);
  const enlace = (n: number) => {
    const q = new URLSearchParams(filtros as Record<string, string>);
    if (n > 1) q.set("pagina", String(n));
    return `/bitacora${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Bitácora" descripcion="Todo lo que se consultó, creó, modificó o eliminó en el sistema. Nadie puede cambiarla ni borrarla." />
      <Seccion titulo="Filtros">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CampoFecha nombre="desde" etiqueta="Desde" defaultValue={filtros.desde ?? ""} />
          <CampoFecha nombre="hasta" etiqueta="Hasta" defaultValue={filtros.hasta ?? ""} />
          <Selector nombre="usuario_id" etiqueta="Usuario" vacio="Todos" defaultValue={filtros.usuario_id ?? ""}
            opciones={r.estado === "ok" ? r.usuarios.map((u) => ({ valor: u.id, texto: u.nombre_usuario })) : []} />
          <Selector nombre="tipo_accion" etiqueta="Acción" vacio="Todas" defaultValue={filtros.tipo_accion ?? ""} opciones={TIPOS.map((t) => ({ valor: t, texto: t }))} />
          <Selector nombre="entidad" etiqueta="Qué" vacio="Todo" defaultValue={filtros.entidad ?? ""}
            opciones={r.estado === "ok" ? r.entidades.map((e) => ({ valor: e, texto: e.replace(/_/g, " ") })) : []} />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className={claseBoton("primario")}>Filtrar</button>
          </div>
        </form>
      </Seccion>
      {r.estado === "denegado" && <Alerta tipo="cuidado">La bitácora la consulta solo Dirección.</Alerta>}
      {r.estado === "criterios_invalidos" && <Alerta tipo="cuidado" titulo="Revise los filtros">{r.mensaje}</Alerta>}
      {r.estado === "error" && <Alerta tipo="cuidado">{r.mensaje}</Alerta>}
      {r.estado === "ok" && (
        <Seccion titulo={`${r.total.toLocaleString("en-US")} ${r.total === 1 ? "registro" : "registros"}`}>
          <Tabla vacio="0 registros con estos filtros."
            columnas={[{ titulo: "Fecha y hora" }, { titulo: "Usuario" }, { titulo: "Acción" }, { titulo: "Qué" }, { titulo: "Detalle" }]}
            filas={r.filas.map((f) => [<span key="f" className="whitespace-nowrap">{fechaHora(f.fecha_hora)}</span>, f.usuario ?? "—",
              <span key="t" className={f.tipo_accion === "Incidente" || f.tipo_accion === "Denegación" ? "font-semibold text-dorado-texto" : ""}>{f.tipo_accion}</span>,
              f.entidad.replace(/_/g, " "), <Detalle key="d" f={f} />])} />
          <Paginacion pagina={r.pagina} total={r.total} porPagina={r.por_pagina} enlace={enlace} />
        </Seccion>
      )}
    </div>
  );
}

const valor = (v: unknown) => v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

/** CE-91: en una modificación, solo los campos que cambiaron, con el antes y el después. */
function Detalle({ f }: { f: RegistroBitacora }) {
  return (
    <div className="max-w-xl text-sm">
      {f.detalle && <p className="break-words">{f.detalle}</p>}
      {f.cambios.length > 0 && (
        <Desplegable estilo="boton" titulo={`${f.cambios.length} ${f.cambios.length === 1 ? "campo" : "campos"}`}>
          <table className="tabla text-xs">
            <thead><tr><th>Campo</th>{f.tipo_accion !== "Creación" && <th>Antes</th>}{f.tipo_accion !== "Eliminación" && <th>Después</th>}</tr></thead>
            <tbody>{f.cambios.map((c) => (
              <tr key={c.campo}><td className="font-semibold">{c.campo.replace(/_/g, " ")}</td>
                {f.tipo_accion !== "Creación" && <td className="break-all">{valor(c.anterior)}</td>}
                {f.tipo_accion !== "Eliminación" && <td className="break-all">{valor(c.nuevo)}</td>}</tr>
            ))}</tbody>
          </table>
        </Desplegable>
      )}
    </div>
  );
}
