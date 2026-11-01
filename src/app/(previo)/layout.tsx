import { Marca } from "@/componentes/ui";

/** Pantallas antes del acceso (aviso y cambio de contraseña): sin menú, porque
 *  todavía no hay nada que abrir. Una columna, legible en 360 px (CE-87). */
export default function LayoutPrevio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-papel-alt">
      <header className="bg-marino text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <Marca claro />
          <form action="/salir" method="post">
            <button className="boton rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
