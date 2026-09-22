import { Hono } from "hono";
import { ilike, or, eq, and, sql, desc, inArray } from "drizzle-orm";
import { db, schema } from "../db";

export const activityLogRoutes = new Hono();

activityLogRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const search = c.req.query("search") || "";
  const aksi = c.req.query("aksi") || "";
  const namaTabel = c.req.query("namaTabel") || "";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(schema.activityLogs.aksi, `%${search}%`),
        ilike(schema.activityLogs.namaTabel, `%${search}%`),
        ilike(schema.activityLogs.keterangan, `%${search}%`)
      )
    );
  }
  if (aksi) {
    conditions.push(eq(schema.activityLogs.aksi, aksi));
  }
  if (namaTabel) {
    conditions.push(eq(schema.activityLogs.namaTabel, namaTabel));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.activityLogs)
    .leftJoin(schema.users, eq(schema.activityLogs.idUser, schema.users.idUsers))
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(where);

  const rows = await db
    .select({
      idLog: schema.activityLogs.idLog,
      idUser: schema.activityLogs.idUser,
      aksi: schema.activityLogs.aksi,
      namaTabel: schema.activityLogs.namaTabel,
      idReferensi: schema.activityLogs.idReferensi,
      keterangan: schema.activityLogs.keterangan,
      oldValues: schema.activityLogs.oldValues,
      newValues: schema.activityLogs.newValues,
      ipAddress: schema.activityLogs.ipAddress,
      userAgent: schema.activityLogs.userAgent,
      createdAt: schema.activityLogs.createdAt,
      username: schema.users.username,
    })
    .from(schema.activityLogs)
    .leftJoin(schema.users, eq(schema.activityLogs.idUser, schema.users.idUsers))
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(where)
    .orderBy(desc(schema.activityLogs.createdAt))
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

activityLogRoutes.delete("/bulk", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];

  if (ids.length === 0) {
    return c.json({ status: "error", message: "No logs selected" }, 400);
  }

  await db.delete(schema.activityLogs).where(inArray(schema.activityLogs.idLog, ids));
  return c.json({ status: "ok", message: `${ids.length} log(s) deleted` });
});

activityLogRoutes.delete("/all", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { aksi, namaTabel } = body || {};
  const conditions = [];
  if (aksi) conditions.push(eq(schema.activityLogs.aksi, aksi));
  if (namaTabel) conditions.push(eq(schema.activityLogs.namaTabel, namaTabel));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.activityLogs)
    .where(where);

  await db.delete(schema.activityLogs).where(where);
  return c.json({
    status: "ok",
    message: `${countRow?.count ?? 0} log(s) deleted`,
  });
});
