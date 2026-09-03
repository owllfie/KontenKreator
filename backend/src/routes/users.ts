import { Hono } from "hono";
import { eq, like, or, isNull, isNotNull, sql, and, desc, not } from "drizzle-orm";
import { db, schema } from "../db";

export const userRoutes = new Hono();

userRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const search = c.req.query("search") || "";
  const status = c.req.query("status") || "";
  const role = c.req.query("role") || "";
  const showDeleted = c.req.query("showDeleted") === "true";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (!showDeleted) {
    conditions.push(isNull(schema.users.deletedAt));
  }
  if (search) {
    conditions.push(
      or(
        like(schema.users.username, `%${search}%`),
        like(schema.users.email, `%${search}%`),
        like(schema.users.noTelp, `%${search}%`)
      )
    );
  }
  if (status) {
    conditions.push(eq(schema.users.status, status));
  }
  if (role) {
    conditions.push(eq(schema.users.idRole, Number(role)));
  }

  // Never expose superadmin users or the superadmin role through the web.
  conditions.push(not(eq(schema.role.role, "superadmin")));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(where);

  const rows = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      email: schema.users.email,
      noTelp: schema.users.noTelp,
      idRole: schema.users.idRole,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      deletedAt: schema.users.deletedAt,
      roleName: schema.role.role,
    })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(where)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    status: "ok",
    data: {
      rows,
      total: countRow?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countRow?.count ?? 0) / limit),
    },
  });
});

userRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [row] = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      email: schema.users.email,
      noTelp: schema.users.noTelp,
      idRole: schema.users.idRole,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      deletedAt: schema.users.deletedAt,
      roleName: schema.role.role,
    })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(eq(schema.users.idUsers, id))
    .limit(1);

  if (!row || row.roleName === "superadmin") {
    return c.json({ status: "error", message: "User not found" }, 404);
  }
  return c.json({ status: "ok", data: row });
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { username, email, password, noTelp, idRole, status } = body;

  if (!username || !email || !idRole) {
    return c.json({ status: "error", message: "Username, email, and role are required" }, 400);
  }

  const hashedPassword = password ? await Bun.password.hash(password) : null;

  const [created] = await db
    .insert(schema.users)
    .values({
      username,
      email,
      password: hashedPassword,
      noTelp: noTelp || null,
      idRole,
      status: status || "active",
    })
    .returning();

  return c.json({ status: "ok", data: created });
});

userRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { username, email, noTelp, idRole, status } = body;

  const [updated] = await db
    .update(schema.users)
    .set({
      username,
      email,
      noTelp: noTelp || null,
      idRole,
      status,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.idUsers, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "User not found" }, 404);
  return c.json({ status: "ok", data: updated });
});

userRoutes.put("/:id/reset-password", async (c) => {
  const id = Number(c.req.param("id"));
  const defaultPassword = "password";
  const hashed = await Bun.password.hash(defaultPassword);

  const [updated] = await db
    .update(schema.users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(schema.users.idUsers, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "User not found" }, 404);
  return c.json({ status: "ok", message: "Password reset to default" });
});

userRoutes.put("/:id/soft-delete", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.idUsers, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "User not found" }, 404);
  return c.json({ status: "ok", message: "User soft-deleted" });
});

userRoutes.put("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.users)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.users.idUsers, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "User not found" }, 404);
  return c.json({ status: "ok", message: "User restored" });
});

userRoutes.delete("/:id/permanent", async (c) => {
  const id = Number(c.req.param("id"));
  const [deleted] = await db
    .delete(schema.users)
    .where(eq(schema.users.idUsers, id))
    .returning();

  if (!deleted) return c.json({ status: "error", message: "User not found" }, 404);
  return c.json({ status: "ok", message: "User permanently deleted" });
});
