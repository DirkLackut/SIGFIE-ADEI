"use client";
import { useActionState } from "react";
import { accionCambiarContrasena, type EstadoCambio } from "./acciones";
import { BotonEnviar, CampoContrasena } from "@/componentes/ui-cliente";
import { Alerta } from "@/componentes/ui";

export function FormularioCambio() {
  const [estado, accion] = useActionState<EstadoCambio, FormData>(accionCambiarContrasena, {});
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && <Alerta tipo="cuidado" titulo="No se completó">{estado.mensaje}</Alerta>}
      <CampoContrasena nombre="nueva" etiqueta="Contraseña nueva" autoComplete="new-password" error={estado.errores?.nueva}
                       ayuda="Al menos 8 caracteres. Una frase corta es fácil de recordar y difícil de adivinar." />
      <CampoContrasena nombre="confirmacion" etiqueta="Repita la contraseña nueva" autoComplete="new-password"
                       error={estado.errores?.confirmacion} />
      <div className="pt-1"><BotonEnviar enviando="Guardando…">Guardar contraseña</BotonEnviar></div>
    </form>
  );
}
