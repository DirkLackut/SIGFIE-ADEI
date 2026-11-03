import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Alerta, BotonEnlace, Dato, Insignia, Seccion, Tabla, TituloPagina, claseBoton } from "@/componentes/ui";
import { esUuid, fecha, telefono, opcionSucursal } from "@/dominio/formato";
import { calcularEdad, hoyEnManagua } from "@/dominio/edad";
import { FormularioEdicion, QuitarTutor, VincularTutor } from "./formularios";
import { Desplegable } from "@/componentes/movimiento";
import { rpcDeSupabase } from "@/datos/rpc";
import { historialAcademico, type InscripcionHistorial } from "@/datos/consultas";
import { celdaParcial } from "@/dominio/acta-impresa";
import { estadoEnPalabras } from "@/dominio/exportacion";
import { formatoMonto } from "@/dominio/factura";
import { hora } from "@/dominio/formato";
import { AnularFactura, CambiarEstado, FormularioFactura } from "./facturas";

export const metadata: Metadata = { title: "Expediente · SIGFIE-ADEI" };

const AVISOS: Record<string, { tipo: "exito" | "cuidado"; texto: string }> = {
  registrado: { tipo: "exito", texto: "Estudiante registrado." },
  completado: { tipo: "exito", texto: "Expediente completado con la cédula. No se creó un duplicado." },
  conflicto: { tipo: "cuidado", texto: "El expediente cambió mientras tanto; revise los datos y vuelva a intentarlo." },
};

