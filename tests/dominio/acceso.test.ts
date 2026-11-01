import { describe, test, expect } from "vitest";
import { decidirRuta, puedeAbrir, type EstadoAcceso, type Rol } from "@/dominio/acceso";

const estado = (cambios: Partial<Extract<EstadoAcceso, { cuenta: true }>> = {}): EstadoAcceso => ({
  cuenta: true, activo: true, debe_cambiar: false, aviso_aceptado: true, roles: ["asistente"],
  nombre_usuario: "aura", organizacion: "ADEI", version_aviso: "v0.1", profesor_id: null, ...cambios,
});
const a = (destino: string) => ({ tipo: "redirigir", a: destino });
const sigue = { tipo: "seguir" };

describe("decidirRuta", () => {
  test("sin sesión solo se abre el ingreso", () => {
    expect(decidirRuta(null, "/ingresar")).toEqual(sigue);
    for (const r of ["/", "/inicio", "/estudiantes", "/aviso", "/cambiar-contrasena"])
      expect(decidirRuta(null, r), r).toEqual(a("/ingresar"));
  });

  test("CE-4 · CE-7 · cuenta inactiva o sesión sin cuenta: se cierra la sesión", () => {
    expect(decidirRuta(estado({ activo: false }), "/inicio")).toEqual(a("/salir?motivo=cuenta"));
    expect(decidirRuta({ cuenta: false }, "/aviso")).toEqual(a("/salir?motivo=cuenta"));
  });

  test("CE-9 · con contraseña temporal, todo lleva a cambiarla (incluso el aviso)", () => {
    const e = estado({ debe_cambiar: true, aviso_aceptado: false });
    for (const r of ["/inicio", "/aviso", "/estudiantes", "/ingresar"]) expect(decidirRuta(e, r), r).toEqual(a("/cambiar-contrasena"));
    expect(decidirRuta(e, "/cambiar-contrasena")).toEqual(sigue);
  });

  test("CE-14 · CE-15 · sin aviso aceptado en esta sesión, ninguna función se abre", () => {
    const e = estado({ aviso_aceptado: false });
    for (const r of ["/inicio", "/estudiantes", "/grupos/nuevo", "/ingresar", "/"]) expect(decidirRuta(e, r), r).toEqual(a("/aviso"));
    expect(decidirRuta(e, "/aviso")).toEqual(sigue);
  });

  test("CE-78 · cualquier rol puede cambiar su contraseña antes y después del aviso", () => {
    for (const roles of [["profesor"], ["direccion"], ["asistente"]] as Rol[][]) {
      expect(decidirRuta(estado({ roles, aviso_aceptado: false }), "/cambiar-contrasena")).toEqual(sigue);
      expect(decidirRuta(estado({ roles }), "/cambiar-contrasena")).toEqual(sigue);
    }
  });

  test("con acceso, el ingreso, el aviso y la raíz llevan al inicio", () => {
    for (const r of ["/ingresar", "/aviso", "/"]) expect(decidirRuta(estado(), r), r).toEqual(a("/inicio"));
    expect(decidirRuta(estado(), "/inicio")).toEqual(sigue);
  });

  test("CE-46 · CE-61 · cada rol abre solo sus secciones", () => {
    const prof = estado({ roles: ["profesor"] }), dir = estado({ roles: ["direccion"] });
    expect(decidirRuta(prof, "/estudiantes")).toEqual(a("/inicio?aviso=sin-permiso"));
    expect(decidirRuta(dir, "/estudiantes")).toEqual(sigue);
    expect(decidirRuta(dir, "/estudiantes/nuevo")).toEqual(a("/inicio?aviso=sin-permiso"));
    expect(decidirRuta(dir, "/cuentas")).toEqual(a("/inicio?aviso=sin-permiso"));
    expect(decidirRuta(estado(), "/cuentas")).toEqual(sigue);
  });

  test("CE-2 · con varios roles se suman los permisos", () => {
    expect(puedeAbrir(["direccion", "profesor"], "/estudiantes/abc")).toBe(true);
    expect(puedeAbrir(["profesor"], "/estudiantes/abc")).toBe(false);
  });

  test("salir siempre se puede, en cualquier estado", () => {
    for (const e of [null, { cuenta: false } as EstadoAcceso, estado({ debe_cambiar: true }), estado({ aviso_aceptado: false }), estado()])
      expect(decidirRuta(e, "/salir")).toEqual(sigue);
  });

  test("un prefijo no se confunde con otra ruta que empieza igual", () => {
    expect(puedeAbrir(["direccion"], "/cuentasx")).toBe(true);
    expect(puedeAbrir(["direccion"], "/cuentas/x")).toBe(false);
  });
});
