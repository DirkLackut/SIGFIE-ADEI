"use client";
import { useActionState } from "react";
import { accionAceptarAviso, type EstadoAviso } from "./acciones";
import { BotonEnviar } from "@/componentes/ui-cliente";
import { Alerta, claseBoton } from "@/componentes/ui";

export function FormularioAviso({ version }: { version: string }) {
  const [estado, accion] = useActionState<EstadoAviso, FormData>(accionAceptarAviso, {});
  return (
    <div className="space-y-4">
      {estado.mensaje && <Alerta tipo="cuidado" titulo="No se registró">{estado.mensaje}</Alerta>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {/* No aceptar = salir: sin aceptar no hay acceso (CE-15). */}
        <form action="/salir?motivo=aviso" method="post">
          <button className={claseBoton("secundario") + " w-full sm:w-auto"}>No acepto, salir</button>
        </form>
        <form action={accion}>
          <input type="hidden" name="version" value={version} />
          <div className="[&>button]:w-full sm:[&>button]:w-auto"><BotonEnviar enviando="Registrando…">Acepto y continúo</BotonEnviar></div>
        </form>
      </div>
    </div>
  );
}
