import { Hono } from "hono";
import { eq, and, isNull, not, desc, sql, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware } from "../middleware/auth.js";
import { writeLog } from "../lib/activity-log";

export const meRoutes = new Hono();

meRoutes.use("*", authMiddleware);

const VALID_JOBS = ["leader", "vice leader", "member", "talent"];
const MANAGER_JOBS = ["leader", "vice leader"];

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

async function getUserHasTeam(userId) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(schema.teamMember)
    .where(and(eq(schema.teamMember.idUser, userId), isNull(schema.teamMember.deletedAt)));
  return (row?.count ?? 0) > 0;
}

async function getMyMembership(userId, teamId) {
  const [row] = await db
    .select()
    .from(schema.teamMember)
    .where(
      and(
        eq(schema.teamMember.idTeam, teamId),
        eq(schema.teamMember.idUser, userId),
        isNull(schema.teamMember.deletedAt)
      )
    )
    .limit(1);
  return row || null;
}

async function generateTeamCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const [dup] = await db
      .select()
      .from(schema.team)
      .where(eq(schema.team.kodeTim, code))
      .limit(1);
    if (!dup) return code;
  }
  return null;
}

meRoutes.post("/team", async (c) => {
  const body = await c.req.json();
  const { namaTim } = body;
  if (!namaTim || !namaTim.trim()) {
    return c.json({ status: "error", message: "Team name is required" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);
  if (await getUserHasTeam(actor.idUser)) {
    return c.json({ status: "error", message: "You are already a member of a team" }, 409);
  }

  const kodeTim = await generateTeamCode();
  if (!kodeTim) return c.json({ status: "error", message: "Failed to generate team code" }, 500);

  const [created] = await db
    .insert(schema.team)
    .values({ namaTim: namaTim.trim(), kodeTim })
    .returning();

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
    keterangan: `Team "${created.namaTim}" created with user as leader`,
    newValues: JSON.stringify(created),
  });

  return c.json({ status: "ok", data: created });
});

meRoutes.post("/team/join", async (c) => {
  const body = await c.req.json();
  const kodeTim = String(body?.kodeTim || "").trim().toUpperCase();
  const job = String(body?.job || "member").toLowerCase();

  if (!kodeTim) {
    return c.json({ status: "error", message: "Team code is required" }, 400);
  }
  if (!VALID_JOBS.includes(job)) {
    return c.json({ status: "error", message: `Invalid job. Allowed: ${VALID_JOBS.join(", ")}` }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);
  if (await getUserHasTeam(actor.idUser)) {
    return c.json({ status: "error", message: "You are already a member of a team" }, 409);
  }

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.kodeTim, kodeTim), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) {
    return c.json({ status: "error", message: "Team not found. Check the code and try again." }, 404);
  }

  if (job === "talent" && (await getActiveTalentCount(team.idTeam)) > 0) {
    return c.json({ status: "error", message: "This team already has a talent. Join as a member instead." }, 400);
  }

  const [created] = await db
    .insert(schema.teamMember)
    .values({ idTeam: team.idTeam, idUser: actor.idUser, job })
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "CREATE",
    namaTabel: "team_member",
    idReferensi: created.idMember,
    keterangan: `User joined team "${team.namaTim}" with job "${job}"`,
    newValues: JSON.stringify(created),
  });

  return c.json({ status: "ok", data: { ...team, memberId: created.idMember } });
});

