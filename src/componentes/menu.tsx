"use client";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export interface EnlaceMenu { href: Route; texto: string }

/** Menú principal. Marca la sección en la que está la persona; en el celular se
 *  desliza de lado dentro de su franja, sin mover la página. */
export function MenuPrincipal({ enlaces }: { enlaces: EnlaceMenu[] }) {
  const ruta = usePathname();
  const activo = (href: string) => ruta === href || ruta.startsWith(href + "/");
  return (
    <nav aria-label="Secciones" className="menu-fijo border-b border-borde bg-papel">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4">
        {enlaces.map((e) => (
          <li key={e.href}>
            <Link href={e.href} aria-current={activo(e.href) ? "page" : undefined}
                  className={`block border-b-[3px] px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
                    activo(e.href) ? "border-marino text-marino" : "border-transparent text-tinta-suave hover:border-borde hover:text-tinta"}`}>
              {e.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
