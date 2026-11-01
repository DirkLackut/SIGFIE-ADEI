/**
 * Revisión del formulario de estudiante ANTES de enviarlo a la base (CE-33 a
 * CE-37). Avisa a tiempo y por campo; la base vuelve a revisar todo y es la que
 * manda (principio 1). Lógica pura: la usa la pantalla y la prueban los tests.
 */
import { validarCedula } from "./cedula";
import { validarNombre, limpiarEspacios } from "./texto";
import { validarFechaNacimiento, esMenorDeEdad, type FechaISO } from "./edad";

export type Errores = Record<string, string>;

export interface EntradaEstudiante {
  cedula: string; nombres: string; apellidos: string; fecha_nacimiento: string;
  telefono: string; correo: string; direccion: string; contacto_emergencia: string; sucursal_id: string;
  tutor_cedula: string; tutor_nombre: string; tutor_telefono: string;
}

export const TELEFONO = /^\d{8}$/;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Teléfono nicaragüense de 8 dígitos; acepta que lo escriban con espacios o guion. */
export const limpiarTelefono = (t: string) => t.replace(/[\s-]/g, "");

/**
 * @param opciones.edicion  Al editar: el tutor se administra aparte (CE-82) y un
 *   adulto sin teléfono se advierte en vez de bloquear (CE-80).
 */
export function revisarEstudiante(e: EntradaEstudiante, hoy: FechaISO, opciones: { edicion?: boolean } = {}) {
  const errores: Errores = {};
  const set = (campo: string, r: { ok: true; valor: string } | { ok: false; regla: string }) => {
    if (!r.ok) errores[campo] = r.regla;
    return r.ok ? r.valor : undefined;
  };

  const nombres = set("nombres", validarNombre(e.nombres));
  const apellidos = set("apellidos", validarNombre(e.apellidos));
  const cedula = e.cedula.trim() ? set("cedula", validarCedula(e.cedula)) : undefined;

  let menor = false;
  if (!e.fecha_nacimiento) errores.fecha_nacimiento = "Indique la fecha de nacimiento.";
  else if (set("fecha_nacimiento", validarFechaNacimiento(e.fecha_nacimiento, hoy))) menor = esMenorDeEdad(e.fecha_nacimiento, hoy);

  const telefono = limpiarTelefono(e.telefono);
  if (telefono && !TELEFONO.test(telefono)) errores.telefono = "Debe tener 8 dígitos.";
  else if (!telefono && e.fecha_nacimiento && !errores.fecha_nacimiento && !menor && !opciones.edicion)
    errores.telefono = "Es obligatorio para mayores de 18 años.";                       // CE-35

  const correo = e.correo.trim().toLowerCase();
  if (correo && (!CORREO.test(correo) || correo.length > 100)) errores.correo = "No es un correo válido (ejemplo: nombre@correo.com).";
  if (e.direccion.trim().length > 200) errores.direccion = "Puede tener como máximo 200 caracteres.";
  if (menor && !e.contacto_emergencia.trim()) errores.contacto_emergencia = "Es obligatorio para menores de 18 años."; // CE-34
  if (!e.sucursal_id) errores.sucursal_id = "Elija la sucursal.";

  let tutor: { cedula: string; nombre_completo?: string; telefono?: string } | undefined;
  if (menor && !opciones.edicion) {                                                  // CE-33
    const tc = e.tutor_cedula.trim() ? set("tutor_cedula", validarCedula(e.tutor_cedula)) : undefined;
    if (!e.tutor_cedula.trim()) errores.tutor_cedula = "La cédula del tutor es obligatoria.";
    const nombreTutor = limpiarEspacios(e.tutor_nombre);
    const telTutor = limpiarTelefono(e.tutor_telefono);
    if (nombreTutor.length < 5) errores.tutor_nombre = "Escriba el nombre completo del tutor.";
    if (!TELEFONO.test(telTutor)) errores.tutor_telefono = "Debe tener 8 dígitos.";
    if (tc) tutor = { cedula: tc, nombre_completo: nombreTutor, telefono: telTutor };
  }

  return {
    errores, menor,
    datos: {
      cedula, nombres: nombres ?? e.nombres, apellidos: apellidos ?? e.apellidos,
      fecha_nacimiento: e.fecha_nacimiento, telefono: telefono || undefined, correo: correo || undefined,
      direccion: limpiarEspacios(e.direccion) || undefined, contacto_emergencia: limpiarEspacios(e.contacto_emergencia) || undefined,
      sucursal_id: e.sucursal_id, tutores: tutor ? [tutor] : undefined,
    },
  };
}