meRoutes.post("/team/leave", async (c) => {
  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [membership] = await db
    .select()
    .from(schema.teamMember)
    .where(and(eq(schema.teamMember.idUser, actor.idUser), isNull(schema.teamMember.deletedAt)))
    .limit(1);
  if (!membership) {
    return c.json({ status: "error", message: "You are not a member of any team" }, 404);
  }

  if (membership.job === "leader") {
    const [others] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.teamMember)
      .where(
        and(
          eq(schema.teamMember.idTeam, membership.idTeam),
          isNull(schema.teamMember.deletedAt),
          not(eq(schema.teamMember.idMember, membership.idMember))
        )
      );
    if ((others?.count ?? 0) > 0) {
      return c.json(
        { status: "error", message: "You are the leader. Transfer leadership or delete the team before leaving." },
        409
      );
    }
    await db
      .update(schema.team)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.team.idTeam, membership.idTeam));
  }

  const [left] = await db
    .update(schema.teamMember)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.teamMember.idMember, membership.idMember))
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "DELETE",
    namaTabel: "team_member",
    idReferensi: left.idMember,
    keterangan: "User left the team",
    oldValues: JSON.stringify(left),
  });

  return c.json({ status: "ok", message: "You have left the team" });
});

meRoutes.post("/team/:id/members", async (c) => {
  const teamId = Number(c.req.param("id"));
  const body = await c.req.json();
  const idUser = body?.idUser;
  const job = String(body?.job || "").toLowerCase();

  if (!teamId) return c.json({ status: "error", message: "Invalid team" }, 400);
  if (!idUser || !job) {
    return c.json({ status: "error", message: "idUser and job are required" }, 400);
  }
  if (!VALID_JOBS.includes(job)) {
    return c.json({ status: "error", message: `Invalid job. Allowed: ${VALID_JOBS.join(", ")}` }, 400);
  }
  if (job === "leader") {
    return c.json({ status: "error", message: "Cannot assign the leader role to a new member" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my || !MANAGER_JOBS.includes(my.job)) {
    return c.json({ status: "error", message: "Only team leaders can add members" }, 403);
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.idUsers, Number(idUser)), isNull(schema.users.deletedAt)))
    .limit(1);
  if (!user) return c.json({ status: "error", message: "User not found" }, 404);

  const [roleRow] = await db
    .select()
    .from(schema.role)
    .where(eq(schema.role.idRole, user.idRole))
    .limit(1);
  if ((roleRow?.role || "").toLowerCase() === "superadmin") {
    return c.json({ status: "error", message: "Cannot add a superadmin to the team" }, 400);
  }

  const [dup] = await db
    .select()
    .from(schema.teamMember)
    .where(and(eq(schema.teamMember.idTeam, teamId), eq(schema.teamMember.idUser, Number(idUser)), isNull(schema.teamMember.deletedAt)))
    .limit(1);
  if (dup) return c.json({ status: "error", message: "User is already a member of this team" }, 409);

  if (job === "talent" && (await getActiveTalentCount(teamId)) > 0) {
    return c.json({ status: "error", message: "This team already has a talent. Choose another role." }, 400);
  }

  const [created] = await db
    .insert(schema.teamMember)
    .values({ idTeam: teamId, idUser: Number(idUser), job })
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "CREATE",
    namaTabel: "team_member",
    idReferensi: created.idMember,
    keterangan: `User "${user.username}" added to team "${team.namaTim}" as ${job}`,
    newValues: JSON.stringify(created),
  });

  return c.json({ status: "ok", data: created });
});

meRoutes.put("/team/:id/members/:memberId", async (c) => {
  const teamId = Number(c.req.param("id"));
  const memberId = Number(c.req.param("memberId"));
  const body = await c.req.json();
  const job = String(body?.job || "").toLowerCase();

  if (!teamId || !memberId) return c.json({ status: "error", message: "Invalid team or member" }, 400);
  if (!VALID_JOBS.includes(job)) {
    return c.json({ status: "error", message: `Invalid job. Allowed: ${VALID_JOBS.join(", ")}` }, 400);
  }
  if (job === "leader") {
    return c.json({ status: "error", message: "Cannot assign the leader role" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my || !MANAGER_JOBS.includes(my.job)) {
    return c.json({ status: "error", message: "Only team leaders can change member roles" }, 403);
  }

  const [member] = await db
    .select()
    .from(schema.teamMember)
    .where(
      and(
        eq(schema.teamMember.idMember, memberId),
        eq(schema.teamMember.idTeam, teamId),
        isNull(schema.teamMember.deletedAt)
      )
    )
    .limit(1);
  if (!member) return c.json({ status: "error", message: "Member not found" }, 404);
  if (member.job === "leader") {
    return c.json({ status: "error", message: "Cannot change the team leader's role" }, 400);
  }

  if (job === "talent" && (await getActiveTalentCount(teamId, memberId)) > 0) {
    return c.json({ status: "error", message: "This team already has a talent. Choose another role." }, 400);
  }

  const [updated] = await db
    .update(schema.teamMember)
    .set({ job, updatedAt: new Date() })
    .where(eq(schema.teamMember.idMember, memberId))
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "UPDATE",
    namaTabel: "team_member",
    idReferensi: updated.idMember,
    keterangan: `Changed job of member in team "${team.namaTim}" from "${member.job}" to "${job}"`,
    oldValues: JSON.stringify({ job: member.job }),
    newValues: JSON.stringify({ job: updated.job }),
  });

  return c.json({ status: "ok", data: updated });
});

