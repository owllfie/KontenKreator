import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { signJwt, verifyJwt } from "../lib/jwt";
import { verifyRecaptcha } from "../lib/recaptcha";

export const authRoutes = new Hono();

async function hashPassword(password) {
  return Bun.password.hash(password, { algorithm: "bcrypt" });
}

async function getBody(c) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

async function verifyRecaptchaOrFail(c, token) {
  const result = await verifyRecaptcha(token || "");
  if (!result.success) {
    c.status(400);
    c.header("Content-Type", "application/json");
    return false;
  }
  return true;
}

async function createUserRecord(input) {
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);

  if (existing[0]) {
    return { user: existing[0], isNew: false };
  }

  const [userRole] = await db
    .select()
    .from(schema.role)
    .where(eq(schema.role.role, "User"))
    .limit(1);

  if (!userRole) {
    throw new Error("Default 'user' role not found in database");
  }

  const uniqueUsername = await ensureUniqueUsername(input.username);

  const [createdUser] = await db
    .insert(schema.users)
    .values({
      username: uniqueUsername,
      namaLengkap: input.namaLengkap || null,
      email: input.email,
      password: input.password,
      noTelp: input.noTelp || null,
      idRole: userRole.idRole,
      status: "active",
    })
    .returning();

  const teamName = `${input.namaLengkap || uniqueUsername}'s Team`;
  const [createdTeam] = await db
    .insert(schema.team)
    .values({ namaTim: teamName })
    .returning();

  await db.insert(schema.teamMember).values({
    idTeam: createdTeam.idTeam,
    idUser: createdUser.idUsers,
    job: "Admin",
  });

  return { user: createdUser, isNew: true };
}

authRoutes.post("/register", async (c) => {
  const body = await getBody(c);
  if (!body) {
    return c.json({ status: "error", message: "Invalid JSON body" }, 400);
  }

  const recaptchaToken = body.recaptchaToken || "";
  const ok = await verifyRecaptchaOrFail(c, recaptchaToken);
  if (!ok) {
    return c.json(
      { status: "error", message: "reCAPTCHA verification failed" },
      400
    );
  }

  const username = body.username || "";
  const fullName = body.namaLengkap || "";
  const email = body.email || "";
  const noTelp = body.noTelp || "";
  const password = body.password || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ status: "error", message: "Valid email is required" }, 400);
  }
  if (!username) {
    return c.json({ status: "error", message: "Username is required" }, 400);
  }
  if (!fullName.trim()) {
    return c.json({ status: "error", message: "Full name is required" }, 400);
  }
  if (!password || password.length < 6) {
    return c.json(
      { status: "error", message: "Password must be at least 6 characters" },
      400
    );
  }

  try {
    const { user } = await createUserRecord({
      username,
      namaLengkap: fullName.trim(),
      email,
      noTelp: noTelp.trim() || null,
      password: await hashPassword(password),
    });

    const token = await signJwt({
      id_users: user.idUsers,
      email: user.email,
      id_role: user.idRole,
    });

    return c.json({
      status: "ok",
      message: "Registration successful",
      data: {
        token,
        user: {
          id_users: user.idUsers,
          username: user.username,
          namaLengkap: user.namaLengkap,
          email: user.email,
          no_telp: user.noTelp,
          id_role: user.idRole,
          role: "User",
        },
      },
    });
  } catch (err) {
    return c.json(
      { status: "error", message: err.message },
      500
    );
  }
});

authRoutes.post("/login", async (c) => {
  const body = await getBody(c);
  if (!body) {
    return c.json({ status: "error", message: "Invalid JSON body" }, 400);
  }

  const recaptchaToken = body.recaptchaToken || "";
  const ok = await verifyRecaptchaOrFail(c, recaptchaToken);
  if (!ok) {
    return c.json(
      { status: "error", message: "reCAPTCHA verification failed" },
      400
    );
  }

  const email = body.username || "";
  const password = body.password || "";

  if (!email) {
    return c.json({ status: "error", message: "Username is required" }, 400);
  }
  if (!password) {
    return c.json({ status: "error", message: "Password is required" }, 400);
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, email))
    .limit(1);

  if (!user || !user.password) {
    return c.json(
      { status: "error", message: "Invalid username or password" },
      401
    );
  }

  const passwordValid = await Bun.password.verify(password, user.password);
  if (!passwordValid) {
    return c.json(
      { status: "error", message: "Invalid username or password" },
      401
    );
  }

  const token = await signJwt({
    id_users: user.idUsers,
    email: user.email,
    id_role: user.idRole,
  });

  const [role] = await db
    .select()
    .from(schema.role)
    .where(eq(schema.role.idRole, user.idRole))
    .limit(1);

  return c.json({
    status: "ok",
    message: "Login successful",
    data: {
      token,
      user: {
        id_users: user.idUsers,
        username: user.username,
        namaLengkap: user.namaLengkap,
        email: user.email,
        no_telp: user.noTelp,
        id_role: user.idRole,
        role: role?.role || "User",
      },
    },
  });
});

