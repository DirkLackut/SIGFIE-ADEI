/**
 * A qué pantalla va cada persona según el estado de su sesión. Lógica pura: la
 * usan proxy.ts (en cada navegación) y las pruebas (sin servidor ni base).
 *
 * Esto guía a la persona; NO protege los datos. Lo que protege es la base:
 * acceso_habilitado() en cada política RLS (plan §5.4, CE-62). Si alguien se
 * salta esta redirección llamando a la API, igual no ve nada.
 */

export type Rol = "asistente" | "direccion" | "profesor" | "admin_tecnico";

/** Lo que devuelve mi_estado_acceso() (migración 010). */
export type EstadoAcceso =
  | { cuenta: false }
  | {
      cuenta: true;
      activo: boolean;
      debe_cambiar: boolean;
      aviso_aceptado: boolean;
      roles: Rol[];
      nombre_usuario: string;
      organizacion: string;
      version_aviso: string | null;
      profesor_id: string | null;
    };

export type Decision =
  | { tipo: "seguir" }
  | { tipo: "redirigir"; a: string };

/** Pantallas que se ven sin sesión. */
const PUBLICAS = ["/ingresar"];
/** Pantallas que se ven con sesión pero antes de tener acceso (CE-78). */
const PREVIAS = ["/cambiar-contrasena", "/aviso"];

/** Qué roles pueden abrir cada sección. Lo que no está aquí, lo abre cualquiera
 *  con acceso (por ejemplo /inicio). La base vuelve a comprobarlo en cada dato. */
const SECCIONES: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: "/cuentas", roles: ["asistente"] },
  { prefijo: "/catalogos", roles: ["asistente"] },
  { prefijo: "/estudiantes/nuevo", roles: ["asistente"] },
  { prefijo: "/grupos/nuevo", roles: ["asistente"] },
  { prefijo: "/estudiantes", roles: ["asistente", "direccion"] },   // CE-46
  { prefijo: "/grupos", roles: ["asistente", "direccion"] },
  { prefijo: "/mis-grupos", roles: ["profesor"] },                        // 002·CE-1
  { prefijo: "/reglas", roles: ["asistente", "direccion"] },              // 002·CE-25, CE-58
  { prefijo: "/actas", roles: ["asistente", "direccion", "profesor"] },   // 002·CE-50: la base decide qué grupo
];

const empiezaCon = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(prefijo + "/");

export function puedeAbrir(roles: Rol[], ruta: string): boolean {
  const seccion = SECCIONES.find((s) => empiezaCon(ruta, s.prefijo));
  return !seccion || seccion.roles.some((r) => roles.includes(r));
}

/**
 * @param estado  null si no hay sesión de Supabase.
 * @param ruta    pathname pedido.
 */
export function decidirRuta(estado: EstadoAcceso | null, ruta: string): Decision {
  // Salir siempre se puede, en cualquier estado.
  if (empiezaCon(ruta, "/salir")) return { tipo: "seguir" };
  const publica = PUBLICAS.some((p) => empiezaCon(ruta, p));

  if (!estado) return publica ? { tipo: "seguir" } : { tipo: "redirigir", a: "/ingresar" };

  // Sesión de Auth sin cuenta en SIGFIE, o cuenta desactivada (CE-4, CE-7): se
  // cierra la sesión.
  if (!estado.cuenta || !estado.activo) return { tipo: "redirigir", a: "/salir?motivo=cuenta" };

  // CE-9: primero la contraseña temporal. Nada más se abre hasta cambiarla.
  if (estado.debe_cambiar) {
    return ruta === "/cambiar-contrasena" ? { tipo: "seguir" } : { tipo: "redirigir", a: "/cambiar-contrasena" };
  }

  // CE-14, CE-15: el aviso, en cada sesión, antes de cualquier dato. Cambiar la
  // contraseña propia se permite también (CE-78).
  if (!estado.aviso_aceptado) {
    return PREVIAS.includes(ruta) ? { tipo: "seguir" } : { tipo: "redirigir", a: "/aviso" };
  }

  // Con acceso: las pantallas previas y el ingreso ya no tienen sentido.
  if (publica || ruta === "/aviso" || ruta === "/") return { tipo: "redirigir", a: "/inicio" };

  if (!puedeAbrir(estado.roles, ruta)) return { tipo: "redirigir", a: "/inicio?aviso=sin-permiso" };
  return { tipo: "seguir" };
}
