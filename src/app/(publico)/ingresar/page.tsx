import type { Metadata } from "next";
import { Alerta, Emblema } from "@/componentes/ui";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Ingresar · SIGFIE-ADEI" };

/**
 * Ingreso (CE-1, CE-3, CE-87). En el celular es una sola columna sin
 * desplazamiento horizontal; en la PC, la franja marino de ADEI a la izquierda.
 */
export default async function PaginaIngreso({ searchParams }: PageProps<"/ingresar">) {
  const { motivo } = await searchParams;
  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* PC: franja marino con el emblema en blanco, como la portada del manual de ADEI. */}
      <aside className="hidden flex-col items-center justify-center gap-8 bg-marino p-10 text-center text-white md:flex">
        <Emblema className="w-64 max-w-full lg:w-72" titulo="Academia de Enseñanza en Inglés ADEI, Managua, Nicaragua" />
        <div className="max-w-md">
          <p className="font-titulo text-2xl leading-snug lg:text-3xl">Registro académico de las tres sucursales, en un solo lugar.</p>
          <p className="mt-4 text-sm text-white/80">Altamira · Don Bosco · Multicentro Las Brisas</p>
        </div>
      </aside>

      <div className="flex flex-col">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
          {/* Celular: el emblema arriba, en marino, a un tamaño en que su texto se lee. */}
          <div className="mb-6 flex flex-col items-center gap-2 text-marino md:hidden">
            <Emblema className="size-24" titulo="Academia de Enseñanza en Inglés ADEI" />
            <span className="text-xs font-semibold tracking-wider text-tinta-suave">SIGFIE</span>
          </div>
          <h1 className="font-titulo text-2xl font-bold text-marino">Ingresar</h1>
          <p className="mt-1 mb-6 text-sm text-tinta-suave">Use el usuario y la contraseña que le entregó la Asistente de Dirección.</p>
          {motivo === "cuenta" && <div className="mb-4"><Alerta tipo="cuidado">Su sesión se cerró. Si cree que es un error, consulte a la Asistente de Dirección.</Alerta></div>}
          {motivo === "salio" && <div className="mb-4"><Alerta tipo="info">Salió del sistema.</Alerta></div>}
          <FormularioIngreso />
          <div className="mt-8 space-y-2 border-t border-borde pt-4 text-xs text-tinta-suave">
            <p><strong className="text-tinta">¿Olvidó su contraseña?</strong> Pida a la Asistente de Dirección que la restablezca: le entregará una contraseña temporal.</p>
            <p>Una contraseña temporal vence a los 3 días. Si ya no le funciona, pida una nueva.</p>
          </div>
          <p className="mt-8 text-center text-xs text-tinta-suave">Academia de Enseñanza en Inglés ADEI · Managua, Nicaragua</p>
        </div>
      </div>
    </main>
  );
}
