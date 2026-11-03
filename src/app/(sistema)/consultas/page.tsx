import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { catalogoFiltro } from "@/servidor/catalogo-filtro";
import { rpcDeSupabase } from "@/datos/rpc";
import { filtrar } from "@/datos/consultas";
import { Alerta, Insignia, Seccion, Tabla, TituloPagina, claseBoton } from "@/componentes/ui";
import { Paginacion } from "@/componentes/paginacion";
import { desdeDireccion, describirCriterios, haciaDireccion, type EstadoFiltro } from "@/dominio/filtro";
import { estadoEnPalabras, type FilaEstudiante, type FilaInscripcion } from "@/dominio/exportacion";
import { fecha, hora } from "@/dominio/formato";
import { Criterios } from "./criterios";

export const metadata: Metadata = { title: "Consultas · SIGFIE-ADEI" };

const AVISOS_EXPORTACION: Record<string, string> = {
  "sin-registros": "El resultado tiene 0 registros: no hay nada que exportar.",
  incompleto: "No se generó el archivo: el resultado no estaba completo. El incidente quedó registrado; intente de nuevo.",
  error: "No se pudo generar el archivo. Intente de nuevo.",
};

/**
 * CE-1 a CE-30: el filtrado con verificación de completitud, el motivo del
 * proyecto. Los criterios vienen de la dirección (D31); el total y las filas, de
 * una sola operación de la base (D30). Si no cuadran, no se muestra nada (CE-11).
 */
