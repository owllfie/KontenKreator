import { Hono } from "hono";
import { eq, ilike, isNull, and, sql, desc, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { writeLog } from "../lib/activity-log";

export const contentRoutes = new Hono();

const VALID_STATUS = ["approved", "pending", "revision_needed"];

function getActor(c) {
  const payload = c.get("jwtPayload");
  return payload ? { idUser: payload.id_users } : null;
}

contentRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const search = c.req.query("search") || "";
  const projectId = c.req.query("projectId");
  const status = c.req.query("status") || "";
  const offset = (page - 1) * limit;

  const conditions = [isNull(schema.content.deletedAt)];
  if (search) conditions.push(ilike(schema.content.judulKonten, `%${search}%`));
  if (projectId) conditions.push(eq(schema.content.idProject, Number(projectId)));
  if (status) conditions.push(eq(schema.content.statusApproval, status));

  const where = and(...conditions);

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.content)
    .where(where);

  const rows = await db
    .select({
      idContent: schema.content.idContent,
      idProject: schema.content.idProject,
      idUploader: schema.content.idUploader,
      judulKonten: schema.content.judulKonten,
      fileDraft: schema.content.fileDraft,
      catatan: schema.content.catatan,
      statusApproval: schema.content.statusApproval,
      createdAt: schema.content.createdAt,
      namaProjek: schema.project.namaProjek,
      uploaderName: schema.users.username,
    })
    .from(schema.content)
    .leftJoin(schema.project, eq(schema.content.idProject, schema.project.idProject))
    .leftJoin(schema.teamMember, eq(schema.content.idUploader, schema.teamMember.idMember))
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .where(where)
    .orderBy(desc(schema.content.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    status: "ok",
    data: { rows, total: countRow?.count ?? 0, page, limit, totalPages: Math.ceil((countRow?.count ?? 0) / limit) },
  });
});

contentRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { idProject, idUploader, judulKonten, fileDraft, catatan } = body;

  if (!idProject || !idUploader || !judulKonten) {
    return c.json({ status: "error", message: "idProject, idUploader, and judulKonten are required" }, 400);
  }

  const [created] = await db
    .insert(schema.content)
    .values({
      idProject: Number(idProject),
      idUploader: Number(idUploader),
      judulKonten,
      fileDraft: fileDraft || null,
      catatan: catatan || null,
      statusApproval: "pending",
    })
    .returning();

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "CREATE",
      namaTabel: "content",
      idReferensi: created.idContent,
      keterangan: `Content "${judulKonten}" uploaded (status: pending)`,
      newValues: JSON.stringify(created),
    });
  }

  return c.json({ status: "ok", data: created });
});

contentRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { judulKonten, fileDraft, catatan } = body;

  const [updated] = await db
    .update(schema.content)
    .set({ judulKonten, fileDraft: fileDraft ?? null, catatan: catatan ?? null, updatedAt: new Date() })
    .where(eq(schema.content.idContent, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Content not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "content",
      idReferensi: updated.idContent,
      keterangan: `Content "${updated.judulKonten}" updated`,
    });
  }
  return c.json({ status: "ok", data: updated });
});

contentRoutes.patch("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { statusApproval } = body;

  if (!VALID_STATUS.includes(statusApproval)) {
    return c.json({ status: "error", message: "Invalid status" }, 400);
  }

  const [updated] = await db
    .update(schema.content)
    .set({ statusApproval, updatedAt: new Date() })
    .where(eq(schema.content.idContent, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Content not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "content",
      idReferensi: updated.idContent,
      keterangan: `Content "${updated.judulKonten}" status set to ${statusApproval}`,
      newValues: JSON.stringify({ statusApproval }),
    });
  }
  return c.json({ status: "ok", data: updated });
});

contentRoutes.delete("/:id/permanent", async (c) => {
  const id = Number(c.req.param("id"));
  const [deleted] = await db.delete(schema.content).where(eq(schema.content.idContent, id)).returning();
  if (!deleted) return c.json({ status: "error", message: "Content not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "content",
      idReferensi: deleted.idContent,
      keterangan: `Content "${deleted.judulKonten}" deleted`,
    });
  }
  return c.json({ status: "ok", message: "Content deleted" });
});

contentRoutes.put("/:id/soft-delete", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.content)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.content.idContent, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Content not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "content",
      idReferensi: updated.idContent,
      keterangan: `Content "${updated.judulKonten}" deleted`,
    });
  }
  return c.json({ status: "ok", message: "Content deleted" });
});

contentRoutes.put("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.content)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.content.idContent, id))
    .returning();
  if (!updated) return c.json({ status: "error", message: "Content not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "RESTORE",
      namaTabel: "content",
      idReferensi: updated.idContent,
      keterangan: `Content "${updated.judulKonten}" restored`,
    });
  }
  return c.json({ status: "ok", message: "Content restored" });
});

contentRoutes.post("/bulk-delete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];

  if (ids.length === 0) {
    return c.json({ status: "error", message: "No contents selected" }, 400);
  }

  const rows = await db
    .select({ idContent: schema.content.idContent, judulKonten: schema.content.judulKonten })
    .from(schema.content)
    .where(and(inArray(schema.content.idContent, ids), isNull(schema.content.deletedAt)));

  if (rows.length > 0) {
    await db
      .update(schema.content)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(schema.content.idContent, rows.map((r) => r.idContent)));

    const actor = getActor(c);
    if (actor) {
      for (const row of rows) {
        await writeLog({
          idUser: actor.idUser,
          aksi: "DELETE",
          namaTabel: "content",
          idReferensi: row.idContent,
          keterangan: `Content "${row.judulKonten}" deleted`,
        });
      }
    }
  }

  return c.json({ status: "ok", message: `${rows.length} content(s) deleted` });
});

contentRoutes.post("/delete-all", async (c) => {
  const rows = await db
    .select({ idContent: schema.content.idContent, judulKonten: schema.content.judulKonten })
    .from(schema.content)
    .where(isNull(schema.content.deletedAt));

  if (rows.length > 0) {
    await db
      .update(schema.content)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(isNull(schema.content.deletedAt));

    const actor = getActor(c);
    if (actor) {
      for (const row of rows) {
        await writeLog({
          idUser: actor.idUser,
          aksi: "DELETE",
          namaTabel: "content",
          idReferensi: row.idContent,
          keterangan: `Content "${row.judulKonten}" deleted`,
        });
      }
    }
  }

  return c.json({ status: "ok", message: `${rows.length} content(s) deleted` });
});
