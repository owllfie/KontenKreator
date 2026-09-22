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
      and(isNull(schema.role.deletedAt), not(eq(schema.role.role, "Superadmin")))
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

roleRoutes.put("/:id/permissions", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const [user] = await db
      .select({ role: schema.role.role })
      .from(schema.users)
      .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
      .where(eq(schema.users.idUsers, payload?.id_users))
      .limit(1);
    if (!user || (user.role || "").toLowerCase() !== "superadmin") {
      return c.json({ status: "error", message: "Forbidden: superadmin access required" }, 403);
    }

    const id = Number(c.req.param("id"));
    const body = await c.req.json().catch(() => ({}));
    const perms = Array.isArray(body?.permissions) ? body.permissions : [];

    const [roleRow] = await db
      .select()
      .from(schema.role)
      .where(eq(schema.role.idRole, id))
      .limit(1);
    if (!roleRow) {
      return c.json({ status: "error", message: "Role not found" }, 404);
    }
    if ((roleRow.role || "").toLowerCase() === "superadmin") {
      return c.json({ status: "error", message: "Cannot modify the Superadmin role" }, 403);
    }

    const permIds = Array.from(new Set(perms.map(Number).filter(Boolean)));

    await db
      .delete(schema.rolePermissions)
      .where(eq(schema.rolePermissions.idRole, id));

    if (permIds.length > 0) {
      await db.insert(schema.rolePermissions).values(
        permIds.map((idPermission) => ({ idRole: id, idPermission }))
      );
    }

    return c.json({ status: "ok", data: { idRole: id, permissions: permIds } });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});
