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
import { authMiddleware } from "./middleware/auth.js";
import { db, schema } from "./db/index.js";
import { sql, isNull } from "drizzle-orm";

const app = new Hono();

app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth routes (public & protected mixed)
app.route("/api/auth", authRoutes);

// Protected admin routes
const admin = new Hono();
admin.use("*", authMiddleware);

admin.route("/users", userRoutes);
admin.route("/roles", roleRoutes);
admin.route("/teams", teamRoutes);
admin.route("/projects", projectRoutes);
admin.route("/scripts", scriptRoutes);
admin.route("/contents", contentRoutes);
admin.route("/activity-logs", activityLogRoutes);
admin.route("/backup", backupRoutes);
admin.route("/chat", chatRoutes);

app.route("/api/admin", admin);

// Public stats endpoint for dashboard overview
app.get("/api/dashboard", async (c) => {
  try {
    const [userCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt));

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
