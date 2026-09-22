import { Hono } from "hono";
import { eq, ilike, or, isNull, and, sql, desc, not, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { writeLog } from "../lib/activity-log";

export const teamRoutes = new Hono();

const VALID_JOBS = ["leader", "vice leader", "member", "talent"];

async function getActiveTalentCount(teamId, excludeMemberId) {
  const rows = await db
    .select({ idMember: schema.teamMember.idMember })
    .from(schema.teamMember)
    .where(
      and(
        eq(schema.teamMember.idTeam, teamId),
        isNull(schema.teamMember.deletedAt),
        eq(schema.teamMember.job, "talent"),
        excludeMemberId ? not(eq(schema.teamMember.idMember, excludeMemberId)) : undefined
      )
    );
  return rows.length;
}

function getActor(c) {
  const payload = c.get("jwtPayload");
  return payload ? { idUser: payload.id_users } : null;
}

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
    conditions.push(ilike(schema.team.namaTim, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql`count(*)::int` })
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
        .select({ count: sql`count(*)::int` })
        .from(schema.teamMember)
        .where(eq(schema.teamMember.idTeam, row.idTeam));
      const [leader] = await db
        .select({
          leaderName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`,
        })
        .from(schema.teamMember)
        .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
        .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
        .where(
          and(
            eq(schema.teamMember.idTeam, row.idTeam),
            eq(schema.teamMember.job, "leader"),
            isNull(schema.teamMember.deletedAt),
            not(eq(schema.role.role, "Superadmin"))
          )
        )
        .limit(1);
      return { ...row, memberCount: memberCount?.count ?? 0, leaderName: leader?.leaderName ?? null };
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
      deletedAt: schema.teamMember.deletedAt,
      username: schema.users.username,
      email: schema.users.email,
    })
    .from(schema.teamMember)
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(and(eq(schema.teamMember.idTeam, id), not(eq(schema.role.role, "Superadmin"))));

  return c.json({ status: "ok", data: { ...row, members } });
});

teamRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { namaTim } = body;
  if (!namaTim) return c.json({ status: "error", message: "Team name is required" }, 400);

  const [created] = await db.insert(schema.team).values({ namaTim }).returning();

  const actor = getActor(c);
  if (actor) {
    await db.insert(schema.teamMember).values({
      idTeam: created.idTeam,
      idUser: actor.idUser,
      job: "leader",
    });

    await writeLog({
      idUser: actor.idUser,
      aksi: "CREATE",
      namaTabel: "team",
      idReferensi: created.idTeam,
      keterangan: `Team "${namaTim}" created with user as leader`,
      newValues: JSON.stringify(created),
    });
  }

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

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "team",
      idReferensi: updated.idTeam,
      keterangan: `Team "${namaTim}" updated`,
      newValues: JSON.stringify(updated),
    });
  }
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

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "team",
      idReferensi: updated.idTeam,
      keterangan: `Team "${updated.namaTim}" deleted`,
    });
  }
  return c.json({ status: "ok", message: "Team deleted" });
});

teamRoutes.put("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  const [updated] = await db
    .update(schema.team)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.team.idTeam, id))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Team not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "RESTORE",
      namaTabel: "team",
      idReferensi: updated.idTeam,
      keterangan: `Team "${updated.namaTim}" restored`,
    });
  }
  return c.json({ status: "ok", message: "Team restored" });
});

teamRoutes.delete("/:id/permanent", async (c) => {
  const id = Number(c.req.param("id"));
  const [deleted] = await db.delete(schema.team).where(eq(schema.team.idTeam, id)).returning();
  if (!deleted) return c.json({ status: "error", message: "Team not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "team",
      idReferensi: deleted.idTeam,
      keterangan: `Team "${deleted.namaTim}" permanently deleted`,
    });
  }
  return c.json({ status: "ok", message: "Team permanently deleted" });
});

teamRoutes.post("/bulk-delete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];

  if (ids.length === 0) {
    return c.json({ status: "error", message: "No teams selected" }, 400);
  }

  const rows = await db
    .select({ idTeam: schema.team.idTeam, namaTim: schema.team.namaTim })
    .from(schema.team)
    .where(and(inArray(schema.team.idTeam, ids), isNull(schema.team.deletedAt)));

  if (rows.length > 0) {
    await db
      .update(schema.team)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(schema.team.idTeam, rows.map((r) => r.idTeam)));

    const actor = getActor(c);
    if (actor) {
      for (const row of rows) {
        await writeLog({
          idUser: actor.idUser,
          aksi: "DELETE",
          namaTabel: "team",
          idReferensi: row.idTeam,
          keterangan: `Team "${row.namaTim}" deleted`,
        });
      }
    }
  }

  return c.json({ status: "ok", message: `${rows.length} team(s) deleted` });
});

teamRoutes.post("/delete-all", async (c) => {
  const rows = await db
    .select({ idTeam: schema.team.idTeam, namaTim: schema.team.namaTim })
    .from(schema.team)
    .where(isNull(schema.team.deletedAt));

  if (rows.length > 0) {
    await db
      .update(schema.team)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(isNull(schema.team.deletedAt));

    const actor = getActor(c);
    if (actor) {
      for (const row of rows) {
        await writeLog({
          idUser: actor.idUser,
          aksi: "DELETE",
          namaTabel: "team",
          idReferensi: row.idTeam,
          keterangan: `Team "${row.namaTim}" deleted`,
        });
      }
    }
  }

  return c.json({ status: "ok", message: `${rows.length} team(s) deleted` });
});

teamRoutes.get("/:id/available-users", async (c) => {
  const id = Number(c.req.param("id"));
  const [team] = await db.select().from(schema.team).where(eq(schema.team.idTeam, id)).limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const existingMemberUserIds = await db
    .select({ idUser: schema.teamMember.idUser })
    .from(schema.teamMember)
    .where(and(eq(schema.teamMember.idTeam, id), isNull(schema.teamMember.deletedAt)));

  const existingIds = new Set(existingMemberUserIds.map((r) => r.idUser));

  const rows = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      email: schema.users.email,
      roleName: schema.role.role,
    })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(
      and(
        isNull(schema.users.deletedAt),
        eq(schema.users.status, "active"),
        not(eq(schema.role.role, "Superadmin"))
      )
    );

  return c.json({
    status: "ok",
    data: rows.filter((r) => !existingIds.has(r.idUsers)),
  });
});

teamRoutes.post("/:id/members", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { idUser, job } = body;

  if (!idUser || !job) {
    return c.json({ status: "error", message: "idUser and job are required" }, 400);
  }
  if (!VALID_JOBS.includes(String(job).toLowerCase())) {
    return c.json(
      {
        status: "error",
        message: `Invalid job. Allowed: ${VALID_JOBS.join(", ")}`,
      },
      400
    );
  }

  const [team] = await db.select().from(schema.team).where(eq(schema.team.idTeam, id)).limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const [user] = await db.select().from(schema.users).where(eq(schema.users.idUsers, Number(idUser))).limit(1);
  if (!user) return c.json({ status: "error", message: "User not found" }, 404);

  const [dup] = await db
    .select()
    .from(schema.teamMember)
    .where(and(eq(schema.teamMember.idTeam, id), eq(schema.teamMember.idUser, Number(idUser)), isNull(schema.teamMember.deletedAt)))
    .limit(1);
  if (dup) return c.json({ status: "error", message: "User is already a member of this team" }, 409);

  if (String(job).toLowerCase() === "talent" && (await getActiveTalentCount(id)) > 0) {
    return c.json({ status: "error", message: "This team already has a talent. Choose another role." }, 400);
  }

  const [created] = await db
    .insert(schema.teamMember)
    .values({ idTeam: id, idUser: Number(idUser), job: String(job).toLowerCase() })
    .returning();

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "CREATE",
      namaTabel: "team_member",
      idReferensi: created.idMember,
      keterangan: `Added "${user.username}" as ${job} to team "${team.namaTim}"`,
      newValues: JSON.stringify(created),
    });
  }

  return c.json({ status: "ok", data: created });
});

teamRoutes.put("/:id/members/:memberId", async (c) => {
  const id = Number(c.req.param("id"));
  const memberId = Number(c.req.param("memberId"));
  const body = await c.req.json();
  const { job } = body;

  if (!job) return c.json({ status: "error", message: "job is required" }, 400);
  if (!VALID_JOBS.includes(String(job).toLowerCase())) {
    return c.json({ status: "error", message: `Invalid job. Allowed: ${VALID_JOBS.join(", ")}` }, 400);
  }

  const [member] = await db
    .select()
    .from(schema.teamMember)
    .where(and(eq(schema.teamMember.idMember, memberId), eq(schema.teamMember.idTeam, id)))
    .limit(1);
  if (![member]) return c.json({ status: "error", message: "Member not found" }, 404);

  if (String(job).toLowerCase() === "talent" && (await getActiveTalentCount(id, memberId)) > 0) {
    return c.json({ status: "error", message: "This team already has a talent. Choose another role." }, 400);
  }

  const [updated] = await db
    .update(schema.teamMember)
    .set({ job: String(job).toLowerCase(), updatedAt: new Date() })
    .where(eq(schema.teamMember.idMember, memberId))
    .returning();

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "UPDATE",
      namaTabel: "team_member",
      idReferensi: updated.idMember,
      keterangan: `Changed member job from "${member.job}" to "${job}"`,
      oldValues: JSON.stringify({ job: member.job }),
      newValues: JSON.stringify({ job: updated.job }),
    });
  }

  return c.json({ status: "ok", data: updated });
});

teamRoutes.put("/:id/members/:memberId/soft-delete", async (c) => {
  const id = Number(c.req.param("id"));
  const memberId = Number(c.req.param("memberId"));

  const [updated] = await db
    .update(schema.teamMember)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.teamMember.idMember, memberId), eq(schema.teamMember.idTeam, id)))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Member not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "DELETE",
      namaTabel: "team_member",
      idReferensi: updated.idMember,
      keterangan: "Team member deleted",
    });
  }

  return c.json({ status: "ok", message: "Member removed from team" });
});

teamRoutes.put("/:id/members/:memberId/restore", async (c) => {
  const id = Number(c.req.param("id"));
  const memberId = Number(c.req.param("memberId"));

  const [updated] = await db
    .update(schema.teamMember)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(schema.teamMember.idMember, memberId), eq(schema.teamMember.idTeam, id)))
    .returning();

  if (!updated) return c.json({ status: "error", message: "Member not found" }, 404);

  const actor = getActor(c);
  if (actor) {
    await writeLog({
      idUser: actor.idUser,
      aksi: "RESTORE",
      namaTabel: "team_member",
      idReferensi: updated.idMember,
      keterangan: "Team member restored",
    });
  }

  return c.json({ status: "ok", message: "Member restored" });
});