export default async function PaginaConsultas({ searchParams }: PageProps<"/consultas">) {
  await exigirAcceso(["asistente", "direccion"]);
  const sp = await searchParams;
  const e = desdeDireccion(sp);
  const [cat, r] = await Promise.all([
    catalogoFiltro(),
    filtrar(rpcDeSupabase(await clienteSesion()), e.criterios, e.vista, e.pagina, "pantalla"),
  ]);
  const qs = haciaDireccion({ ...e, pagina: 1 });
  const enlace = (x: Partial<EstadoFiltro>) => { const q = haciaDireccion({ ...e, ...x }); return q ? `/consultas?${q}` : "/consultas"; };
  const avisoExport = typeof sp.exportacion === "string" ? AVISOS_EXPORTACION[sp.exportacion] : undefined;
  const nombreVista = e.vista === "inscripciones" ? "inscripciones" : "estudiantes";

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Consultas"
        descripcion="Combine los criterios que necesite. El total siempre está a la vista, y el sistema comprueba que la lista esté completa antes de mostrarla." />

      <Seccion titulo="Criterios">
        <Criterios key={qs} inicial={e} cat={cat} programas={cat.programas}
          errorBase={r.estado === "criterios_invalidos" ? { campo: r.campo, mensaje: r.mensaje } : undefined} />
      </Seccion>

      {avisoExport && <Alerta tipo="cuidado" titulo="Exportación">{avisoExport}</Alerta>}

      <section aria-labelledby="titulo-resultado" className="rounded-lg border border-borde bg-papel">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-borde px-4 py-3">
          <div className="min-w-0">
            <div role="tablist" aria-label="Vista del resultado" className="mb-2 flex gap-1">
              {(["inscripciones", "estudiantes"] as const).map((v) => (
                <Link key={v} role="tab" aria-selected={e.vista === v} href={enlace({ vista: v, pagina: 1 }) as Route}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${e.vista === v ? "bg-marino-suave text-marino" : "text-tinta-suave hover:bg-papel-alt"}`}>
                  {v === "inscripciones" ? "Inscripciones" : "Estudiantes"}
                </Link>
              ))}
            </div>
            <h2 id="titulo-resultado" className="text-sm text-tinta-suave">
              {describirCriterios(e.criterios, cat).join(" · ")}
            </h2>
            {r.estado === "ok" && (
              <p className="mt-1 text-2xl font-bold text-marino cifra" aria-live="polite">
                {r.total.toLocaleString("en-US")} <span className="text-base font-semibold">{r.total === 1 ? nombreVista.slice(0, -1) : nombreVista}</span>
              </p>
            )}
          </div>
          {r.estado === "ok" && r.total > 0 && (
            <div className="flex flex-wrap gap-2">
              <a href={`/consultas/exportar${qs ? `?${qs}` : ""}`} className={claseBoton("secundario")} download>Exportar a Excel</a>
              <Link href={(`/consultas/imprimir${qs ? `?${qs}` : ""}`) as Route} className={claseBoton("secundario")}>Imprimir</Link>
            </div>
          )}
        </div>
        <div className="p-4">
          {r.estado === "denegado" && <Alerta tipo="cuidado">Las consultas son para la Asistente de Dirección y para Dirección.</Alerta>}
          {r.estado === "criterios_invalidos" && <Alerta tipo="cuidado" titulo="Revise los criterios">{r.mensaje}</Alerta>}
          {r.estado === "error" && <Alerta tipo="cuidado" titulo="No se pudo consultar">{r.mensaje}</Alerta>}
          {r.estado === "incompleto" && (
            <Alerta tipo="cuidado" titulo="El resultado no está completo: no se muestra">
              Se esperaban {r.esperados.toLocaleString("en-US")} registros y llegaron {r.obtenidos.toLocaleString("en-US")}.
              El incidente quedó registrado. Intente de nuevo; si se repite, avise al equipo técnico.
            </Alerta>
          )}
          {r.estado === "ok" && (r.vista === "inscripciones" ? <TablaInscripciones filas={r.filas} desde={(r.pagina - 1) * r.por_pagina} />
            : <TablaEstudiantes filas={r.filas} desde={(r.pagina - 1) * r.por_pagina} />)}
          {r.estado === "ok" && <Paginacion pagina={r.pagina} total={r.total} porPagina={r.por_pagina} enlace={(n) => enlace({ pagina: n })} />}
        </div>
      </section>
    </div>
  );
}

const VACIO = "0 resultados: ningún registro cumple estos criterios.";

function Estado({ f }: { f: Pick<FilaInscripcion, "estado_academico" | "provisional"> }) {
  if (!f.estado_academico) return <span className="text-tinta-suave">—</span>;
  const texto = estadoEnPalabras(f.estado_academico, f.provisional);
  return f.estado_academico === "Reprobado" ? <span className="font-semibold text-reprobado">{texto}</span> : <>{texto}</>;
}

function TablaInscripciones({ filas, desde }: { filas: FilaInscripcion[]; desde: number }) {
  const nombre = (f: FilaInscripcion) => (
    <Link href={`/estudiantes/${f.estudiante_id}` as Route} className="font-medium text-azul hover:underline">{f.apellidos}, {f.nombres}</Link>
  );
  const nota = (f: FilaInscripcion) => f.nota_final === null ? "—"
    : <span className={f.estado_academico === "Reprobado" ? "font-bold text-reprobado" : "font-semibold"}>{f.nota_final}</span>;
  return (
    <Tabla vacio={VACIO}
      columnas={[{ titulo: "N.º", derecha: true }, { titulo: "Código ADEI" }, { titulo: "Apellidos y nombres" }, { titulo: "Sucursal" },
        { titulo: "Grupo" }, { titulo: "Nivel" }, { titulo: "Horario" }, { titulo: "Profesor" }, { titulo: "Inicio" }, { titulo: "Término" },
        { titulo: "Inscripción" }, { titulo: "Final", derecha: true }, { titulo: "Estado académico" }]}
      filas={filas.map((f, i) => [desde + i + 1, <span key="c" className="font-mono text-xs whitespace-nowrap">{f.codigo_adei}</span>, nombre(f), f.sucursal,
        <Link key="g" href={`/grupos/${f.grupo_id}` as Route} className="font-mono text-xs whitespace-nowrap text-azul hover:underline">{f.codigo_grupo}</Link>,
        <span key="n">{f.nivel}<span className="block text-xs text-tinta-suave">{f.programa}</span></span>,
        <span key="h" className="whitespace-nowrap">{f.modalidad}<span className="block text-xs text-tinta-suave">{hora(f.hora_inicio)} – {hora(f.hora_fin)}</span></span>,
        f.profesor, fecha(f.fecha_inicio), fecha(f.fecha_termino), f.estado_inscripcion, nota(f), <Estado key="e" f={f} />])}
      movil={filas.map((f, i) => (
        <div key={f.id} className="px-3 py-2 text-sm">
          <p className="flex justify-between gap-2"><span>{desde + i + 1}. {nombre(f)}</span><span className="cifra">{nota(f)}</span></p>
          <p className="text-tinta-suave"><span className="font-mono text-xs">{f.codigo_grupo}</span> · {f.nivel} · {f.modalidad} {hora(f.hora_inicio)}</p>
          <p className="text-tinta-suave">{fecha(f.fecha_inicio)} – {fecha(f.fecha_termino)} · {f.estado_inscripcion} · <Estado f={f} /></p>
        </div>
      ))} />
  );
}

function TablaEstudiantes({ filas, desde }: { filas: FilaEstudiante[]; desde: number }) {
  const nombre = (f: FilaEstudiante) => (
    <Link href={`/estudiantes/${f.id}` as Route} className="font-medium text-azul hover:underline">{f.apellidos}, {f.nombres}</Link>
  );
  const estado = (f: FilaEstudiante) => <Insignia color={f.estado_matricula === "Activo" ? "verde" : "gris"}>{f.estado_matricula}</Insignia>;
  return (
    <Tabla vacio={VACIO}
      columnas={[{ titulo: "N.º", derecha: true }, { titulo: "Código ADEI" }, { titulo: "Apellidos y nombres" }, { titulo: "Cédula" },
        { titulo: "Sucursal" }, { titulo: "Estado" }, { titulo: "Último nivel" }, { titulo: "Inscripciones", derecha: true }]}
      filas={filas.map((f, i) => [desde + i + 1, <span key="c" className="font-mono text-xs whitespace-nowrap">{f.codigo_adei}</span>, nombre(f),
        f.cedula ? <span key="d" className="font-mono text-xs whitespace-nowrap">{f.cedula}</span> : <span key="d" className="text-tinta-suave">—</span>,
        f.sucursal, estado(f), f.ultimo_nivel ?? <span key="u" className="text-tinta-suave">Sin niveles cursados</span>, f.inscripciones])}
      movil={filas.map((f, i) => (
        <div key={f.id} className="px-3 py-2 text-sm">
          <p className="flex justify-between gap-2"><span>{desde + i + 1}. {nombre(f)}</span>{estado(f)}</p>
          <p className="text-tinta-suave"><span className="font-mono text-xs">{f.codigo_adei}</span> · {f.sucursal} · {f.ultimo_nivel ?? "Sin niveles cursados"} · {f.inscripciones} inscr.</p>
        </div>
      ))} />
  );
}
