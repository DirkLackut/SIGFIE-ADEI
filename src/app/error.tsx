"use client";
/**
 * Si una pantalla falla por un error inesperado, en vez de la página en blanco
 * «This page couldn't load» se muestra esto, en español y con salida. El detalle
 * técnico no se muestra (puede revelar cómo está hecho el sistema); queda en el
 * registro del servidor.
 */
import Link from "next/link";
import { claseBoton } from "@/componentes/ui";

export default function ErrorInesperado({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="font-titulo text-2xl font-bold text-marino">Algo salió mal</h1>
      <p className="text-tinta-suave">
        La pantalla no se pudo mostrar. Lo que ya estaba guardado no se perdió. Intente de nuevo; si vuelve a pasar,
        avise a la Asistente de Dirección indicando qué estaba haciendo.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={claseBoton("primario")}>Intentar de nuevo</button>
        <Link href="/inicio" className={claseBoton("secundario")}>Ir al inicio</Link>
      </div>
    </main>
  );
}