meRoutes.put("/team/:id", async (c) => {
  const teamId = Number(c.req.param("id"));
  const body = await c.req.json();
  const namaTim = String(body?.namaTim || "").trim();
  const kodeTim = body?.kodeTim ? String(body.kodeTim).trim().toUpperCase() : undefined;

  if (!namaTim) return c.json({ status: "error", message: "Team name is required" }, 400);

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my || !MANAGER_JOBS.includes(my.job)) {
    return c.json({ status: "error", message: "Only team leaders can edit the team" }, 403);
  }

  const [updated] = await db
    .update(schema.team)
    .set(kodeTim ? { namaTim, kodeTim, updatedAt: new Date() } : { namaTim, updatedAt: new Date() })
    .where(eq(schema.team.idTeam, teamId))
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "UPDATE",
    namaTabel: "team",
    idReferensi: updated.idTeam,
    keterangan: `Team "${updated.namaTim}" updated`,
    oldValues: JSON.stringify(team),
    newValues: JSON.stringify(updated),
  });

  return c.json({ status: "ok", data: updated });
});

meRoutes.delete("/team/:id", async (c) => {
  const teamId = Number(c.req.param("id"));
  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my || !MANAGER_JOBS.includes(my.job)) {
    return c.json({ status: "error", message: "Only team leaders can delete the team" }, 403);
  }

  const [updated] = await db
    .update(schema.team)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.team.idTeam, teamId))
    .returning();

  await db
    .update(schema.teamMember)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.teamMember.idTeam, teamId), isNull(schema.teamMember.deletedAt)));

  await writeLog({
    idUser: actor.idUser,
    aksi: "DELETE",
    namaTabel: "team",
    idReferensi: updated.idTeam,
    keterangan: `Team "${updated.namaTim}" deleted; all members were removed from the team`,
    oldValues: JSON.stringify(updated),
  });

  return c.json({ status: "ok", message: "Team deleted and all members removed" });
});

meRoutes.post("/team/:id/projects", async (c) => {
  const teamId = Number(c.req.param("id"));
  const body = await c.req.json();
  const namaProjek = String(body?.namaProjek || "").trim();
  const deadline = body?.deadline || null;

  if (!teamId) return c.json({ status: "error", message: "Invalid team" }, 400);
  if (!namaProjek) {
    return c.json({ status: "error", message: "Project name is required" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my || !MANAGER_JOBS.includes(my.job)) {
    return c.json({ status: "error", message: "Only team leaders can create projects" }, 403);
  }

  const [created] = await db
    .insert(schema.project)
    .values({
      namaProjek,
      idTeam: teamId,
      deadline: deadline ? new Date(deadline) : null,
    })
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "CREATE",
    namaTabel: "project",
    idReferensi: created.idProject,
    keterangan: `Project "${namaProjek}" created in team "${team.namaTim}"`,
    newValues: JSON.stringify(created),
  });

  return c.json({ status: "ok", data: created });
});

