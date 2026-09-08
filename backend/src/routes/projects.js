import { Hono } from "hono";
import { eq, like, isNull, and, sql, desc } from "drizzle-orm";
import { db, schema } from "../db";
import { writeLog } from "../lib/activity-log";

export const projectRoutes = new Hono();

function getActor(c) {
  const payload = c.get("jwtPayload");
  return payload ? { idUser: payload.id_users } : null;
}

projectRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const search = c.req.query("search") || "";
  const showDeleted = c.req.query("showDeleted") === "true";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (!showDeleted) conditions.push(isNull(schema.project.deletedAt));
  if (search) conditions.push(like(schema.project.namaProjek, `%${search}%`));

  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.project)
    .where(where);

  const rows = await db
    .select({
      idProject: schema.project.idProject,
      namaProjek: schema.project.namaProjek,
      idTeam: schema.project.idTeam,
      deadline: schema.project.deadline,
      createdAt: schema.project.createdAt,
      updatedAt: schema.project.updatedAt,
      deletedAt: schema.project.deletedAt,
      namaTim: schema.team.namaTim,
    })
    .from(schema.project)
    .leftJoin(schema.team, eq(schema.project.idTeam, schema.team.idTeam))
    .where(where)
    .orderBy(desc(schema.project.createdAt))
    .limit(limit)
    .offset(offset);

  const rowsWithCounts = await Promise.all(
    rows.map(async (row) => {
      const [scriptCount] = await db
        .select({ count: sql`count(*)::int` })
        .from(schema.script)
        .where(and(eq(schema.script.idProject, row.idProject), isNull(schema.script.deletedAt)));
      const [contentCount] = await db
        .select({ count: sql`count(*)::int` })
        .from(schema.content)
        .where(and(eq(schema.content.idProject, row.idProject), isNull(schema.content.deletedAt)));
      return { ...row, scriptCount: scriptCount?.count ?? 0, contentCount: contentCount?.count ?? 0 };
    })
  );

  return c.json({
    status: "ok",
    data: { rows: rowsWithCounts, total: countRow?.count ?? 0, page, limit, totalPages: Math.ceil((countRow?.count ?? 0) / limit) },
  });
});

projectRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [row] = await db
    .select({
      idProject: schema.project.idProject,
      namaProjek: schema.project.namaProjek,
      idTeam: schema.project.idTeam,
      deadline: schema.project.deadline,
      createdAt: schema.project.createdAt,
      namaTim: schema.team.namaTim,
    })
    .from(schema.project)
    .leftJoin(schema.team, eq(schema.project.idTeam, schema.team.idTeam))
    .where(eq(schema.project.idProject, id))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Project not found" }, 404);
  return c.json({ status: "ok", data: row });
});

projectRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { namaProjek, idTeam, deadline } = body;

  if (!namaProjek || !idTeam) {
    return c.json({ status: "error", message: "namaProjek and idTeam are required" }, 400);
  }

  const [team] = await db.select().from(schema.team).where(eq(schema.team.idTeam, Number(idTeam))).limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const [created] = await db
    .insert(schema.project)
    .values({
      namaProjek,
      idTeam: Number(idTeam),
      deadline: deadline ? new Date(deadline) : null,
    })
    .returning();

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "CREATE",
      namaTabel: "project",
      idReferensi: created.idProject,
      keterangan: `Project "${namaProjek}" created`,
      newValues: JSON.stringify(created),
    });
  }

  return c.json({ status: "ok", data: created });
});

projectRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { namaProjek, deadline } = body;

  if (!namaProjek) return c.json({ status: "error", message: "namaProjek is required" }, 400);

  const [updated] = await db
    .update(schema.project)
    .set({ namaProjek, deadline: deadline ? new Date(deadline) : null, updatedAt: new Date() })
    .where(eq(schema.project.idProject, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Project not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "project",
      idReferensi: updated.idProject,
      keterangan: `Project "${namaProjek}" updated`,
      newValues: JSON.stringify(updated),
    });
  }

  return c.json({ status: "ok", data: updated });
});

projectRoutes.put("/:id/soft-delete", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.project)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.project.idProject, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Project not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "project",
      idReferensi: updated.idProject,
      keterangan: `Project "${updated.namaProjek}" soft-deleted`,
    });
  }
  return c.json({ status: "ok", message: "Project soft-deleted" });
});

projectRoutes.put("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.project)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.project.idProject, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Project not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "RESTORE",
      namaTabel: "project",
      idReferensi: updated.idProject,
      keterangan: `Project "${updated.namaProjek}" restored`,
    });
  }
  return c.json({ status: "ok", message: "Project restored" });
});

projectRoutes.delete("/:id/permanent", async (c) => {
  const id = Number(c.req.param("id"));
  const [deleted] = await db.delete(schema.project).where(eq(schema.project.idProject, id)).returning();
  if (!deleted) return c.json({ status: "error", message: "Project not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "project",
      idReferensi: deleted.idProject,
      keterangan: `Project "${deleted.namaProjek}" permanently deleted`,
    });
  }
  return c.json({ status: "ok", message: "Project permanently deleted" });
});
