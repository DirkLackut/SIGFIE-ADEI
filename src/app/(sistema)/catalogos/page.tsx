import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Insignia, Seccion, Tabla, TituloPagina } from "@/componentes/ui";
import { hora, telefono } from "@/dominio/formato";
import { PROGRAMAS, PUBLICOS } from "@/dominio/catalogos";
import { AccionesFila, FormularioCatalogo, type DefCampo } from "./cliente";

export const metadata: Metadata = { title: "Catálogos · SIGFIE-ADEI" };

const PESTANAS = [
  { clave: "niveles", texto: "Niveles" }, { clave: "modalidades", texto: "Modalidades y horarios" },
  { clave: "profesores", texto: "Profesores" }, { clave: "sucursales", texto: "Sucursales" },
] as const;

const estadoActivo = (activo: boolean) => <Insignia color={activo ? "verde" : "gris"}>{activo ? "Activo" : "Desactivado"}</Insignia>;
const editar = (contenido: React.ReactNode) => (
  <details><summary className="inline-flex min-h-8 cursor-pointer items-center rounded-md px-2.5 text-xs font-semibold text-azul hover:bg-marino-suave">Editar</summary><div className="desplegable mt-2 min-w-72">{contenido}</div></details>
);

const C_NIVEL: DefCampo[] = [
  { nombre: "codigo", etiqueta: "Código", requerido: true, ancho: "8rem", ayuda: "Ej. INT-11" },
  { nombre: "nombre", etiqueta: "Nombre", requerido: true, ancho: "16rem", ayuda: "Ej. Intermediate I-I" },
  { nombre: "programa", etiqueta: "Programa", requerido: true, ancho: "13rem", opciones: PROGRAMAS.map((p) => ({ valor: p, texto: p })) },
  { nombre: "orden", etiqueta: "Orden", requerido: true, tipo: "number", ancho: "6rem", ayuda: "1 = primero" },
  { nombre: "publico", etiqueta: "Público", requerido: true, ancho: "9rem", opciones: PUBLICOS.map((p) => ({ valor: p, texto: p })) },
];
const C_MODALIDAD: DefCampo[] = [
  { nombre: "nombre", etiqueta: "Nombre", requerido: true, ancho: "12rem", ayuda: "Ej. Sabatino" },
  { nombre: "dias_de_clase", etiqueta: "Días de clase", requerido: true, ancho: "14rem", ayuda: "Ej. Sábado" },
];
const C_HORARIO: DefCampo[] = [
  { nombre: "hora_inicio", etiqueta: "Inicio", requerido: true, tipo: "time", ancho: "9rem" },
  { nombre: "hora_fin", etiqueta: "Fin", requerido: true, tipo: "time", ancho: "9rem" },
];
const C_PROFESOR: DefCampo[] = [
  { nombre: "nombres", etiqueta: "Nombres", requerido: true }, { nombre: "apellidos", etiqueta: "Apellidos", requerido: true },
  { nombre: "telefono", etiqueta: "Teléfono", requerido: true, tipo: "tel", ancho: "10rem", ayuda: "8 dígitos" },
];
const C_SUCURSAL: DefCampo[] = [
  { nombre: "nombre", etiqueta: "Nombre", requerido: true }, { nombre: "direccion", etiqueta: "Dirección", requerido: true, ancho: "20rem" },
  { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", ancho: "10rem", ayuda: "8 dígitos" },
];

export default async function PaginaCatalogos({ searchParams }: PageProps<"/catalogos">) {
  await exigirAcceso(["asistente"]);
  const { ver } = await searchParams;
  const actual = PESTANAS.find((p) => p.clave === ver)?.clave ?? "niveles";
  const s = await clienteSesion();

  let contenido: React.ReactNode;
  if (actual === "niveles") {
    const { data } = await s.from("nivel").select("*").order("publico").order("programa").order("orden");
    contenido = (<>
      <Seccion titulo="Agregar nivel"><FormularioCatalogo entidad="nivel" campos={C_NIVEL} boton="Agregar nivel" /></Seccion>
      <Tabla resumen={`${data?.length ?? 0} niveles`} vacio="No hay niveles."
        columnas={[{ titulo: "Código" }, { titulo: "Nombre" }, { titulo: "Programa" }, { titulo: "Orden", derecha: true }, { titulo: "Público" }, { titulo: "Estado" }, { titulo: "" }]}
        filas={(data ?? []).map((n) => [<span key="c" className="font-mono">{n.codigo}</span>, n.nombre, n.programa, n.orden, n.publico, estadoActivo(n.activo),
          <div key="a" className="flex flex-wrap items-start gap-2">{editar(<FormularioCatalogo entidad="nivel" campos={C_NIVEL} id={n.id} boton="Guardar"
            valores={{ codigo: n.codigo, nombre: n.nombre, programa: n.programa, orden: String(n.orden), publico: n.publico }} />)}
            <AccionesFila entidad="nivel" id={n.id} activo={n.activo} nombre={n.nombre} /></div>])} />
    </>);
  } else if (actual === "modalidades") {
    const { data } = await s.from("modalidad").select("*, horario(*)").order("nombre");
    contenido = (<>
      <Seccion titulo="Agregar modalidad"><FormularioCatalogo entidad="modalidad" campos={C_MODALIDAD} boton="Agregar modalidad" /></Seccion>
      {(data ?? []).map((m) => {
        const horarios = ((m.horario ?? []) as { id: string; hora_inicio: string; hora_fin: string; activo: boolean }[]).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
        return (
          <Seccion key={m.id} titulo={m.nombre} descripcion={m.dias_de_clase}
            acciones={<span className="flex items-center gap-2">{estadoActivo(m.activo)}</span>}>
            <div className="mb-3 flex flex-wrap gap-4">
              {editar(<FormularioCatalogo entidad="modalidad" campos={C_MODALIDAD} id={m.id} boton="Guardar" valores={{ nombre: m.nombre, dias_de_clase: m.dias_de_clase }} />)}
              <AccionesFila entidad="modalidad" id={m.id} activo={m.activo} nombre={m.nombre} />
            </div>
            <Tabla vacio="Esta modalidad todavía no tiene horarios."
              columnas={[{ titulo: "Horario" }, { titulo: "Estado" }, { titulo: "" }]}
              filas={horarios.map((h) => [`${hora(h.hora_inicio)} a ${hora(h.hora_fin)}`, estadoActivo(h.activo),
                <AccionesFila key="a" entidad="horario" id={h.id} activo={h.activo} nombre={`${hora(h.hora_inicio)} a ${hora(h.hora_fin)}`} />])} />
            <div className="mt-3"><FormularioCatalogo entidad="horario" campos={C_HORARIO} fijos={{ modalidad_id: m.id }} boton={`Agregar horario a ${m.nombre}`} /></div>
          </Seccion>
        );
      })}
    </>);
  } else if (actual === "profesores") {
    const [{ data }, { data: cuentas }] = await Promise.all([
      s.from("profesor").select("*").order("apellidos"), s.from("usuario").select("profesor_id, nombre_usuario, estado")]);
    const cuenta = new Map((cuentas ?? []).filter((c) => c.profesor_id).map((c) => [c.profesor_id, c]));
    contenido = (<>
      <Seccion titulo="Agregar profesor"><FormularioCatalogo entidad="profesor" campos={C_PROFESOR} boton="Agregar profesor" /></Seccion>
      <Tabla resumen={`${data?.length ?? 0} profesores`} vacio="No hay profesores. Agregue el primero arriba."
        columnas={[{ titulo: "Apellidos y nombres" }, { titulo: "Teléfono" }, { titulo: "Cuenta" }, { titulo: "Estado" }, { titulo: "" }]}
        filas={(data ?? []).map((p) => [`${p.apellidos}, ${p.nombres}`, <span key="t" className="cifra">{telefono(p.telefono)}</span>,
          cuenta.get(p.id) ? `${cuenta.get(p.id)!.nombre_usuario}${cuenta.get(p.id)!.estado === "inactivo" ? " (inactiva)" : ""}` : <span key="s" className="text-tinta-suave">Sin cuenta</span>,
          estadoActivo(p.activo),
          <div key="a" className="flex flex-wrap items-start gap-2">{editar(<FormularioCatalogo entidad="profesor" campos={C_PROFESOR} id={p.id} boton="Guardar"
            valores={{ nombres: p.nombres, apellidos: p.apellidos, telefono: p.telefono }} />)}
            <AccionesFila entidad="profesor" id={p.id} activo={p.activo} nombre={`${p.nombres} ${p.apellidos}`} /></div>])} />
    </>);
  } else {
    const { data } = await s.from("sucursal").select("*").order("es_central", { ascending: false }).order("nombre");
    contenido = (<>
      <Seccion titulo="Agregar sucursal"><FormularioCatalogo entidad="sucursal" campos={C_SUCURSAL} boton="Agregar sucursal" /></Seccion>
      <Tabla resumen={`${data?.length ?? 0} sucursales`} vacio="No hay sucursales."
        columnas={[{ titulo: "Nombre" }, { titulo: "Dirección" }, { titulo: "Teléfono" }, { titulo: "" }, { titulo: "" }]}
        filas={(data ?? []).map((x) => [x.nombre, x.direccion, <span key="t" className="cifra">{telefono(x.telefono) ?? "—"}</span>,
          x.es_central ? <Insignia key="c" color="verde">Central</Insignia> : "",
          <div key="a" className="flex flex-wrap items-start gap-2">{editar(<FormularioCatalogo entidad="sucursal" campos={C_SUCURSAL} id={x.id} boton="Guardar"
            valores={{ nombre: x.nombre, direccion: x.direccion, telefono: x.telefono ?? "" }} />)}
            {!x.es_central && <AccionesFila entidad="sucursal" id={x.id} nombre={x.nombre} />}</div>])} />
    </>);
  }

  return (
    <>
      <TituloPagina titulo="Catálogos" descripcion="Los valores que se eligen en los formularios. Lo que ya se usó no se elimina: se desactiva, y sigue apareciendo donde se usó." />
      <nav aria-label="Catálogos" className="mb-4 flex flex-wrap gap-1">
        {PESTANAS.map((p) => (
          <Link key={p.clave} href={`/catalogos?ver=${p.clave}` as Route} aria-current={actual === p.clave ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${actual === p.clave ? "bg-marino-suave text-azul" : "text-tinta-suave hover:bg-papel-alt"}`}>
            {p.texto}
          </Link>
        ))}
        {/* 002·CE-25: la regla vive en su propia página porque Dirección también la consulta (CE-58). */}
        <Link href="/reglas" className="rounded-md px-3 py-1.5 text-sm font-semibold text-tinta-suave hover:bg-papel-alt">Regla de aprobación →</Link>
      </nav>
      <div className="space-y-5">{contenido}</div>
    </>
  );
}