export default async function PaginaExpediente({ params, searchParams }: PageProps<"/estudiantes/[id]">) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const { id } = await params;
  if (!esUuid(id)) notFound();   // un id mal escrito es "no encontrado", no un error del servidor
  const sp = await searchParams;
  const aviso = Object.keys(AVISOS).find((k) => k in sp);
  const puedeEditar = estado.roles.includes("asistente");

  const supabase = await clienteSesion();
  const [{ data: est }, { data: sucursales }, { data: tutores }, historial] = await Promise.all([
    supabase.from("estudiante").select("*").eq("id", id).maybeSingle(),
    supabase.from("sucursal").select("id, nombre, es_central").order("es_central", { ascending: false }).order("nombre"),
    supabase.from("estudiante_tutor").select("tutor_id, tutor(id, nombre_completo, cedula, telefono)").eq("estudiante_id", id),
    historialAcademico(rpcDeSupabase(supabase), id),   // CE-36 a CE-42; la base registra la consulta (CE-41)
  ]);
  if (!est || historial.estado === "no_existe") notFound();
  const inscripciones = historial.estado === "ok" ? historial.inscripciones : [];
  const facturas = historial.estado === "ok" ? historial.facturas : [];
  const facturaParaInscripcion = typeof sp.factura === "string" ? sp.factura : undefined;   // CE-61: viene del grupo

  const sucursal = sucursales?.find((s) => s.id === est.sucursal_id)?.nombre;
  const edad = calcularEdad(est.fecha_nacimiento, hoyEnManagua(new Date()));
  const listaTutores = (tutores ?? []).map((t) => t.tutor as unknown as { id: string; nombre_completo: string; cedula: string; telefono: string });

  return (
    <div className="space-y-5">
      <TituloPagina volver={{ href: "/estudiantes", texto: "Estudiantes" }}
        titulo={`${est.nombres} ${est.apellidos}`}
        descripcion={<span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-tinta">{est.codigo_adei}</span>
          <Insignia color={est.estado_matricula === "Activo" ? "verde" : "gris"}>{est.estado_matricula}</Insignia>
          {edad < 18 && <Insignia color="dorado">Menor de edad</Insignia>}
          {est.origen_registro === "Migración" && <Insignia>Migrado</Insignia>}
        </span>} />

      {aviso && <Alerta tipo={AVISOS[aviso].tipo}>{AVISOS[aviso].texto}{aviso === "registrado" && <> Código asignado: <strong className="font-mono">{est.codigo_adei}</strong>.</>}</Alerta>}

      <Seccion titulo="Datos personales">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Cédula">{est.cedula && <span className="font-mono">{est.cedula}</span>}</Dato>
          <Dato etiqueta="Nacimiento">{fecha(est.fecha_nacimiento)} ({edad} años)</Dato>
          <Dato etiqueta="Teléfono">{telefono(est.telefono)}</Dato>
          <Dato etiqueta="Correo">{est.correo}</Dato>
          <Dato etiqueta="Dirección">{est.direccion}</Dato>
          <Dato etiqueta="Contacto de emergencia">{est.contacto_emergencia}</Dato>
          <Dato etiqueta="Sucursal">{sucursal}</Dato>
          <Dato etiqueta="Registrado">{fecha(est.creado_en)}</Dato>
          <Dato etiqueta="Estado de matrícula">{est.estado_matricula}{est.fecha_cambio_estado && <span className="text-tinta-suave"> desde {fecha(est.fecha_cambio_estado)}</span>}</Dato>
        </dl>
        {puedeEditar && (
          <div className="mt-5"><Desplegable titulo="Editar datos">
              <FormularioEdicion est={est} sucursales={(sucursales ?? []).map(opcionSucursal)} />
            </Desplegable></div>
        )}
        {puedeEditar && (
          <div className="mt-3"><Desplegable titulo="Cambiar estado de matrícula">
              <CambiarEstado estudianteId={est.id} actual={est.estado_matricula} ultimoCambio={est.fecha_cambio_estado} />
            </Desplegable></div>
        )}
      </Seccion>

      <Seccion titulo="Tutores" descripcion={edad < 18 ? "Un menor de 18 años debe tener al menos un tutor." : undefined}>
        <Tabla vacio={edad < 18 ? "Sin tutores registrados: falta vincular al menos uno." : "Sin tutores: no lo requiere por ser mayor de edad."}
          columnas={[{ titulo: "Nombre" }, { titulo: "Cédula" }, { titulo: "Teléfono" }, ...(puedeEditar ? [{ titulo: "" }] : [])]}
          filas={listaTutores.map((t) => [t.nombre_completo, <span key="c" className="font-mono">{t.cedula}</span>, telefono(t.telefono),
            ...(puedeEditar ? [<QuitarTutor key="q" estudianteId={est.id} tutorId={t.id} nombre={t.nombre_completo} />] : [])])} />
        {/* Menor sin tutor: el formulario queda a la vista, es lo que falta. En los
            demás casos se pliega para no competir con los datos. */}
        {puedeEditar && (
          <div className="mt-4"><Desplegable titulo={listaTutores.length ? "Vincular otro tutor" : "Vincular tutor"} abiertoInicial={edad < 18 && listaTutores.length === 0}>
            <VincularTutor estudianteId={est.id} />
          </Desplegable></div>
        )}
      </Seccion>

      <Seccion titulo="Historial académico"
        descripcion={inscripciones.length ? `${inscripciones.length} ${inscripciones.length === 1 ? "nivel" : "niveles"}, en orden cronológico.` : undefined}
        acciones={<div className="flex flex-wrap gap-2">
          {inscripciones.length > 0 && <a href={`/estudiantes/${est.id}/historial/exportar`} download className={claseBoton("secundario")}>Exportar a Excel</a>}
          {inscripciones.length > 0 && <BotonEnlace href={`/estudiantes/${est.id}/historial/imprimir` as Route} estilo="secundario">Imprimir</BotonEnlace>}
          {puedeEditar && est.estado_matricula === "Activo" && <BotonEnlace href={`/grupos?inscribir=${est.codigo_adei}` as Route} estilo="secundario">Inscribir en un grupo</BotonEnlace>}
        </div>}>
        {historial.estado === "error" && <Alerta tipo="cuidado">{historial.mensaje}</Alerta>}
        <Tabla vacio="Sin niveles cursados."
          columnas={[{ titulo: "Grupo" }, { titulo: "Nivel" }, { titulo: "Horario y profesor" }, { titulo: "Fechas" },
            { titulo: "I", derecha: true }, { titulo: "II", derecha: true }, { titulo: "III", derecha: true }, { titulo: "Final", derecha: true },
            { titulo: "Estado" }, { titulo: "Factura" }, ...(puedeEditar ? [{ titulo: "" }] : [])]}
          filas={inscripciones.map((i) => [
            <Link key="g" href={`/grupos/${i.grupo_id}` as Route} className="font-mono text-xs font-semibold text-azul hover:underline">{i.codigo_grupo}</Link>,
            <span key="n">{i.nivel}<span className="block text-xs text-tinta-suave">{i.programa} · {i.sucursal}</span></span>,
            <span key="h">{i.modalidad} {hora(i.hora_inicio)}<span className="block text-xs text-tinta-suave">{i.profesor}</span></span>,
            <span key="f" className="whitespace-nowrap">{fecha(i.fecha_inicio)} – {fecha(i.fecha_termino)}</span>,
            ...[1, 2, 3].map((n) => celdaParcial(i.parciales.find((p) => p.numero === n))),
            <NotaFinal key="nf" i={i} />,
            <EstadoNivel key="e" i={i} />,
            i.factura ? <span key="fa" className="font-mono text-xs">{i.factura.serie}-{i.factura.numero}</span> : <span key="fa" className="text-tinta-suave">—</span>,
            ...(puedeEditar ? [<Link key="hm" href={`/inscripciones/${i.id}/matricula` as Route} className="text-sm font-semibold whitespace-nowrap text-azul hover:underline">Hoja de matrícula</Link>] : []),
          ])} />
      </Seccion>

      <Seccion titulo="Facturas" descripcion="Solo se registra la factura impresa del talonario; el sistema no emite facturas.">
        <Tabla vacio="Sin facturas registradas."
          columnas={[{ titulo: "Factura" }, { titulo: "Fecha" }, { titulo: "Monto", derecha: true }, { titulo: "Forma de pago" },
            { titulo: "Inscripción" }, { titulo: "Ampara a" }, ...(puedeEditar ? [{ titulo: "" }] : [])]}
          filas={facturas.map((f) => [
            <span key="n" className="font-mono font-semibold">{f.serie}-{f.numero}</span>, fecha(f.fecha_emision),
            formatoMonto(Number(f.monto), f.moneda), f.forma_pago, f.codigo_grupo ?? <span key="i" className="text-tinta-suave">—</span>,
            f.otros_amparados?.length ? <span key="a">Este estudiante y {f.otros_amparados.map((o) => o.nombre).join("; ")}</span> : "Este estudiante",
            ...(puedeEditar ? [<div key="x" className="space-y-1">
              <Desplegable titulo="Corregir…" estilo="boton">
                <FormularioFactura estudianteId={est.id} factura={f} inscripciones={opcionesInscripcion(inscripciones)} />
              </Desplegable>
              <Desplegable titulo="Anular…" estilo="boton"><AnularFactura estudianteId={est.id} id={f.id} /></Desplegable>
            </div>] : []),
          ])} />
        {puedeEditar && (
          <div className="mt-4" id="registrar-factura">
            <Desplegable titulo="Registrar factura" abiertoInicial={!!facturaParaInscripcion}>
              <FormularioFactura estudianteId={est.id} inscripciones={opcionesInscripcion(inscripciones)} inscripcionInicial={facturaParaInscripcion} />
            </Desplegable>
          </div>
        )}
      </Seccion>
    </div>
  );
}

