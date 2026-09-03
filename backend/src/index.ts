import { Hono } from "hono";
import { cors } from "hono/cors";
import { count, eq, and, not } from "drizzle-orm";
import { db, schema } from "./db";
import { authRoutes } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { userRoutes } from "./routes/users";
import { roleRoutes } from "./routes/roles";
import { activityLogRoutes } from "./routes/activity-logs";
import { teamRoutes } from "./routes/teams";
import { backupRoutes } from "./routes/backup";
import { chatRoutes } from "./routes/chat";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.route("/api/auth", authRoutes);

app.get("/api/health", async (c) => {
  try {
    const roles = await db.select().from(schema.role).limit(1);
    const usersCount = await db
      .select({ id: schema.users.idUsers })
      .from(schema.users)
      .limit(1);

    return c.json({
      status: "ok",
      service: "Hono Backend",
      database: {
        connected: true,
        roleRow: roles.length,
        userRow: usersCount.length,
      },
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        service: "Hono Backend",
        database: { connected: false, error: (error as Error).message },
      },
      500
    );
  }
});

app.get("/api/dashboard", async (c) => {
  try {
    const [activeUsersRow] = await db
      .select({ value: count() })
      .from(schema.users)
      .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
      .where(and(eq(schema.users.status, "active"), not(eq(schema.role.role, "superadmin"))));

    const [totalProjectsRow] = await db
      .select({ value: count() })
      .from(schema.project);

    return c.json({
      status: "ok",
      data: {
        activeUsers: activeUsersRow?.value ?? 0,
        totalProjects: totalProjectsRow?.value ?? 0,
      },
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        message: (error as Error).message,
      },
      500
    );
  }
});

app.use("/api/admin/*", authMiddleware);

app.route("/api/admin/users", userRoutes);
app.route("/api/admin/roles", roleRoutes);
app.route("/api/admin/activity-logs", activityLogRoutes);
app.route("/api/admin/teams", teamRoutes);
app.route("/api/admin/backup", backupRoutes);
app.route("/api/admin/chat", chatRoutes);

export default app;