meRoutes.post("/team/:id/projects/:projectId/scripts", async (c) => {
  const teamId = Number(c.req.param("id"));
  const projectId = Number(c.req.param("projectId"));
  const body = await c.req.json();
  const judulScript = String(body?.judulScript || "").trim();
  const script = body?.script ? String(body.script) : null;

  if (!teamId || !projectId) return c.json({ status: "error", message: "Invalid team or project" }, 400);
  if (!judulScript) {
    return c.json({ status: "error", message: "Script title is required" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my) {
    return c.json({ status: "error", message: "You are not a member of this team" }, 403);
  }

  const [project] = await db
    .select()
    .from(schema.project)
    .where(and(eq(schema.project.idProject, projectId), eq(schema.project.idTeam, teamId), isNull(schema.project.deletedAt)))
    .limit(1);
  if (!project) return c.json({ status: "error", message: "Project not found in this team" }, 404);

  const [created] = await db
    .insert(schema.script)
    .values({
      idProject: projectId,
      idWriter: my.idMember,
      judulScript,
      script,
      statusApproval: "pending",
    })
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "CREATE",
    namaTabel: "script",
    idReferensi: created.idScript,
    keterangan: `Script "${judulScript}" created in project "${project.namaProjek}" (status: pending)`,
    newValues: JSON.stringify(created),
  });

  return c.json({ status: "ok", data: created });
});

meRoutes.post("/team/:id/projects/:projectId/contents", async (c) => {
  const teamId = Number(c.req.param("id"));
  const projectId = Number(c.req.param("projectId"));
  const body = await c.req.json();
  const judulKonten = String(body?.judulKonten || "").trim();
  const fileDraft = body?.fileDraft ? String(body.fileDraft) : null;
  const catatan = body?.catatan ? String(body.catatan) : null;

  if (!teamId || !projectId) return c.json({ status: "error", message: "Invalid team or project" }, 400);
  if (!judulKonten) {
    return c.json({ status: "error", message: "Content title is required" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [team] = await db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.idTeam, teamId), isNull(schema.team.deletedAt)))
    .limit(1);
  if (!team) return c.json({ status: "error", message: "Team not found" }, 404);

  const my = await getMyMembership(actor.idUser, teamId);
  if (!my) {
    return c.json({ status: "error", message: "You are not a member of this team" }, 403);
  }

  const [project] = await db
    .select()
    .from(schema.project)
    .where(and(eq(schema.project.idProject, projectId), eq(schema.project.idTeam, teamId), isNull(schema.project.deletedAt)))
    .limit(1);
  if (!project) return c.json({ status: "error", message: "Project not found in this team" }, 404);

  const [created] = await db
    .insert(schema.content)
    .values({
      idProject: projectId,
      idUploader: my.idMember,
      judulKonten,
      fileDraft,
      catatan,
      statusApproval: "pending",
    })
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "CREATE",
    namaTabel: "content",
    idReferensi: created.idContent,
    keterangan: `Content "${judulKonten}" uploaded to project "${project.namaProjek}" (status: pending)`,
    newValues: JSON.stringify(created),
  });

  return c.json({ status: "ok", data: created });
});

meRoutes.get("/scripts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [row] = await db
    .select({
      idScript: schema.script.idScript,
      idProject: schema.script.idProject,
      idTeam: schema.project.idTeam,
      idWriter: schema.script.idWriter,
      judulScript: schema.script.judulScript,
      script: schema.script.script,
      fileScript: schema.script.fileScript,
      revisionNote: schema.script.revisionNote,
      revisionNoteBy: schema.script.revisionNoteBy,
      revisionNoteAt: schema.script.revisionNoteAt,
      revisionByName: sql`(SELECT COALESCE(u.nama_lengkap, u.username) FROM team_member tm JOIN users u ON u.id_users = tm.id_user WHERE tm.id_member = ${schema.script.revisionNoteBy} AND tm.deleted_at IS NULL)`.as("revisionByName"),
      statusApproval: schema.script.statusApproval,
      createdAt: schema.script.createdAt,
      updatedAt: schema.script.updatedAt,
      namaProjek: schema.project.namaProjek,
      namaTim: schema.team.namaTim,
      writerName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as("writerName"),
    })
    .from(schema.script)
    .leftJoin(schema.project, eq(schema.script.idProject, schema.project.idProject))
    .leftJoin(schema.team, eq(schema.project.idTeam, schema.team.idTeam))
    .leftJoin(schema.teamMember, eq(schema.script.idWriter, schema.teamMember.idMember))
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .where(and(eq(schema.script.idScript, id), isNull(schema.script.deletedAt)))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Script not found" }, 404);

  const my = await getMyMembership(actor.idUser, Number(row.idTeam));
  if (!my) return c.json({ status: "error", message: "You are not a member of this team" }, 403);

  const revisions = await getRevisionLog("script", id);

  return c.json({ status: "ok", data: { ...row, revisions } });
});

