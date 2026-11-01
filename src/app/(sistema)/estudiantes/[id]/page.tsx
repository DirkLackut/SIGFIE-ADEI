import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Alerta, BotonEnlace, Dato, Insignia, Seccion, Tabla, TituloPagina } from "@/componentes/ui";
import { esUuid, fecha, telefono } from "@/dominio/formato";
import { calcularEdad, hoyEnManagua } from "@/dominio/edad";
import { FormularioEdicion, QuitarTutor, VincularTutor } from "./formularios";
import { Desplegable } from "@/componentes/movimiento";

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
  const [{ data: est }, { data: sucursales }, { data: tutores }, { data: inscripciones }] = await Promise.all([
    supabase.from("estudiante").select("*").eq("id", id).maybeSingle(),
    supabase.from("sucursal").select("id, nombre").order("nombre"),
    supabase.from("estudiante_tutor").select("tutor_id, tutor(id, nombre_completo, cedula, telefono)").eq("estudiante_id", id),
    supabase.from("inscripcion").select("id, fecha_inscripcion, estado_inscripcion, grupo(id, codigo_grupo, fecha_inicio, fecha_termino, estado_acta, nivel(nombre))")
      .eq("estudiante_id", id).order("fecha_inscripcion", { ascending: false }),
  ]);
  if (!est) notFound();

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
        </dl>
        {puedeEditar && (
          <div className="mt-5"><Desplegable titulo="Editar datos">
              <FormularioEdicion est={est} sucursales={(sucursales ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
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

      <Seccion titulo="Inscripciones"
        acciones={puedeEditar && est.estado_matricula === "Activo" ? <BotonEnlace href={`/grupos?inscribir=${est.codigo_adei}` as Route} estilo="secundario">Inscribir en un grupo</BotonEnlace> : undefined}
        descripcion={puedeEditar && !(inscripciones ?? []).length ? "Pulse «Inscribir en un grupo», elija el grupo y confirme." : undefined}>
        <Tabla vacio="Sin inscripciones todavía."
          columnas={[{ titulo: "Grupo" }, { titulo: "Nivel" }, { titulo: "Fechas" }, { titulo: "Inscrito el" }, { titulo: "Estado" }]}
          filas={(inscripciones ?? []).map((i) => {
            const g = i.grupo as unknown as { id: string; codigo_grupo: string; fecha_inicio: string; fecha_termino: string; nivel: { nombre: string } };
            return [<Link key="g" href={`/grupos/${g.id}` as Route} className="font-mono font-semibold text-azul hover:underline">{g.codigo_grupo}</Link>,
              g.nivel?.nombre, `${fecha(g.fecha_inicio)} – ${fecha(g.fecha_termino)}`, fecha(i.fecha_inscripcion), i.estado_inscripcion];
          })} />
      </Seccion>
    </div>
  );
}
