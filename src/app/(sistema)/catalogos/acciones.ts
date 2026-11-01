"use server";
import { revalidatePath } from "next/cache";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { traducirError } from "@/datos/errores";
import { CAMPOS, TIENE_ACTIVO, duplicado, homonimos, revisarCatalogo, type Entidad } from "@/dominio/catalogos";
import { desactivarCuentaDeSesion } from "@/servidor/cuentas-accion";

export interface EstadoCatalogo {
  ok?: boolean; mensaje?: string; errores?: Record<string, string>; valores?: Record<string, string>;
  /** Cambia en cada alta exitosa: el formulario se vacía para la siguiente. */
  marca?: number;
  homonimos?: { id: string; nombres: string; apellidos: string; telefono: string }[];
  ofrecerDesactivar?: boolean;
  cuentaActiva?: { id: string; nombre_usuario: string };
}

const ENTIDADES: Entidad[] = ["sucursal", "modalidad", "horario", "nivel", "profesor"];
const NOMBRE: Record<Entidad, string> = { sucursal: "La sucursal", modalidad: "La modalidad", horario: "El horario", nivel: "El nivel", profesor: "El profesor" };
const entidadDe = (fd: FormData) => { const e = String(fd.get("entidad")); if (!ENTIDADES.includes(e as Entidad)) throw new Error("entidad"); return e as Entidad; };

/** Crear o editar un valor de catálogo (CE-21 a CE-28, CE-74, CE-75). */
export async function accionGuardarCatalogo(_p: EstadoCatalogo, fd: FormData): Promise<EstadoCatalogo> {
  await exigirAcceso(["asistente"]);
  const entidad = entidadDe(fd);
  const id = String(fd.get("id") ?? "") || undefined;
  const valores = Object.fromEntries(CAMPOS[entidad].map((c) => [c, String(fd.get(c) ?? "")]));
  const { datos, errores } = revisarCatalogo(entidad, valores);
  if (Object.keys(errores).length) return { errores, valores };

  const s = await clienteSesion();
  const { data: existentes } = await s.from(entidad as never).select("*");
  const lista = (existentes ?? []) as unknown as ({ id: string } & Record<string, unknown>)[];

  const dup = duplicado(entidad, datos, lista, id);
  if (dup) {
    const cual = entidad === "horario" ? "ese horario en esa modalidad" : `«${String(dup.registro[dup.campo])}»`;
    return { valores, errores: { [dup.campo]: `Ya existe ${cual}.${dup.registro.activo === false ? " Está desactivado: puede activarlo en la lista." : ""}` } };
  }
  if (entidad === "profesor" && fd.get("confirmar") !== "otra-persona") {
    const h = homonimos(datos as { nombres: string; apellidos: string }, lista as never, id) as unknown as EstadoCatalogo["homonimos"];
    if (h?.length) return { valores, homonimos: h };
  }

  const { error } = id
    ? await s.from(entidad as never).update(datos as never).eq("id", id)
    : await s.from(entidad as never).insert(datos as never);
  if (error) { const t = traducirError(error); return { valores, errores: t.campo ? { [t.campo]: t.mensaje } : undefined, mensaje: t.campo ? undefined : t.mensaje }; }
  revalidatePath("/catalogos");
  return { ok: true, marca: Date.now(), mensaje: id ? "Cambios guardados." : `${NOMBRE[entidad]} se agregó.` };
}

/** Activar, desactivar o eliminar (CE-23, CE-24, CE-25, CE-83). */
export async function accionCambiarCatalogo(_p: EstadoCatalogo, fd: FormData): Promise<EstadoCatalogo> {
  await exigirAcceso(["asistente"]);
  const entidad = entidadDe(fd);
  const id = String(fd.get("id"));
  const op = String(fd.get("operacion"));
  const s = await clienteSesion();

  if (op === "eliminar") {
    const { error } = await s.from(entidad as never).delete().eq("id", id);
    if (error?.code === "23503")                                                           // CE-23
      return { mensaje: `No se puede eliminar porque ya se usa en otros registros.${TIENE_ACTIVO[entidad] ? " Puede desactivarlo: dejará de ofrecerse, pero se seguirá viendo donde ya se usó." : ""}`, ofrecerDesactivar: TIENE_ACTIVO[entidad] };
    if (error) return { mensaje: traducirError(error).mensaje };
    revalidatePath("/catalogos");
    return { ok: true, mensaje: "Eliminado." };
  }

  if (op === "desactivar_cuenta") {                                                         // CE-83
    const r = await desactivarCuentaDeSesion(String(fd.get("usuario_id")));
    revalidatePath("/catalogos");
    return r.ok ? { ok: true, mensaje: "Profesor y cuenta desactivados." } : { mensaje: r.mensaje };
  }

  if (!TIENE_ACTIVO[entidad] || (op !== "activar" && op !== "desactivar")) return { mensaje: "Operación no válida." };
  const { error } = await s.from(entidad as never).update({ activo: op === "activar" } as never).eq("id", id);
  if (error) return { mensaje: traducirError(error).mensaje };
  revalidatePath("/catalogos");

  if (entidad === "profesor" && op === "desactivar") {
    const { data: cuenta } = await s.from("usuario").select("id, nombre_usuario").eq("profesor_id", id).eq("estado", "activo").maybeSingle();
    if (cuenta) return { ok: true, cuentaActiva: cuenta,
      mensaje: `Profesor desactivado. Todavía tiene una cuenta activa («${cuenta.nombre_usuario}») con la que puede ingresar.` };
  }
  return { ok: true, mensaje: op === "activar" ? "Activado." : "Desactivado: ya no se ofrece en registros nuevos." };
}