async function getRevisionLog(type, entityId) {
  const table = type === "script" ? schema.scriptRevision : schema.contentRevision;
  const idCol = type === "script" ? schema.scriptRevision.idScript : schema.contentRevision.idContent;
  const rows = await db
    .select({
      idRevision: table.idRevision,
      idReviewer: table.idReviewer,
      catatanRevisi: table.catatanRevisi,
      statusRevisi: table.statusRevisi,
      createdAt: table.createdAt,
      reviewerName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as("reviewerName"),
    })
    .from(table)
    .leftJoin(schema.teamMember, eq(table.idReviewer, schema.teamMember.idMember))
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .where(eq(idCol, entityId))
    .orderBy(desc(table.createdAt));
  return rows;
}

async function insertRevisionLog(type, entityId, reviewerId, catatan) {
  const table = type === "script" ? schema.scriptRevision : schema.contentRevision;
  const idCol = type === "script" ? "idScript" : "idContent";
  await db.insert(table).values({ [idCol]: entityId, idReviewer: reviewerId, catatanRevisi: catatan });
}

meRoutes.put("/scripts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const judulScript = String(body?.judulScript ?? "").trim();
  const script = body?.script !== undefined && body.script !== null ? String(body.script) : null;
  const revisionNote = body?.revisionNote !== undefined && body.revisionNote !== null && String(body.revisionNote).trim() ? String(body.revisionNote).trim() : null;

  if (!judulScript) {
    return c.json({ status: "error", message: "Script title is required" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [row] = await db
    .select({
      idScript: schema.script.idScript,
      idProject: schema.script.idProject,
      idTeam: schema.project.idTeam,
      judulScript: schema.script.judulScript,
    })
    .from(schema.script)
    .leftJoin(schema.project, eq(schema.script.idProject, schema.project.idProject))
    .where(and(eq(schema.script.idScript, id), isNull(schema.script.deletedAt)))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Script not found" }, 404);

  const my = await getMyMembership(actor.idUser, Number(row.idTeam));
  if (!my) return c.json({ status: "error", message: "You are not a member of this team" }, 403);

  const now = new Date();
  const [updated] = await db
    .update(schema.script)
    .set({
      judulScript,
      script,
      revisionNote,
      revisionNoteBy: revisionNote ? my.idMember : null,
      revisionNoteAt: revisionNote ? now : null,
      statusApproval: "pending",
      updatedAt: now,
    })
    .where(eq(schema.script.idScript, id))
    .returning();

  if (revisionNote) {
    await insertRevisionLog("script", id, my.idMember, revisionNote);
  }

  const revisions = await getRevisionLog("script", id);

  await writeLog({
    idUser: actor.idUser,
    aksi: "UPDATE",
    namaTabel: "script",
    idReferensi: id,
    keterangan: `Script "${judulScript}" edited and submission reset to pending`,
    oldValues: JSON.stringify(row),
    newValues: JSON.stringify(updated),
  });

  return c.json({ status: "ok", data: { ...updated, revisions } });
});

meRoutes.delete("/scripts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [row] = await db
    .select({
      idScript: schema.script.idScript,
      idProject: schema.script.idProject,
      idTeam: schema.project.idTeam,
      judulScript: schema.script.judulScript,
    })
    .from(schema.script)
    .leftJoin(schema.project, eq(schema.script.idProject, schema.project.idProject))
    .where(and(eq(schema.script.idScript, id), isNull(schema.script.deletedAt)))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Script not found" }, 404);

  const my = await getMyMembership(actor.idUser, Number(row.idTeam));
  if (!my) return c.json({ status: "error", message: "You are not a member of this team" }, 403);

  const [deleted] = await db
    .update(schema.script)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.script.idScript, id))
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "DELETE",
    namaTabel: "script",
    idReferensi: id,
    keterangan: `Script "${row.judulScript}" deleted from project`,
    oldValues: JSON.stringify(deleted),
  });

  return c.json({ status: "ok", message: "Script deleted" });
});

