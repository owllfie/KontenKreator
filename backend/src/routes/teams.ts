import { Hono } from "hono";
import { eq, like, or, isNull, and, sql, desc, not } from "drizzle-orm";
import { db, schema } from "../db";

export const teamRoutes = new Hono();

teamRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const search = c.req.query("search") || "";
  const showDeleted = c.req.query("showDeleted") === "true";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (!showDeleted) {
    conditions.push(isNull(schema.team.deletedAt));
  }
  if (search) {
    conditions.push(like(schema.team.namaTim, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.team)
    .where(where);

  const rows = await db
    .select()
    .from(schema.team)
    .where(where)
    .orderBy(desc(schema.team.createdAt))
    .limit(limit)
    .offset(offset);

  const rowsWithCount = await Promise.all(
    rows.map(async (row) => {
      const [memberCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.teamMember)
        .where(eq(schema.teamMember.idTeam, row.idTeam));
      return { ...row, memberCount: memberCount?.count ?? 0 };
    })
  );

  return c.json({
    status: "ok",
    data: {
      rows: rowsWithCount,
      total: countRow?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countRow?.count ?? 0) / limit),
    },
  });
});

teamRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [row] = await db.select().from(schema.team).where(eq(schema.team.idTeam, id)).limit(1);
  if (!row) return c.json({ status: "error", message: "Team not found" }, 404);

  const members = await db
    .select({
      idMember: schema.teamMember.idMember,
      idUser: schema.teamMember.idUser,
      job: schema.teamMember.job,
      username: schema.users.username,
      email: schema.users.email,
    })
    .from(schema.teamMember)
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(and(eq(schema.teamMember.idTeam, id), not(eq(schema.role.role, "superadmin"))));

  return c.json({ status: "ok", data: { ...row, members } });
});

teamRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { namaTim } = body;
  if (!namaTim) return c.json({ status: "error", message: "Team name is required" }, 400);

  const [created] = await db.insert(schema.team).values({ namaTim }).returning();
  return c.json({ status: "ok", data: created });
});

teamRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { namaTim } = body;

  const [updated] = await db
    .update(schema.team)
    .set({ namaTim, updatedAt: new Date() })
    .where(eq(schema.team.idTeam, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Team not found" }, 404);
  return c.json({ status: "ok", data: updated });
});

teamRoutes.put("/:id/soft-delete", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.team)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.team.idTeam, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Team not found" }, 404);
  return c.json({ status: "ok", message: "Team soft-deleted" });
});

teamRoutes.put("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.team)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.team.idTeam, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Team not found" }, 404);
  return c.json({ status: "ok", message: "Team restored" });
});

teamRoutes.delete("/:id/permanent", async (c) => {
  const id = Number(c.req.param("id"));
  const [deleted] = await db.delete(schema.team).where(eq(schema.team.idTeam, id)).returning();
  if (!deleted) return c.json({ status: "error", message: "Team not found" }, 404);
  return c.json({ status: "ok", message: "Team permanently deleted" });
});
