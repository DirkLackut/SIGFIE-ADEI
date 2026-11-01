"use server";
import { revalidatePath } from "next/cache";
import { clienteSesion } from "@/servidor/supabase";
import { exigirAcceso } from "@/servidor/sesion";
import { rpcDeSupabase } from "@/datos/rpc";
import { actualizarEstudiante, vincularTutor, desvincularTutor } from "@/datos/estudiantes";
import { revisarEstudiante, limpiarTelefono, TELEFONO, type EntradaEstudiante, type Errores } from "@/dominio/formulario-estudiante";
import { hoyEnManagua } from "@/dominio/edad";
import { validarCedula } from "@/dominio/cedula";
import { esUuid } from "@/dominio/formato";

export interface EstadoEdicion {
  errores?: Errores; mensaje?: string; tipo?: "exito" | "cuidado"; valores?: Partial<EntradaEstudiante>; version?: number;
}

const CAMPOS = ["cedula", "nombres", "apellidos", "fecha_nacimiento", "telefono", "correo", "direccion", "contacto_emergencia", "sucursal_id"] as const;

/** CE-40, CE-41 (el código no está entre los campos), CE-80, CE-81, CE-86. */
export async function accionEditar(_p: EstadoEdicion, datos: FormData): Promise<EstadoEdicion> {
  await exigirAcceso(["asistente"]);
  const id = String(datos.get("id")); const version = Number(datos.get("version"));
  if (!esUuid(id)) return { mensaje: "Expediente no válido.", tipo: "cuidado" };
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(datos.get(c) ?? "")])) as Partial<EntradaEstudiante>;
  const r1 = revisarEstudiante({ ...valores, tutor_cedula: "", tutor_nombre: "", tutor_telefono: "" } as EntradaEstudiante,
    hoyEnManagua(new Date()), { edicion: true });
  if (Object.keys(r1.errores).length) return { errores: r1.errores, valores, mensaje: "Revise los campos marcados. No se guardó nada.", tipo: "cuidado" };

  const d = r1.datos;
  const cambios = { cedula: d.cedula ?? "", nombres: d.nombres, apellidos: d.apellidos, fecha_nacimiento: d.fecha_nacimiento,
    telefono: d.telefono ?? "", correo: d.correo ?? "", direccion: d.direccion ?? "", contacto_emergencia: d.contacto_emergencia ?? "",
    sucursal_id: d.sucursal_id };
  const r = await actualizarEstudiante(rpcDeSupabase(await clienteSesion()), id, version, cambios);
  revalidatePath(`/estudiantes/${id}`);
  switch (r.estado) {
    case "actualizado":
      return { tipo: r.advertencias.includes("telefono_faltante") ? "cuidado" : "exito", version: r.version,
               mensaje: r.advertencias.includes("telefono_faltante")
                 ? "Cambios guardados. Este estudiante es mayor de edad y no tiene teléfono: conviene registrarlo."
                 : "Cambios guardados." };
    case "conflicto":
      return { valores, tipo: "cuidado", mensaje: "Otra persona modificó este expediente mientras usted lo editaba. No se guardó nada para no borrar sus cambios: recargue la página y vuelva a aplicar los suyos." };
    case "cedula_existente":
      return { valores, errores: { cedula: `Esa cédula ya pertenece a ${r.expediente.codigo_adei} (${r.expediente.nombres} ${r.expediente.apellidos}).` }, tipo: "cuidado", mensaje: "No se guardó." };
    case "error":
      return { valores, errores: r.campo ? { [r.campo]: r.mensaje } : undefined, tipo: "cuidado",
               mensaje: r.campo ? "No se guardó. Revise el campo marcado." : /tutor/.test(r.mensaje)
                 ? `${r.mensaje} Agregue primero el tutor (abajo) y luego cambie la fecha.` : r.mensaje };
  }
}

export interface EstadoTutor { mensaje?: string; tipo?: "exito" | "cuidado"; errores?: Errores }

export async function accionVincularTutor(_p: EstadoTutor, datos: FormData): Promise<EstadoTutor> {
  await exigirAcceso(["asistente"]);
  const id = String(datos.get("id"));
  const ced = validarCedula(String(datos.get("tutor_cedula") ?? ""));
  const nombre = String(datos.get("tutor_nombre") ?? "").replace(/\s+/g, " ").trim();
  const tel = limpiarTelefono(String(datos.get("tutor_telefono") ?? ""));
  const errores: Errores = {};
  if (!ced.ok) errores.tutor_cedula = ced.regla;
  if (nombre && nombre.length < 5) errores.tutor_nombre = "Escriba el nombre completo.";
  if (tel && !TELEFONO.test(tel)) errores.tutor_telefono = "Debe tener 8 dígitos.";
  if (Object.keys(errores).length || !ced.ok) return { errores, tipo: "cuidado", mensaje: "Revise los datos del tutor." };
  const r = await vincularTutor(rpcDeSupabase(await clienteSesion()), id,
    { cedula: ced.valor, ...(nombre ? { nombre_completo: nombre } : {}), ...(tel ? { telefono: tel } : {}) });
  revalidatePath(`/estudiantes/${id}`);
  return r.ok ? { tipo: "exito", mensaje: "Tutor vinculado." }
    : { tipo: "cuidado", mensaje: /null value|nombre_completo|telefono/.test(r.mensaje) || r.mensaje.startsWith("No se pudo")
        ? "Ese tutor no está registrado todavía: escriba también su nombre completo y su teléfono." : r.mensaje };
}

export async function accionDesvincularTutor(_p: EstadoTutor, datos: FormData): Promise<EstadoTutor> {
  await exigirAcceso(["asistente"]);
  const id = String(datos.get("id"));
  const r = await desvincularTutor(rpcDeSupabase(await clienteSesion()), id, String(datos.get("tutor_id")));
  revalidatePath(`/estudiantes/${id}`);
  return r.ok ? { tipo: "exito", mensaje: "Tutor desvinculado." }
    : { tipo: "cuidado", mensaje: /tutor/.test(r.mensaje) ? "No se puede quitar: es el único tutor de un menor de edad. Vincule otro tutor primero." : r.mensaje };
}
