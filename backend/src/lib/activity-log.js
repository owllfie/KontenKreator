import { db, schema } from "../db";

export async function writeLog(input) {
  try {
    await db.insert(schema.activityLogs).values({
      idUser: input.idUser,
      aksi: input.aksi,
      namaTabel: input.namaTabel,
      idReferensi: input.idReferensi,
      keterangan: input.keterangan,
      oldValues: input.oldValues ?? null,
      newValues: input.newValues ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error("Failed to write activity log:", err);
  }
}