meRoutes.get("/contents/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [row] = await db
    .select({
      idContent: schema.content.idContent,
      idProject: schema.content.idProject,
      idTeam: schema.project.idTeam,
      idUploader: schema.content.idUploader,
      judulKonten: schema.content.judulKonten,
      fileDraft: schema.content.fileDraft,
      catatan: schema.content.catatan,
      revisionNote: schema.content.revisionNote,
      revisionNoteBy: schema.content.revisionNoteBy,
      revisionNoteAt: schema.content.revisionNoteAt,
      revisionByName: sql`(SELECT COALESCE(u.nama_lengkap, u.username) FROM team_member tm JOIN users u ON u.id_users = tm.id_user WHERE tm.id_member = ${schema.content.revisionNoteBy} AND tm.deleted_at IS NULL)`.as("revisionByName"),
      statusApproval: schema.content.statusApproval,
      createdAt: schema.content.createdAt,
      updatedAt: schema.content.updatedAt,
      namaProjek: schema.project.namaProjek,
      namaTim: schema.team.namaTim,
      uploaderName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as("uploaderName"),
    })
    .from(schema.content)
    .leftJoin(schema.project, eq(schema.content.idProject, schema.project.idProject))
    .leftJoin(schema.team, eq(schema.project.idTeam, schema.team.idTeam))
    .leftJoin(schema.teamMember, eq(schema.content.idUploader, schema.teamMember.idMember))
    .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
    .where(and(eq(schema.content.idContent, id), isNull(schema.content.deletedAt)))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Content not found" }, 404);

  const my = await getMyMembership(actor.idUser, Number(row.idTeam));
  if (!my) return c.json({ status: "error", message: "You are not a member of this team" }, 403);

  const revisions = await getRevisionLog("content", id);

  return c.json({ status: "ok", data: { ...row, revisions } });
});

meRoutes.put("/contents/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const judulKonten = String(body?.judulKonten ?? "").trim();
  const fileDraft = body?.fileDraft !== undefined && body.fileDraft !== null ? String(body.fileDraft) : null;
  const catatan = body?.catatan !== undefined && body.catatan !== null ? String(body.catatan) : null;
  const revisionNote = body?.revisionNote !== undefined && body.revisionNote !== null && String(body.revisionNote).trim() ? String(body.revisionNote).trim() : null;

  if (!judulKonten) {
    return c.json({ status: "error", message: "Content title is required" }, 400);
  }

  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [row] = await db
    .select({
      idContent: schema.content.idContent,
      idProject: schema.content.idProject,
      idTeam: schema.project.idTeam,
      judulKonten: schema.content.judulKonten,
    })
    .from(schema.content)
    .leftJoin(schema.project, eq(schema.content.idProject, schema.project.idProject))
    .where(and(eq(schema.content.idContent, id), isNull(schema.content.deletedAt)))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Content not found" }, 404);

  const my = await getMyMembership(actor.idUser, Number(row.idTeam));
  if (!my) return c.json({ status: "error", message: "You are not a member of this team" }, 403);

  const now = new Date();
  const [updated] = await db
    .update(schema.content)
    .set({
      judulKonten,
      fileDraft,
      catatan,
      revisionNote,
      revisionNoteBy: revisionNote ? my.idMember : null,
      revisionNoteAt: revisionNote ? now : null,
      statusApproval: "pending",
      updatedAt: now,
    })
    .where(eq(schema.content.idContent, id))
    .returning();

  if (revisionNote) {
    await insertRevisionLog("content", id, my.idMember, revisionNote);
  }

  const revisions = await getRevisionLog("content", id);

  await writeLog({
    idUser: actor.idUser,
    aksi: "UPDATE",
    namaTabel: "content",
    idReferensi: id,
    keterangan: `Content "${judulKonten}" edited and submission reset to pending`,
    oldValues: JSON.stringify(row),
    newValues: JSON.stringify(updated),
  });

  return c.json({ status: "ok", data: { ...updated, revisions } });
});

