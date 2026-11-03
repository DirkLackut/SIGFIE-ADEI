import Link from "next/link";
import { exigirAcceso, NOMBRE_ROL } from "@/servidor/sesion";
import { Marca } from "@/componentes/ui";
import { MenuPrincipal, type EnlaceMenu } from "@/componentes/menu";
import type { Rol } from "@/dominio/acceso";

/** Qué ve cada rol en el menú (T19). Sale de la misma tabla de permisos que
 *  usa proxy.ts: nadie ve un enlace que lo llevaría a "sin permiso". */
function enlacesPara(roles: Rol[]): EnlaceMenu[] {
  const tiene = (...r: Rol[]) => r.some((x) => roles.includes(x));
  const e: EnlaceMenu[] = [{ href: "/inicio", texto: "Inicio" }];
  if (tiene("profesor")) e.push({ href: "/mis-grupos", texto: "Mis grupos" });
  if (tiene("asistente", "direccion")) e.push({ href: "/estudiantes", texto: "Estudiantes" }, { href: "/grupos", texto: "Grupos" },
    { href: "/consultas", texto: "Consultas" }, { href: "/panel-actas", texto: "Actas" }, { href: "/reportes", texto: "Reportes" });
  if (tiene("direccion")) e.push({ href: "/bitacora", texto: "Bitácora" });
  if (tiene("asistente")) e.push({ href: "/catalogos", texto: "Catálogos" }, { href: "/cuentas", texto: "Cuentas" }, { href: "/respaldo", texto: "Respaldo" });
  return e;
}

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const estado = await exigirAcceso();
  return (
    <div className="flex min-h-dvh flex-col bg-papel-alt">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-papel focus:p-2">Ir al contenido</a>
      {/* Encabezado en el marino de ADEI, como las bandas de su manual. En la PC queda
          fijo arriba junto con el menú; en el celular se va al bajar y solo el menú
          queda fijo, para no ocupar un octavo de la pantalla (plan §14). */}
      <header className="encabezado-fijo bg-marino text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/inicio" aria-label="Inicio" className="rounded-md"><Marca claro /></Link>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-semibold">{estado.nombre_usuario}</p>
              <p className="text-xs text-white/75">{estado.roles.map((r) => NOMBRE_ROL[r]).join(" · ")}</p>
            </div>
            <details className="relative">
              <summary className="boton cursor-pointer list-none rounded-md border border-white/30 px-3 py-1.5 font-medium hover:bg-white/10">
                <span className="sm:hidden">{estado.nombre_usuario} </span>Cuenta ▾
              </summary>
              <div className="menu-flotante absolute right-0 z-20 mt-1 w-56 rounded-md border border-borde bg-papel py-1 text-tinta shadow-lg">
                <p className="border-b border-borde px-3 pt-1 pb-2 text-xs leading-tight text-tinta-suave sm:hidden">
                  <span className="block font-semibold text-tinta">{estado.nombre_usuario}</span>
                  {estado.roles.map((r) => NOMBRE_ROL[r]).join(" · ")}
                </p>
                <Link href="/cambiar-contrasena" className="block px-3 py-2 hover:bg-papel-alt">Cambiar contraseña</Link>
                <form action="/salir" method="post">
                  <button className="block w-full px-3 py-2 text-left hover:bg-papel-alt">Salir</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <MenuPrincipal enlaces={enlacesPara(estado.roles)} />
      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-borde bg-papel py-3 text-center text-xs text-tinta-suave">
        {estado.organizacion} · Los datos de los estudiantes son de uso exclusivo de la academia (Ley 787).
      </footer>
    </div>
  );
}
