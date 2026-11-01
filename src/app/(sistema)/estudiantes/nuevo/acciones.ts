"use server";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { clienteSesion } from "@/servidor/supabase";
import { exigirAcceso } from "@/servidor/sesion";
import { rpcDeSupabase } from "@/datos/rpc";
import { registrarEstudiante, actualizarEstudiante, type Candidato } from "@/datos/estudiantes";
import { revisarEstudiante, type EntradaEstudiante, type Errores } from "@/dominio/formulario-estudiante";
import { hoyEnManagua } from "@/dominio/edad";
import { validarCedula } from "@/dominio/cedula";

export interface EstadoRegistro {
  valores?: Partial<EntradaEstudiante>;
  errores?: Errores;
  mensaje?: string;
  existente?: { id: string; codigo_adei: string; nombre: string };
  coincidencias?: Candidato[];
  completar?: Candidato[];
}

const CAMPOS: (keyof EntradaEstudiante)[] = ["cedula", "nombres", "apellidos", "fecha_nacimiento", "telefono", "correo",
  "direccion", "contacto_emergencia", "sucursal_id", "tutor_cedula", "tutor_nombre", "tutor_telefono"];

export async function accionRegistrar(_p: EstadoRegistro, datos: FormData): Promise<EstadoRegistro> {
  await exigirAcceso(["asistente"]);
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(datos.get(c) ?? "")])) as unknown as EntradaEstudiante;
  const confirmar = datos.get("confirmar") === "otra-persona";

  const revision = revisarEstudiante(valores, hoyEnManagua(new Date()));
  if (Object.keys(revision.errores).length) return { valores, errores: revision.errores };

  const rpc = rpcDeSupabase(await clienteSesion());
  const r = await registrarEstudiante(rpc, revision.datos, confirmar);
  switch (r.estado) {
    case "registrado": redirect(`/estudiantes/${r.id}?registrado=1` as Route);
    case "cedula_existente":
      return { valores, errores: { cedula: "Esta cédula ya pertenece a otro estudiante." },
               existente: { id: r.expediente.id, codigo_adei: r.expediente.codigo_adei, nombre: `${r.expediente.nombres} ${r.expediente.apellidos}` } };
    case "coincidencias": return { valores, coincidencias: r.candidatos };
    case "completar": return { valores, completar: r.candidatos };
    case "error": return { valores, mensaje: r.campo ? undefined : r.mensaje, errores: r.campo ? { [r.campo]: r.mensaje } : undefined };
  }
}

/** CE-79: completar el expediente existente con la cédula, en lugar de duplicarlo. */
export async function accionCompletarCedula(datos: FormData) {
  await exigirAcceso(["asistente"]);
  const id = String(datos.get("id")); const ced = validarCedula(String(datos.get("cedula") ?? ""));
  if (!ced.ok) return;
  const supabase = await clienteSesion();
  const { data } = await supabase.from("estudiante").select("version").eq("id", id).maybeSingle();
  if (!data) return;
  const r = await actualizarEstudiante(rpcDeSupabase(supabase), id, data.version, { cedula: ced.valor });
  redirect(`/estudiantes/${id}?${r.estado === "actualizado" ? "completado=1" : "conflicto=1"}` as Route);
}

/** CE-38: si el tutor ya existe, se vincula sin volver a escribir sus datos. */
export async function buscarTutor(cedula: string): Promise<{ nombre_completo: string; telefono: string } | null> {
  await exigirAcceso(["asistente"]);
  const ced = validarCedula(cedula);
  if (!ced.ok) return null;
  const supabase = await clienteSesion();
  const { data } = await supabase.from("tutor").select("nombre_completo, telefono").eq("cedula", ced.valor).maybeSingle();
  return data;
}