meRoutes.delete("/contents/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const actor = getActor(c);
  if (!actor) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const [row] = await db
    .select({
      idContent: schema.content.idContent,
      idProject: schema.content.idProject,
      idTeam: schema.project.idTeam,
      judulKonten: schema.content.judulKonten,
    })
    .from(schema.content)
    .leftJoin(schema.project, eq(schema.content.idProject, schema.project.idProject))
    .where(and(eq(schema.content.idContent, id), isNull(schema.content.deletedAt)))
    .limit(1);
  if (!row) return c.json({ status: "error", message: "Content not found" }, 404);

  const my = await getMyMembership(actor.idUser, Number(row.idTeam));
  if (!my) return c.json({ status: "error", message: "You are not a member of this team" }, 403);

  const [deleted] = await db
    .update(schema.content)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.content.idContent, id))
    .returning();

  await writeLog({
    idUser: actor.idUser,
    aksi: "DELETE",
    namaTabel: "content",
    idReferensi: id,
    keterangan: `Content "${row.judulKonten}" deleted from project`,
    oldValues: JSON.stringify(deleted),
  });

  return c.json({ status: "ok", message: "Content deleted" });
});

meRoutes.get("/team", async (c) => {
  const payload = c.get("jwtPayload");
  const userId = payload.id_users;

  const memberships = await db
    .select()
    .from(schema.teamMember)
    .where(
      and(
        eq(schema.teamMember.idUser, userId),
        isNull(schema.teamMember.deletedAt)
      )
    );

  const teams = [];
  for (const membership of memberships) {
    const [team] = await db
      .select()
      .from(schema.team)
      .where(eq(schema.team.idTeam, membership.idTeam))
      .limit(1);

    if (!team || team.deletedAt) continue;

    const members = await db
      .select({
        idMember: schema.teamMember.idMember,
        idUser: schema.teamMember.idUser,
        job: schema.teamMember.job,
        deletedAt: schema.teamMember.deletedAt,
        namaLengkap: schema.users.namaLengkap,
        username: schema.users.username,
        email: schema.users.email,
      })
      .from(schema.teamMember)
      .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
      .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
      .where(
        and(
          eq(schema.teamMember.idTeam, membership.idTeam),
          isNull(schema.teamMember.deletedAt),
          not(eq(schema.role.role, "Superadmin"))
        )
      );

    const projects = await db
      .select({
        idProject: schema.project.idProject,
        namaProjek: schema.project.namaProjek,
        idTeam: schema.project.idTeam,
        deadline: schema.project.deadline,
        createdAt: schema.project.createdAt,
        deletedAt: schema.project.deletedAt,
        namaTim: schema.team.namaTim,
      })
      .from(schema.project)
      .leftJoin(schema.team, eq(schema.project.idTeam, schema.team.idTeam))
      .where(
        and(
          eq(schema.project.idTeam, membership.idTeam),
          isNull(schema.project.deletedAt)
        )
      )
      .orderBy(desc(schema.project.createdAt));

    const projectsWithItems = [];
    for (const project of projects) {
      const scripts = await db
        .select({
          idScript: schema.script.idScript,
          idProject: schema.script.idProject,
          judulScript: schema.script.judulScript,
          statusApproval: schema.script.statusApproval,
          createdAt: schema.script.createdAt,
          writerName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as('writerName'),
        })
        .from(schema.script)
        .leftJoin(
          schema.teamMember,
          eq(schema.script.idWriter, schema.teamMember.idMember)
        )
        .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
        .where(
          and(
            eq(schema.script.idProject, project.idProject),
            isNull(schema.script.deletedAt)
          )
        )
        .orderBy(desc(schema.script.createdAt));

      const scriptIds = scripts.map((s) => s.idScript);
      const scriptRevisions = scriptIds.length
        ? await db
            .select({
              idScript: schema.scriptRevision.idScript,
              reviewerName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as("reviewerName"),
              createdAt: schema.scriptRevision.createdAt,
            })
            .from(schema.scriptRevision)
            .leftJoin(schema.teamMember, eq(schema.scriptRevision.idReviewer, schema.teamMember.idMember))
            .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
            .where(inArray(schema.scriptRevision.idScript, scriptIds))
            .orderBy(desc(schema.scriptRevision.createdAt))
        : [];
      const scriptRevMap = {};
      for (const rev of scriptRevisions) {
        if (!scriptRevMap[rev.idScript]) {
          scriptRevMap[rev.idScript] = {
            revisionCount: 1,
            lastRevisorName: rev.reviewerName,
            lastRevisionAt: rev.createdAt,
          };
        } else {
          scriptRevMap[rev.idScript].revisionCount += 1;
        }
      }
      const scriptsWithRevs = scripts.map((s) => ({
        ...s,
        ...(scriptRevMap[s.idScript] || { revisionCount: 0, lastRevisorName: null, lastRevisionAt: null }),
      }));

      const contents = await db
        .select({
          idContent: schema.content.idContent,
          idProject: schema.content.idProject,
          judulKonten: schema.content.judulKonten,
          statusApproval: schema.content.statusApproval,
          createdAt: schema.content.createdAt,
          uploaderName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as('uploaderName'),
        })
        .from(schema.content)
        .leftJoin(
          schema.teamMember,
          eq(schema.content.idUploader, schema.teamMember.idMember)
        )
        .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
        .where(
          and(
            eq(schema.content.idProject, project.idProject),
            isNull(schema.content.deletedAt)
          )
        )
        .orderBy(desc(schema.content.createdAt));

      const contentIds = contents.map((cItem) => cItem.idContent);
      const contentRevisions = contentIds.length
        ? await db
            .select({
              idContent: schema.contentRevision.idContent,
              reviewerName: sql`COALESCE(${schema.users.namaLengkap}, ${schema.users.username})`.as("reviewerName"),
              createdAt: schema.contentRevision.createdAt,
            })
            .from(schema.contentRevision)
            .leftJoin(schema.teamMember, eq(schema.contentRevision.idReviewer, schema.teamMember.idMember))
            .leftJoin(schema.users, eq(schema.teamMember.idUser, schema.users.idUsers))
            .where(inArray(schema.contentRevision.idContent, contentIds))
            .orderBy(desc(schema.contentRevision.createdAt))
        : [];
      const contentRevMap = {};
      for (const rev of contentRevisions) {
        if (!contentRevMap[rev.idContent]) {
          contentRevMap[rev.idContent] = {
            revisionCount: 1,
            lastRevisorName: rev.reviewerName,
            lastRevisionAt: rev.createdAt,
          };
        } else {
          contentRevMap[rev.idContent].revisionCount += 1;
        }
      }
      const contentsWithRevs = contents.map((cItem) => ({
        ...cItem,
        ...(contentRevMap[cItem.idContent] || { revisionCount: 0, lastRevisorName: null, lastRevisionAt: null }),
      }));

      projectsWithItems.push({ ...project, scripts: scriptsWithRevs, contents: contentsWithRevs });
    }

    teams.push({
      ...team,
      memberCount: members.length,
      members,
      projects: projectsWithItems,
    });
  }

  return c.json({ status: "ok", data: teams });
});