const opcionesInscripcion = (lista: InscripcionHistorial[]) =>
  lista.map((i) => ({ id: i.id, texto: `${i.codigo_grupo} · ${i.nivel} (${fecha(i.fecha_inicio)})`, conFactura: !!i.factura }));

/** CE-38: la reprobada en rojo; el Condicionado con su «C» (como el acta). */
function NotaFinal({ i }: { i: InscripcionHistorial }) {
  if (i.nota_final === null) return <span className="text-tinta-suave">—</span>;
  if (i.estado_academico === "Reprobado") return <span className="font-bold text-reprobado">{i.nota_final}</span>;
  return <span className="font-semibold">{i.nota_final}{i.estado_academico === "Condicionado" ? " C" : ""}</span>;
}

function EstadoNivel({ i }: { i: InscripcionHistorial }) {
  const texto = estadoEnPalabras(i.estado_academico, i.provisional);
  return (
    <span>
      {i.estado_academico === "Reprobado" ? <span className="font-semibold text-reprobado">{texto}</span> : texto || i.estado_inscripcion}
      {i.estado_inscripcion !== "En curso" && i.estado_inscripcion !== "Completada" && <span className="block text-xs text-tinta-suave">{i.estado_inscripcion}</span>}
      {i.condicionado && i.justificacion_condicionado && <span className="block text-xs text-tinta-suave">«{i.justificacion_condicionado}»</span>}
    </span>
  );
}
