import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { historialAcademico } from "@/datos/consultas";
import { Alerta } from "@/componentes/ui";
import { HojaImpresa, TABLA_IMPRESA } from "@/componentes/impreso";
import { celdaParcial, LEYENDA } from "@/dominio/acta-impresa";
import { estadoEnPalabras, fechaHoraArchivo } from "@/dominio/exportacion";
import { paginar } from "@/dominio/impresion";
import { esUuid, fecha, hora } from "@/dominio/formato";
import { formatoMonto } from "@/dominio/factura";
import { BotonImprimir } from "../../../../actas/[id]/imprimir/boton";

export const metadata: Metadata = { title: "Historial académico · SIGFIE-ADEI" };
const POR_HOJA = 18;

/** CE-43: el historial para imprimir (plan §5c), con el encabezado del acta. */
export default async function PaginaImprimirHistorial({ params }: PageProps<"/estudiantes/[id]/historial/imprimir">) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const h = await historialAcademico(rpcDeSupabase(await clienteSesion()), id);
  if (h.estado === "no_existe") notFound();
  const volver = `/estudiantes/${id}` as Route;
  if (h.estado !== "ok") return (
    <div className="mx-auto max-w-2xl space-y-3 p-6">
      <Alerta tipo="cuidado">{h.estado === "denegado" ? "El historial es para la Asistente de Dirección y para Dirección." : h.mensaje}</Alerta>
      <Link href={volver} className="text-sm font-semibold text-azul hover:underline">← Volver al expediente</Link>
    </div>
  );
  const e = h.estudiante;
  const hojas = paginar(h.inscripciones, POR_HOJA);
  const pie = `${e.codigo_adei} · Generado el ${fechaHoraArchivo(new Date().toISOString())} por ${estado.nombre_usuario} · ${LEYENDA}`;
  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[279mm] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href={volver} className="text-sm font-semibold text-azul hover:underline">← Volver al expediente</Link>
        <BotonImprimir />
      </div>
      {hojas.map((filas, n) => (
        <HojaImpresa key={n} titulo="HISTORIAL ACADÉMICO" numero={n + 1} de={hojas.length} pie={pie}>
          <dl className="mb-3 grid grid-cols-[auto_1fr_auto_1fr_auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-bold">Estudiante:</dt><dd>{e.apellidos}, {e.nombres}</dd>
            <dt className="font-bold">Código:</dt><dd className="font-mono">{e.codigo_adei}</dd>
            <dt className="font-bold">Cédula:</dt><dd className="font-mono">{e.cedula ?? "sin registro"}</dd>
            <dt className="font-bold">Sucursal:</dt><dd>{e.sucursal}</dd>
            <dt className="font-bold">Estado:</dt><dd>{e.estado_matricula}{e.fecha_cambio_estado ? ` desde ${fecha(e.fecha_cambio_estado)}` : ""}</dd>
            <dt className="font-bold">Niveles:</dt><dd>{h.inscripciones.length}</dd>
          </dl>
          {h.inscripciones.length === 0 ? <p className="py-6 text-center text-[11pt]">Sin niveles cursados.</p> : (
            <table className={TABLA_IMPRESA}>
              <thead><tr><th>N.º</th><th>Grupo</th><th>Nivel</th><th>Horario</th><th>Profesor</th><th>Sucursal</th><th>Inicio</th><th>Término</th>
                <th>I</th><th>II</th><th>III</th><th>Final</th><th>Estado</th><th>Factura</th></tr></thead>
              <tbody>
                {filas.map((i, k) => {
                  const rep = i.estado_academico === "Reprobado";
                  return (
                    <tr key={i.id}>
                      <td className="cifra">{n * POR_HOJA + k + 1}</td><td className="font-mono">{i.codigo_grupo}</td><td>{i.nivel}</td>
                      <td className="whitespace-nowrap">{i.modalidad} {hora(i.hora_inicio)}</td><td>{i.profesor}</td><td>{i.sucursal}</td>
                      <td>{fecha(i.fecha_inicio)}</td><td>{fecha(i.fecha_termino)}</td>
                      {[1, 2, 3].map((x) => <td key={x} className="cifra text-center">{celdaParcial(i.parciales.find((p) => p.numero === x))}</td>)}
                      <td className={`cifra text-center font-bold ${rep ? "text-reprobado" : ""}`}>{i.nota_final ?? ""}{i.estado_academico === "Condicionado" ? " C" : ""}</td>
                      <td className={rep ? "text-reprobado" : ""}>{estadoEnPalabras(i.estado_academico, i.provisional) || i.estado_inscripcion}</td>
                      <td>{i.factura ? `${i.factura.serie}-${i.factura.numero} · ${formatoMonto(Number(i.factura.monto), i.factura.moneda)}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </HojaImpresa>
      ))}
    </>
  );
}