authRoutes.put("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ status: "error", message: "Missing token" }, 401);
  }

  try {
    const payload = await verifyJwt(authHeader.slice(7));
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.idUsers, payload.id_users))
      .limit(1);

    if (!user) {
      return c.json({ status: "error", message: "User not found" }, 404);
    }

    const body = await getBody(c);
    if (!body) {
      return c.json({ status: "error", message: "Invalid JSON body" }, 400);
    }

    const username = body.username?.trim();
    const namaLengkap = body.namaLengkap?.trim() || null;
    const email = body.email?.trim();
    const noTelp = body.noTelp?.trim() || null;
    const currentPassword = body.currentPassword || "";
    const newPassword = body.newPassword || "";

    if (!username) {
      return c.json({ status: "error", message: "Username is required" }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ status: "error", message: "Valid email is required" }, 400);
    }

    if (newPassword && newPassword.length < 6) {
      return c.json({ status: "error", message: "Password must be at least 6 characters" }, 400);
    }

    if (email !== user.email) {
      const [dup] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (dup && dup.idUsers !== user.idUsers) {
        return c.json({ status: "error", message: "Email is already in use" }, 409);
      }
    }

    let password = user.password;
    if (newPassword) {
      if (!user.password) {
        return c.json({ status: "error", message: "Set a password first to change it" }, 400);
      }
      const valid = await Bun.password.verify(currentPassword, user.password);
      if (!valid) {
        return c.json({ status: "error", message: "Current password is incorrect" }, 401);
      }
      password = await hashPassword(newPassword);
    }

    const [updated] = await db
      .update(schema.users)
      .set({ username, namaLengkap, email, noTelp, password, updatedAt: new Date() })
      .where(eq(schema.users.idUsers, user.idUsers))
      .returning();

    return c.json({
      status: "ok",
      message: "Profile updated",
      data: {
        id_users: updated.idUsers,
        username: updated.username,
        namaLengkap: updated.namaLengkap,
        email: updated.email,
        id_role: updated.idRole,
        role: "User",
        no_telp: updated.noTelp,
      },
    });
  } catch (err) {
    return c.json({ status: "error", message: err.message }, 401);
  }
});

authRoutes.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ status: "error", message: "Missing token" }, 401);
  }

  try {
    const payload = await verifyJwt(authHeader.slice(7));
    const [user] = await db
      .select({
        id_users: schema.users.idUsers,
        username: schema.users.username,
        namaLengkap: schema.users.namaLengkap,
        email: schema.users.email,
        id_role: schema.users.idRole,
        role: schema.role.role,
        no_telp: schema.users.noTelp,
        status: schema.users.status,
      })
      .from(schema.users)
      .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
      .where(eq(schema.users.idUsers, payload.id_users))
      .limit(1);

    if (!user) {
      return c.json({ status: "error", message: "User not found" }, 404);
    }

    let permissions;
    if ((user.role || "").toLowerCase() === "superadmin") {
      permissions = (
        await db
          .select({ namaPermission: schema.permissions.namaPermission })
          .from(schema.permissions)
          .where(isNull(schema.permissions.deletedAt))
      ).map((r) => r.namaPermission);
    } else {
      permissions = (
        await db
          .select({ namaPermission: schema.permissions.namaPermission })
          .from(schema.rolePermissions)
          .innerJoin(
            schema.permissions,
            eq(schema.rolePermissions.idPermission, schema.permissions.idPermission)
          )
          .where(
            and(
              eq(schema.rolePermissions.idRole, user.id_role),
              isNull(schema.permissions.deletedAt)
            )
          )
      ).map((r) => r.namaPermission);
    }

    return c.json({
      status: "ok",
      data: { ...user, permissions },
    });
  } catch (err) {
    return c.json(
      { status: "error", message: err.message },
      401
    );
  }
});

async function ensureUniqueUsername(base) {
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 50);

  const baseUsername = sanitized || "user";

  const existing = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.username, baseUsername))
    .limit(1);

  if (!existing[0]) {
    return baseUsername;
  }

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${baseUsername.slice(0, 43)}_${suffix}`;
}
