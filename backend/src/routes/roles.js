import { Hono } from "hono";
import { eq, isNull, sql, and, not } from "drizzle-orm";
import { db, schema } from "../db";

export const roleRoutes = new Hono();

roleRoutes.get("/", async (c) => {
  const rows = await db
    .select({
      idRole: schema.role.idRole,
      role: schema.role.role,
      createdAt: schema.role.createdAt,
    })
    .from(schema.role)
    .where(
      and(isNull(schema.role.deletedAt), not(eq(schema.role.role, "superadmin")))
    );

  return c.json({ status: "ok", data: rows });
});

roleRoutes.get("/permissions", async (c) => {
  const rows = await db
    .select({
      idPermission: schema.permissions.idPermission,
      namaPermission: schema.permissions.namaPermission,
      fitur: schema.permissions.fitur,
    })
    .from(schema.permissions)
    .where(isNull(schema.permissions.deletedAt));

  return c.json({ status: "ok", data: rows });
});

roleRoutes.get("/:id/permissions", async (c) => {
  const id = Number(c.req.param("id"));
  const rows = await db
    .select({
      idPermission: schema.permissions.idPermission,
      namaPermission: schema.permissions.namaPermission,
      fitur: schema.permissions.fitur,
    })
    .from(schema.rolePermissions)
    .innerJoin(
      schema.permissions,
      eq(schema.rolePermissions.idPermission, schema.permissions.idPermission)
    )
    .where(eq(schema.rolePermissions.idRole, id));

  return c.json({ status: "ok", data: rows });
});
