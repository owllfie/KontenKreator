import { Hono } from "hono";
import { sql, eq, ilike, desc, and, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { writeLog } from "../lib/activity-log";

export const backupRoutes = new Hono();

function getActor(c) {
  const payload = c.get("jwtPayload");
  return payload ? { idUser: payload.id_users } : null;
}

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

function jakartaStamp() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`;
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
    if (search) conds.push(ilike(schema.backupHistory.fileName, `%${search}%`));
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
    const fileName = `kontenkreator_backup_${jakartaStamp()}.json`;
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

    const actor = getActor(c);
    if (actor) {
      await writeLog({
        idUser: actor.idUser,
        aksi: "CREATE",
        namaTabel: "backup_history",
        idReferensi: created.idBackup,
        keterangan: `Backup "${fileName}" created by ${createdBy || "System"}`,
        newValues: JSON.stringify({
          fileName,
          sizeBytes,
          records,
          status: "Berhasil",
        }),
      });
    }

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
      return c.json({ status: "error", message: "Backup not found" }, 404);
    }
    if (b.status !== "Berhasil") {
      return c.json({ status: "error", message: "Backup file not available" }, 400);
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
      return c.json({ status: "error", message: "Backup not found" }, 404);
    }
    if (b.status !== "Berhasil") {
      return c.json({ status: "error", message: "Backup cannot be restored" }, 400);
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

    const actor = getActor(c);
    if (actor) {
      await writeLog({
        idUser: actor.idUser,
        aksi: "UPDATE",
        namaTabel: "backup_history",
        idReferensi: b.idBackup,
        keterangan: `Database restored from backup "${b.fileName}"`,
      });
    }

    return c.json({ status: "ok", message: "Database restored successfully" });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

backupRoutes.delete("/bulk", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];

    if (ids.length === 0) {
      return c.json({ status: "error", message: "No backups selected" }, 400);
    }

    const rows = await db
      .select()
      .from(schema.backupHistory)
      .where(inArray(schema.backupHistory.idBackup, ids));

    await db.delete(schema.backupHistory).where(inArray(schema.backupHistory.idBackup, ids));

    const actor = getActor(c);
    for (const b of rows) {
      if (actor) {
        await writeLog({
          idUser: actor.idUser,
          aksi: "DELETE",
          namaTabel: "backup_history",
          idReferensi: b.idBackup,
          keterangan: `Backup "${b.fileName}" deleted`,
        });
      }
    }

    return c.json({ status: "ok", message: `${ids.length} backup(s) deleted` });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

backupRoutes.delete("/all", async (c) => {
    try {
      const rows = await db
        .select()
        .from(schema.backupHistory);

      await db.delete(schema.backupHistory);

      const actor = getActor(c);
      if (actor && rows.length > 0) {
        await writeLog({
          idUser: actor.idUser,
          aksi: "DELETE",
          namaTabel: "backup_history",
          idReferensi: 0,
          keterangan: `All backups deleted (${rows.length})`,
        });
      }

      return c.json({ status: "ok", message: "All backups deleted" });
    } catch (error) {
      return c.json({ status: "error", message: error.message }, 500);
    }
  });

backupRoutes.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) {
      return c.json({ status: "error", message: "Invalid backup id" }, 400);
    }
    const [b] = await db
      .select()
      .from(schema.backupHistory)
      .where(eq(schema.backupHistory.idBackup, id))
      .limit(1);

    await db.delete(schema.backupHistory).where(eq(schema.backupHistory.idBackup, id));

    const actor = getActor(c);
    if (actor && b) {
      await writeLog({
        idUser: actor.idUser,
        aksi: "DELETE",
        namaTabel: "backup_history",
        idReferensi: b.idBackup,
        keterangan: `Backup "${b.fileName}" deleted`,
      });
    }

    return c.json({ status: "ok", message: "Backup deleted" });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});
