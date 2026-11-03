import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { panelActas } from "@/datos/consultas";
import { Alerta, Insignia, Seccion, Tabla, TituloPagina } from "@/componentes/ui";
import { Desplegable } from "@/componentes/movimiento";
import { Cifra, FormularioPeriodo } from "@/componentes/periodo";
import { mesEnCurso, describirPeriodo } from "@/dominio/periodo";
import { hoyEnManagua } from "@/dominio/edad";
import { fecha, fechaHora, hora } from "@/dominio/formato";

export const metadata: Metadata = { title: "Entrega de actas · SIGFIE-ADEI" };

/** CE-75 a CE-80: qué profesores entregaron sus actas y cuáles faltan, por período. */
export default async function PaginaPanelActas({ searchParams }: PageProps<"/panel-actas">) {
  await exigirAcceso(["asistente", "direccion"]);
  const sp = await searchParams;
  const mes = mesEnCurso(hoyEnManagua(new Date()));
  const desde = typeof sp.desde === "string" && sp.desde ? sp.desde : mes.desde;
  const hasta = typeof sp.hasta === "string" && sp.hasta ? sp.hasta : mes.hasta;
  const r = await panelActas(rpcDeSupabase(await clienteSesion()), desde, hasta);

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Entrega de actas"
        descripcion="Grupos que terminan en el período, por profesor. «Vencida»: el grupo ya terminó y el acta sigue abierta." />
      <Seccion titulo="Período"><FormularioPeriodo desde={desde} hasta={hasta} /></Seccion>
      {r.estado === "error" && <Alerta tipo="cuidado">{r.mensaje}</Alerta>}
      {r.estado === "incompleto" && <Alerta tipo="cuidado" titulo="Los totales no cuadran">No se muestra el panel. El incidente quedó registrado; intente de nuevo.</Alerta>}
      {r.estado === "denegado" && <Alerta tipo="cuidado">El panel es para la Asistente de Dirección y para Dirección.</Alerta>}
      {r.estado === "ok" && (
        <>
          <section aria-label="Totales del período" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra nombre="Grupos" valor={r.totales.grupos} />
            <Cifra nombre="Entregadas" valor={r.totales.entregadas} />
            <Cifra nombre="Pendientes" valor={r.totales.pendientes} />
            <Cifra nombre="Vencidas" valor={r.totales.vencidas} aviso />
          </section>
          <Seccion titulo={`Por profesor · ${describirPeriodo(r.desde, r.hasta)}`}>
            {r.profesores.length === 0 ? (
              <p className="py-4 text-center text-tinta-suave">Ningún grupo termina en este período.</p>
            ) : (
              <ul className="divide-y divide-borde rounded-md border border-borde">
                {r.profesores.map((p) => (
                  <li key={p.profesor_id} className="px-3 py-2">
                    <Desplegable estilo="boton" titulo={
                      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-semibold">{p.profesor}</span>
                        <span className="cifra text-sm text-tinta-suave">{p.grupos} {p.grupos === 1 ? "grupo" : "grupos"} · {p.entregadas} entregadas · {p.pendientes} pendientes</span>
                        {p.vencidas > 0 && <Insignia color="dorado">{p.vencidas} {p.vencidas === 1 ? "vencida" : "vencidas"}</Insignia>}
                      </span>}>
                      <Tabla vacio="Sin grupos."
                        columnas={[{ titulo: "Grupo" }, { titulo: "Nivel" }, { titulo: "Horario" }, { titulo: "Término" },
                          { titulo: "Acta" }, { titulo: "Entregada el" }, { titulo: "Captura", derecha: true }]}
                        filas={p.detalle.map((g) => [
                          <Link key="g" href={`/grupos/${g.grupo_id}` as Route} className="font-mono text-xs font-semibold text-azul hover:underline">{g.codigo_grupo}</Link>,
                          g.nivel, `${g.modalidad} ${hora(g.hora_inicio)}`, fecha(g.fecha_termino),
                          g.estado_acta === "Entregada" ? <Insignia key="a" color="verde">Entregada</Insignia>
                            : <Insignia key="a" color={g.vencida ? "dorado" : "gris"}>{g.vencida ? "Vencida" : "Abierta"}</Insignia>,
                          g.fecha_entrega_acta ? fechaHora(g.fecha_entrega_acta) : "—",
                          `${g.completas} de ${g.total}`])} />
                    </Desplegable>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </>
      )}
    </div>
  );
}
