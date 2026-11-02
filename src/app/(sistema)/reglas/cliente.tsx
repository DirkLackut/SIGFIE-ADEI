"use client";
import { useActionState } from "react";
import { accionEliminarRegla, accionGuardarRegla, type EstadoRegla } from "./acciones";
import { Alerta } from "@/componentes/ui";
import { BotonConfirmar, BotonEnviar, conservarSiFalla, useErroresVivos } from "@/componentes/ui-cliente";
import { useConfirmarExito } from "@/componentes/movimiento";
import { Campo, Selector } from "@/componentes/campos";
import { PROGRAMAS } from "@/dominio/catalogos";

export interface ValoresRegla {
  id?: string; programa: string; nivel_desde: string; nivel_hasta: string; vigente_desde: string;
  nota_minima: string; condicionado_desde: string; provisional: boolean;
}

/** 002·CE-24, CE-25, CE-27: agregar o corregir una regla. La franja del Condicionado
 *  es opcional; en el nivel siguiente se exige la nota mínima (RN-05). */
export function FormularioRegla({ valores, boton }: { valores?: ValoresRegla; boton: string }) {
  const [s, accion] = useActionState<EstadoRegla, FormData>(accionGuardarRegla, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  const { e, alEscribir } = useErroresVivos(s.errores, s);
  const v = valores;
  return (
    <form key={s.marca} action={accion} onReset={conservarSiFalla(s.ok)} onInput={alEscribir} className="space-y-3">
      {v?.id && <input type="hidden" name="id" value={v.id} />}
      {s.mensaje && !s.ok && <Alerta tipo="cuidado">{s.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector nombre="programa" etiqueta="Programa" requerido error={e.programa} defaultValue={v?.programa}
                  opciones={PROGRAMAS.map((p) => ({ valor: p, texto: p }))} />
        <Campo nombre="nivel_desde" etiqueta="Del nivel" requerido inputMode="numeric" error={e.nivel_desde} defaultValue={v?.nivel_desde} ayuda="Orden del nivel en su programa" />
        <Campo nombre="nivel_hasta" etiqueta="Al nivel" requerido inputMode="numeric" error={e.nivel_hasta} defaultValue={v?.nivel_hasta} ayuda="Incluido" />
        <Campo nombre="vigente_desde" etiqueta="Vigente desde" requerido type="date" error={e.vigente_desde} defaultValue={v?.vigente_desde}
               ayuda="Se aplica a los grupos que inician desde esa fecha" />
        <Campo nombre="nota_minima" etiqueta="Aprueba con" requerido inputMode="numeric" error={e.nota_minima} defaultValue={v?.nota_minima} />
        <Campo nombre="condicionado_desde" etiqueta="Condicionado desde" inputMode="numeric" error={e.condicionado_desde} defaultValue={v?.condicionado_desde}
               ayuda="Vacío si no hay Condicionado. Ej.: 77 con mínima 80" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="provisional" defaultChecked={v ? v.provisional : true} className="size-4" />
        Provisional: el valor no está confirmado por la academia y se puede corregir después
      </label>
      <BotonEnviar>{boton}</BotonEnviar>
    </form>
  );
}

export function EliminarRegla({ id, nombre }: { id: string; nombre: string }) {
  const [s, accion] = useActionState<EstadoRegla, FormData>(accionEliminarRegla, {});
  useConfirmarExito(s, !!s.ok, s.mensaje);
  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <BotonConfirmar pequeno pregunta={`¿Eliminar la regla de ${nombre}?`} confirmar="Eliminar" enviando="Eliminando…">Eliminar</BotonConfirmar>
      {s.mensaje && !s.ok && <Alerta tipo="cuidado">{s.mensaje}</Alerta>}
    </form>
  );
}
