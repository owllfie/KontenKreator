import { Hono } from "hono";
import { like, or, eq, and, sql, desc, not } from "drizzle-orm";
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
        like(schema.activityLogs.aksi, `%${search}%`),
        like(schema.activityLogs.namaTabel, `%${search}%`),
        like(schema.activityLogs.keterangan, `%${search}%`)
      )
    );
  }
  if (aksi) {
    conditions.push(eq(schema.activityLogs.aksi, aksi));
  }
  if (namaTabel) {
    conditions.push(eq(schema.activityLogs.namaTabel, namaTabel));
  }
  // Hide activity performed by superadmin accounts.
  conditions.push(not(eq(schema.role.role, "superadmin")));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
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
