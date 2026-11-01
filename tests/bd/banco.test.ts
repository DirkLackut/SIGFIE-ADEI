/**
 * T2 — El banco de pruebas de base de datos funciona y se parece a Supabase
 * en lo que importa: orden de migraciones, usuarios, permisos y RLS.
 */
import { describe, test, expect } from "vitest";
import { join } from "node:path";
import {
  crearBanco, crearUsuarioAuth, comoUsuario, comoAnonimo, comoServicio, listarMigraciones,
} from "../apoyo/banco";

const EJEMPLOS = join(__dirname, "../apoyo/migraciones-de-ejemplo");

describe("migraciones", () => {
  test("aplica todas las migraciones reales de supabase/migrations", async () => {
    const { aplicadas } = await crearBanco();
    expect(aplicadas).toEqual(listarMigraciones().filter((f) => !f.endsWith("_semilla.sql")));
  });

  test("las aplica en orden de nombre: 001, 002, 010", async () => {
    const { db, aplicadas } = await crearBanco(join(EJEMPLOS, "orden"));
    expect(aplicadas).toEqual(["001_base.sql", "002_depende.sql", "010_despues.sql"]);
    const r = await db.query<{ n: number }>("select count(*)::int n from grupo_ejemplo");
    expect(r.rows[0].n).toBe(1);
  });

  test("si una migración falla, dice cuál", async () => {
    await expect(crearBanco(join(EJEMPLOS, "falla"))).rejects.toThrow(/002_rota\.sql/);
  });
});

describe("usuarios simulados", () => {
  test("dentro de comoUsuario, auth.uid() y la sesión son los del usuario", async () => {
    const { db } = await crearBanco(join(EJEMPLOS, "orden"));
    const u = await crearUsuarioAuth(db);
    const r = await comoUsuario(db, u, (tx) =>
      tx.query<{ uid: string; sesion: string; rol: string }>(
        "select auth.uid()::text uid, auth.jwt()->>'session_id' sesion, current_user rol",
      ),
    );
    expect(r.rows[0]).toEqual({ uid: u.id, sesion: u.sesion, rol: "authenticated" });
  });

  test("al salir de comoUsuario no queda ningún usuario ni rol puesto", async () => {
    const { db } = await crearBanco(join(EJEMPLOS, "orden"));
    const u = await crearUsuarioAuth(db);
    await comoUsuario(db, u, (tx) => tx.query("select 1"));
    const r = await db.query<{ uid: string | null; rol: string }>(
      "select auth.uid()::text uid, current_user rol",
    );
    expect(r.rows[0].uid).toBeNull();
    expect(r.rows[0].rol).not.toBe("authenticated");
  });

  test("si la prueba falla a mitad, se deshace lo que hizo", async () => {
    const { db } = await crearBanco(join(EJEMPLOS, "permisos"));
    const u = await crearUsuarioAuth(db);
    await expect(
      comoUsuario(db, u, async (tx) => {
        await tx.query("insert into nota_ejemplo (texto) values ('a medias')");
        throw new Error("falla a propósito");
      }),
    ).rejects.toThrow("falla a propósito");
    const r = await db.query<{ n: number }>("select count(*)::int n from nota_ejemplo");
    expect(r.rows[0].n).toBe(0);
  });
});

describe("se comporta como el proyecto sigfie-adei", () => {
  test("'Enable automatic RLS': una tabla nueva nace con RLS aunque la migración no lo pida", async () => {
    const { db } = await crearBanco(join(EJEMPLOS, "permisos"));
    const r = await db.query<{ rls: boolean }>(
      "select relrowsecurity rls from pg_class where relname = 'nota_ejemplo'",
    );
    expect(r.rows[0].rls).toBe(true);
  });

  test("'Automatically expose new tables' apagado: sin GRANT, nadie la puede leer", async () => {
    // Solo la primera migración: la tabla existe, pero todavía nadie le dio permisos.
    const { db } = await crearBanco(join(EJEMPLOS, "permisos"));
    await db.exec("revoke all on public.nota_ejemplo from authenticated");
    const u = await crearUsuarioAuth(db);
    await expect(comoUsuario(db, u, (tx) => tx.query("select * from nota_ejemplo"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(comoAnonimo(db, (tx) => tx.query("select * from nota_ejemplo"))).rejects.toThrow(
      /permission denied/,
    );
  });

  test("con GRANT y política, cada usuario ve solo lo suyo y el servicio ve todo", async () => {
    const { db } = await crearBanco(join(EJEMPLOS, "permisos"));
    const ana = await crearUsuarioAuth(db);
    const beto = await crearUsuarioAuth(db);
    await comoUsuario(db, ana, (tx) => tx.query("insert into nota_ejemplo (texto) values ('de Ana')"));
    await comoUsuario(db, beto, (tx) => tx.query("insert into nota_ejemplo (texto) values ('de Beto')"));

    const deAna = await comoUsuario(db, ana, (tx) =>
      tx.query<{ texto: string }>("select texto from nota_ejemplo"),
    );
    expect(deAna.rows.map((x) => x.texto)).toEqual(["de Ana"]);

    const todas = await comoServicio(db, (tx) =>
      tx.query<{ texto: string }>("select texto from nota_ejemplo order by id"),
    );
    expect(todas.rows.map((x) => x.texto)).toEqual(["de Ana", "de Beto"]);
  });

  test("sin GRANT, ni la clave de servicio puede leer, aunque ignore RLS", async () => {
    // Igual que en el proyecto real: ignorar RLS no es lo mismo que tener permiso.
    const { db } = await crearBanco(join(EJEMPLOS, "permisos"));
    await db.exec("revoke all on public.nota_ejemplo from service_role");
    await expect(comoServicio(db, (tx) => tx.query("select * from nota_ejemplo"))).rejects.toThrow(
      /permission denied/,
    );
  });

  test("un usuario no puede insertar a nombre de otro", async () => {
    const { db } = await crearBanco(join(EJEMPLOS, "permisos"));
    const ana = await crearUsuarioAuth(db);
    const beto = await crearUsuarioAuth(db);
    await expect(
      comoUsuario(db, ana, (tx) =>
        tx.query("insert into nota_ejemplo (duenio, texto) values ($1, 'suplantación')", [beto.id]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
