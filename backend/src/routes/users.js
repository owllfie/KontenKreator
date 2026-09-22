import { Hono } from "hono";
import { eq, ilike, or, isNull, sql, and, desc, not, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { writeLog } from "../lib/activity-log";

export const userRoutes = new Hono();

async function hashPassword(password) {
  return Bun.password.hash(password, { algorithm: "bcrypt" });
}

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
        ilike(schema.users.username, `%${search}%`),
        ilike(schema.users.email, `%${search}%`),
        ilike(schema.users.noTelp, `%${search}%`)
      )
    );
  }
  if (status) {
    conditions.push(eq(schema.users.status, status));
  }
  if (role) {
    conditions.push(eq(schema.users.idRole, Number(role)));
  }

  conditions.push(not(eq(schema.role.role, "Superadmin")));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(where);

  const rows = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      namaLengkap: schema.users.namaLengkap,
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
    .orderBy(desc(schema.users.createdAt), desc(schema.users.idUsers))
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
      namaLengkap: schema.users.namaLengkap,
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

  if (!row || (row.roleName || "").toLowerCase() === "superadmin") {
    return c.json({ status: "error", message: "User not found" }, 404);
  }
  return c.json({ status: "ok", data: row });
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { username, namaLengkap, email, password, noTelp, idRole, status } = body;

  if (!username || !email || !idRole || !Number(idRole)) {
    return c.json({ status: "error", message: "Username, email, and role are required" }, 400);
  }

  const [existingEmail] = await db
    .select({ idUsers: schema.users.idUsers })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existingEmail) {
    return c.json({ status: "error", message: "Email is already registered" }, 409);
  }

  const hashedPassword = password ? await hashPassword(password) : null;

  const [created] = await db
    .insert(schema.users)
    .values({
      username,
      namaLengkap: namaLengkap || null,
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
  const { username, namaLengkap, email, noTelp, idRole, status } = body;

  const [updated] = await db
    .update(schema.users)
    .set({
      username,
      namaLengkap: namaLengkap || null,
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
  const hashed = await hashPassword(defaultPassword);

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
  return c.json({ status: "ok", message: "User deleted" });
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

userRoutes.post("/bulk-delete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];

  if (ids.length === 0) {
    return c.json({ status: "error", message: "No users selected" }, 400);
  }

  const rows = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      roleName: schema.role.role,
    })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(and(inArray(schema.users.idUsers, ids), isNull(schema.users.deletedAt), not(eq(schema.role.role, "Superadmin"))));

  if (rows.length > 0) {
    await db
      .update(schema.users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(schema.users.idUsers, rows.map((r) => r.idUsers)));

    const actorId = Number(c.get("jwtPayload")?.id_users);
    for (const row of rows) {
      await writeLog({
        idUser: row.idUsers,
        aksi: "DELETE",
        namaTabel: "user",
        idReferensi: row.idUsers,
        keterangan: `User "${row.username}" deleted`,
      });
    }
    if (actorId) {
      await writeLog({
        idUser: actorId,
        aksi: "DELETE",
        namaTabel: "user",
        idReferensi: 0,
        keterangan: `Bulk deleted ${rows.length} user(s)`,
      });
    }
  }

  return c.json({ status: "ok", message: `${rows.length} user(s) deleted` });
});

userRoutes.post("/delete-all", async (c) => {
  const rows = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      roleName: schema.role.role,
    })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(and(isNull(schema.users.deletedAt), not(eq(schema.role.role, "Superadmin"))));

  if (rows.length > 0) {
    await db
      .update(schema.users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(schema.users.idUsers, rows.map((r) => r.idUsers)));

    const actorId = Number(c.get("jwtPayload")?.id_users);
    for (const row of rows) {
      await writeLog({
        idUser: row.idUsers,
        aksi: "DELETE",
        namaTabel: "user",
        idReferensi: row.idUsers,
        keterangan: `User "${row.username}" deleted`,
      });
    }
    if (actorId) {
      await writeLog({
        idUser: actorId,
        aksi: "DELETE",
        namaTabel: "user",
        idReferensi: 0,
        keterangan: `Bulk deleted all users (${rows.length})`,
      });
    }
  }

  return c.json({ status: "ok", message: `${rows.length} user(s) deleted` });
});
