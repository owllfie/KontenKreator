import { Hono } from "hono";
import { sql, eq, like, desc, and } from "drizzle-orm";
import { db, schema } from "../db";

export const backupRoutes = new Hono();

const TABLES = [
  "role", "permissions", "role_permissions", "users",
  "activity_logs", "team", "team_member", "project",
  "content", "content_revision", "script", "script_revision",
];

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatLocale(date) {
  if (!date) return "-";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}.${mi}`;
}

async function buildDump() {
  const dump = {};
  let records = 0;
  for (const table of TABLES) {
    const rows = await db.execute(sql.raw(`SELECT * FROM "${table}"`));
    dump[table] = rows;
    records += rows.length;
  }
  return {
    payload: JSON.stringify(dump, null, 2),
    records,
  };
}

backupRoutes.get("/", async (c) => {
  try {
    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search") || "";
    const type = c.req.query("type") || "";
    const offset = (page - 1) * limit;

    const conds = [];
    if (search) conds.push(like(schema.backupHistory.fileName, `%${search}%`));
    if (type && type !== "Semua") conds.push(eq(schema.backupHistory.type, type));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const [countRow] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.backupHistory)
      .where(where);

    const rows = await db
      .select()
      .from(schema.backupHistory)
      .where(where)
      .orderBy(desc(schema.backupHistory.createdAt))
      .limit(limit)
      .offset(offset);

    const [sumRow] = await db.select({
      total: sql`count(*)::int`,
      size: sql`coalesce(sum(size_bytes),0)::int`,
      successCount: sql`count(*) filter (where status = 'Berhasil')::int`,
      latest: sql`max(created_at)`,
    }).from(schema.backupHistory);

    const data = rows.map((b) => ({
      id: String(b.idBackup),
      fileName: b.fileName,
      type: b.type,
      size: formatBytes(b.sizeBytes ?? 0),
      sizeBytes: b.sizeBytes ?? 0,
      records: b.records ?? 0,
      user: b.createdBy || "Sistem",
      createdAt: formatLocale(b.createdAt),
      status: b.status,
    }));

    return c.json({
      status: "ok",
      data,
      total: countRow?.count ?? 0,
      totalPages: Math.ceil((countRow?.count ?? 0) / limit),
      summary: {
        total: sumRow?.total ?? 0,
        totalSizeBytes: sumRow?.size ?? 0,
        successCount: sumRow?.successCount ?? 0,
        latest: sumRow?.latest ? formatLocale(sumRow.latest) : null,
      },
    });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

backupRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const createdBy = body?.createdBy || null;

    const { payload, records } = await buildDump();
    const fileName = `kontenkreator_backup_${Date.now()}.json`;
    const sizeBytes = Buffer.byteLength(payload, "utf-8");

    const [created] = await db
      .insert(schema.backupHistory)
      .values({
        fileName,
        type: "Manual",
        sizeBytes,
        records,
        createdBy,
        status: "Berhasil",
        fileContent: payload,
      })
      .returning();

    return c.json({ status: "ok", fileName });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

backupRoutes.get("/:id/download", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const [b] = await db
      .select()
      .from(schema.backupHistory)
      .where(eq(schema.backupHistory.idBackup, id))
      .limit(1);

    if (!b || !b.fileContent) {
      return c.json({ status: "error", message: "Backup tidak ditemukan" }, 404);
    }
    if (b.status !== "Berhasil") {
      return c.json({ status: "error", message: "Backup tidak tersedia" }, 400);
    }

    c.header("Content-Type", "application/json");
    c.header("Content-Disposition", `attachment; filename="${b.fileName}"`);
    return c.body(b.fileContent);
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

backupRoutes.post("/:id/restore", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const [b] = await db
      .select()
      .from(schema.backupHistory)
      .where(eq(schema.backupHistory.idBackup, id))
      .limit(1);

    if (!b || !b.fileContent) {
      return c.json({ status: "error", message: "Backup tidak ditemukan" }, 404);
    }
    if (b.status !== "Berhasil") {
      return c.json({ status: "error", message: "Backup tidak dapat dipulihkan" }, 400);
    }

    const dump = JSON.parse(b.fileContent);
    for (const table of TABLES) {
      await db.execute(sql.raw(`DELETE FROM "${table}"`));
      const rows = dump[table] || [];
      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        for (const row of rows) {
          const cols = keys.join(", ");
          const vals = keys
            .map((k) => (row[k] === null || row[k] === undefined ? "NULL" : `'${String(row[k]).replace(/'/g, "''")}'`))
            .join(", ");
          await db.execute(sql.raw(`INSERT INTO "${table}" (${cols}) VALUES (${vals})`));
        }
      }
    }

    return c.json({ status: "ok", message: "Database berhasil dipulihkan" });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

backupRoutes.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(schema.backupHistory).where(eq(schema.backupHistory.idBackup, id));
    return c.json({ status: "ok", message: "Backup dihapus" });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});
