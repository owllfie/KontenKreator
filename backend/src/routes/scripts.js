import { Hono } from "hono";
import { eq, like, isNull, and, sql, desc } from "drizzle-orm";
import { db, schema } from "../db";
import { writeLog } from "../lib/activity-log";

export const scriptRoutes = new Hono();

const VALID_STATUS = ["approved", "pending", "revision_needed"];

function getActor(c) {
  const payload = c.get("jwtPayload");
  return payload ? { idUser: payload.id_users } : null;
}

scriptRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const search = c.req.query("search") || "";
  const projectId = c.req.query("projectId");
  const status = c.req.query("status") || "";
  const offset = (page - 1) * limit;

  const conditions = [isNull(schema.script.deletedAt)];
  if (search) conditions.push(like(schema.script.judulScript, `%${search}%`));
  if (projectId) conditions.push(eq(schema.script.idProject, Number(projectId)));
  if (status) conditions.push(eq(schema.script.statusApproval, status));

  const where = and(...conditions);

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.script)
    .where(where);

  const rows = await db
    .select({
      idScript: schema.script.idScript,
      idProject: schema.script.idProject,
      idWriter: schema.script.idWriter,
      judulScript: schema.script.judulScript,
      script: schema.script.script,
      statusApproval: schema.script.statusApproval,
      createdAt: schema.script.createdAt,
      namaProjek: schema.project.namaProjek,
      writerName: schema.users.username,
    })
    .from(schema.script)
    .leftJoin(schema.project, eq(schema.script.idProject, schema.project.idProject))
    .leftJoin(schema.teamMember, eq(schema.script.idWriter, schema.teamMember.idMember))
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .where(where)
    .orderBy(desc(schema.script.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    status: "ok",
    data: { rows, total: countRow?.count ?? 0, page, limit, totalPages: Math.ceil((countRow?.count ?? 0) / limit) },
  });
});

scriptRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { idProject, idWriter, judulScript, script } = body;

  if (!idProject || !idWriter || !judulScript) {
    return c.json({ status: "error", message: "idProject, idWriter, and judulScript are required" }, 400);
  }

  const [created] = await db
    .insert(schema.script)
    .values({
      idProject: Number(idProject),
      idWriter: Number(idWriter),
      judulScript,
      script: script || null,
      statusApproval: "pending",
    })
    .returning();

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "CREATE",
      namaTabel: "script",
      idReferensi: created.idScript,
      keterangan: `Script "${judulScript}" created (status: pending)`,
      newValues: JSON.stringify(created),
    });
  }

  return c.json({ status: "ok", data: created });
});

scriptRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { judulScript, script } = body;

  const [updated] = await db
    .update(schema.script)
    .set({ judulScript, script: script ?? null, updatedAt: new Date() })
    .where(eq(schema.script.idScript, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Script not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "script",
      idReferensi: updated.idScript,
      keterangan: `Script "${updated.judulScript}" updated`,
    });
  }
  return c.json({ status: "ok", data: updated });
});

scriptRoutes.patch("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { statusApproval } = body;

  if (!VALID_STATUS.includes(statusApproval)) {
    return c.json({ status: "error", message: "Invalid status" }, 400);
  }

  const [updated] = await db
    .update(schema.script)
    .set({ statusApproval, updatedAt: new Date() })
    .where(eq(schema.script.idScript, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Script not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "script",
      idReferensi: updated.idScript,
      keterangan: `Script "${updated.judulScript}" status set to ${statusApproval}`,
      newValues: JSON.stringify({ statusApproval }),
    });
  }
  return c.json({ status: "ok", data: updated });
});

scriptRoutes.delete("/:id/permanent", async (c) => {
  const id = Number(c.req.param("id"));
  const [deleted] = await db.delete(schema.script).where(eq(schema.script.idScript, id)).returning();
  if (!deleted) return c.json({ status: "error", message: "Script not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "script",
      idReferensi: deleted.idScript,
      keterangan: `Script "${deleted.judulScript}" deleted`,
    });
  }
  return c.json({ status: "ok", message: "Script deleted" });
});
