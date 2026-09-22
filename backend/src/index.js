import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { roleRoutes } from "./routes/roles.js";
import { teamRoutes } from "./routes/teams.js";
import { projectRoutes } from "./routes/projects.js";
import { scriptRoutes } from "./routes/scripts.js";
import { contentRoutes } from "./routes/contents.js";
import { activityLogRoutes } from "./routes/activity-logs.js";
import { backupRoutes } from "./routes/backup.js";
import { chatRoutes } from "./routes/chat.js";
import { meRoutes } from "./routes/me.js";
import { authMiddleware } from "./middleware/auth.js";
import { db, schema } from "./db/index.js";
import { sql, eq, isNull, and, not } from "drizzle-orm";

const app = new Hono();

app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth routes (public & protected mixed)
app.route("/api/auth", authRoutes);

// Current-user routes (protected)
app.route("/api/me", meRoutes);

// AI Copilot chat (any authenticated role; RBAC enforced by role filter inside)
const chat = new Hono();
chat.use("*", authMiddleware);
chat.route("/", chatRoutes);
app.route("/api/chat", chat);

// Protected admin routes
const admin = new Hono();
admin.use("*", authMiddleware);
admin.use("*", async (c, next) => {
  const payload = c.get("jwtPayload");
  if (!payload) return c.json({ status: "error", message: "Unauthorized" }, 401);
  const [user] = await db
    .select({ role: schema.role.role })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(eq(schema.users.idUsers, payload.id_users))
    .limit(1);
  if (!user || !["superadmin", "admin"].includes((user.role || "").toLowerCase())) {
    return c.json({ status: "error", message: "Forbidden: admin access required" }, 403);
  }
  return next();
});

async function hasPermission(c, code) {
  const payload = c.get("jwtPayload");
  if (!payload) return false;

  const [user] = await db
    .select({ idRole: schema.users.idRole, role: schema.role.role })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(eq(schema.users.idUsers, payload.id_users))
    .limit(1);
  if (!user) return false;
  if ((user.role || "").toLowerCase() === "superadmin") return true;

  const [row] = await db
    .select({ idPermission: schema.rolePermissions.idPermission })
    .from(schema.rolePermissions)
    .innerJoin(
      schema.permissions,
      eq(schema.rolePermissions.idPermission, schema.permissions.idPermission)
    )
    .where(
      and(
        eq(schema.rolePermissions.idRole, user.idRole),
        eq(schema.permissions.namaPermission, code)
      )
    )
    .limit(1);
  return Boolean(row);
}

const requirePermission = (code) => async (c, next) => {
  if (!(await hasPermission(c, code))) {
    return c.json({ status: "error", message: "Forbidden: permission denied" }, 403);
  }
  return next();
};

admin.use("/activity-logs", requirePermission("view_activity_logs"));
admin.use("/backup", requirePermission("view_backup"));

admin.route("/users", userRoutes);
admin.route("/roles", roleRoutes);
admin.route("/teams", teamRoutes);
admin.route("/projects", projectRoutes);
admin.route("/scripts", scriptRoutes);
admin.route("/contents", contentRoutes);
admin.route("/activity-logs", activityLogRoutes);
admin.route("/backup", backupRoutes);

app.route("/api/admin", admin);

// Public stats endpoint for dashboard overview
app.get("/api/dashboard", async (c) => {
  try {
    const [userCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.users)
      .leftJoin(schema.role, eq(schema.role.idRole, schema.users.idRole))
      .where(
        and(
          isNull(schema.users.deletedAt),
          not(eq(schema.role.role, "Superadmin"))
        )
      );

    const [projectCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.project)
      .where(isNull(schema.project.deletedAt));

    const [teamCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.team)
      .where(isNull(schema.team.deletedAt));

    const [scriptCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.script)
      .where(isNull(schema.script.deletedAt));

    const [contentCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.content)
      .where(isNull(schema.content.deletedAt));

    return c.json({
      status: "ok",
      data: {
        activeUsers: userCount?.count ?? 0,
        totalProjects: projectCount?.count ?? 0,
        totalTeams: teamCount?.count ?? 0,
        totalScripts: scriptCount?.count ?? 0,
        totalContents: contentCount?.count ?? 0,
      },
    });
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

console.log(`Backend server is running on http://${host}:${port}`);

export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
