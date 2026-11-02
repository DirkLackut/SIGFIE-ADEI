import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { Alerta } from "@/componentes/ui";

export const metadata: Metadata = { title: "Inicio · SIGFIE-ADEI" };

const AVISOS: Record<string, { tipo: "info" | "exito" | "cuidado"; texto: string }> = {
  "sin-permiso": { tipo: "cuidado", texto: "Esa sección no está disponible para su rol." },
  contrasena: { tipo: "exito", texto: "Su contraseña se cambió." },
};

/** Cada tarjeta es una tarea concreta, escrita como la diría la persona. */
function Tarea({ href, titulo, texto }: { href: Route; titulo: string; texto: string }) {
  return (
    <Link href={href} className="group block rounded-lg border border-borde bg-papel p-4 transition-colors hover:border-azul hover:bg-marino-suave">
      <p className="font-semibold group-hover:text-azul">{titulo} →</p>
      <p className="mt-1 text-sm text-tinta-suave">{texto}</p>
    </Link>
  );
}

export default async function PaginaInicio({ searchParams }: PageProps<"/inicio">) {
  const estado = await exigirAcceso();
  const { aviso } = await searchParams;
  const a = typeof aviso === "string" ? AVISOS[aviso] : undefined;
  const es = (r: string) => estado.roles.includes(r as never);

  return (
    <div className="space-y-6">
      {a && <Alerta tipo={a.tipo}>{a.texto}</Alerta>}
      <div>
        <h1 className="font-titulo text-2xl font-bold text-marino">¿Qué desea hacer?</h1>
        <p className="mt-1 text-sm text-tinta-suave">Elija una tarea. También puede usar el menú de arriba en cualquier momento.</p>
      </div>

      {es("asistente") && (
        <section aria-labelledby="t-asis" className="space-y-3">
          <h2 id="t-asis" className="text-xs font-semibold tracking-wider text-tinta-suave uppercase">Estudiantes y grupos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tarea href="/estudiantes" titulo="Buscar un estudiante" texto="Por nombre, cédula o código ADEI. No importan las tildes." />
            <Tarea href="/estudiantes/nuevo" titulo="Registrar un estudiante" texto="El sistema le asigna su código y avisa si ya existe." />
            <Tarea href="/grupos/nuevo" titulo="Abrir un grupo" texto="Nivel, horario, profesor y fechas, todo de las listas." />
            <Tarea href="/grupos" titulo="Inscribir en un grupo" texto="Abra el grupo y agregue a sus estudiantes." />
          </div>
          <h2 className="pt-2 text-xs font-semibold tracking-wider text-tinta-suave uppercase">Administración</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tarea href="/catalogos" titulo="Catálogos" texto="Sucursales, modalidades y horarios, niveles y profesores." />
            <Tarea href="/cuentas" titulo="Cuentas de usuario" texto="Crear cuentas, asignar roles y restablecer contraseñas." />
            <Tarea href="/reglas" titulo="Regla de aprobación" texto="Nota mínima y Condicionado por programa y nivel." />
          </div>
        </section>
      )}

      {es("direccion") && !es("asistente") && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tarea href="/estudiantes" titulo="Buscar un estudiante" texto="Consulta de expedientes. Solo lectura." />
          <Tarea href="/grupos" titulo="Ver los grupos" texto="Grupos abiertos, su profesor, sus inscritos y su acta." />
          <Tarea href="/reglas" titulo="Regla de aprobación" texto="Con qué nota se aprueba cada programa y nivel." />
        </div>
      )}

      {es("profesor") && (
        <section aria-labelledby="t-prof" className="space-y-3">
          <h2 id="t-prof" className="text-xs font-semibold tracking-wider text-tinta-suave uppercase">Mis clases</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tarea href="/mis-grupos" titulo="Registrar notas" texto="Abra su grupo y escriba los parciales; la nota final se calcula sola." />
            <Tarea href="/mis-grupos" titulo="Entregar un acta" texto="Revise el resumen y entréguela. Después ya no se modifica." />
          </div>
        </section>
      )}
    </div>
  );
}
