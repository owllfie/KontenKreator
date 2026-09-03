import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { signJwt, verifyJwt } from "../lib/jwt";
import { verifyRecaptcha } from "../lib/recaptcha";

export const authRoutes = new Hono();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

authRoutes.get("/google", (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return c.text("Google OAuth is not configured", 500);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error) {
    return c.redirect(
      `${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return c.text(`Failed to exchange code: ${errText}`, 400);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
    };

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return c.text("Failed to fetch Google user info", 400);
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!googleUser.email) {
      return c.text("Google account has no verified email", 400);
    }

    const existingUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, googleUser.email))
      .limit(1);

    let user = existingUsers[0];
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      const [userRole] = await db
        .select()
        .from(schema.role)
        .where(eq(schema.role.role, "user"))
        .limit(1);

      if (!userRole) {
        return c.text("Default 'user' role not found in database", 500);
      }

      const usernameBase = googleUser.name || googleUser.email.split("@")[0];
      const uniqueUsername = await ensureUniqueUsername(usernameBase);

      const [createdUser] = await db
        .insert(schema.users)
        .values({
          username: uniqueUsername,
          email: googleUser.email,
          password: null,
          idRole: userRole.idRole,
          status: "active",
        })
        .returning();

      user = createdUser;

      const teamName = `${googleUser.name || usernameBase}'s Team`;

      const [createdTeam] = await db
        .insert(schema.team)
        .values({ namaTim: teamName })
        .returning();

      await db.insert(schema.teamMember).values({
        idTeam: createdTeam.idTeam,
        idUser: createdUser.idUsers,
        job: "Admin",
      });
    }

    const token = await signJwt({
      id_users: user.idUsers,
      email: user.email,
      id_role: user.idRole,
    });

    return c.redirect(
      `${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`
    );
  } catch (err) {
    return c.text(
      `Google OAuth callback error: ${(err as Error).message}`,
      500
    );
  }
});

async function getBody(c: any): Promise<Record<string, unknown> | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

async function verifyRecaptchaOrFail(
  c: any,
  token?: string
): Promise<boolean> {
  const result = await verifyRecaptcha(token || "");
  if (!result.success) {
    c.status(400);
    c.header("Content-Type", "application/json");
    return false;
  }
  return true;
}

async function createUserRecord(input: {
  username: string;
  email: string;
  password: string | null;
}): Promise<{ user: typeof schema.users.$inferSelect; isNew: boolean }> {
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
    .where(eq(schema.role.role, "user"))
    .limit(1);

  if (!userRole) {
    throw new Error("Default 'user' role not found in database");
  }

  const uniqueUsername = await ensureUniqueUsername(input.username);

  const [createdUser] = await db
    .insert(schema.users)
    .values({
      username: uniqueUsername,
      email: input.email,
      password: input.password,
      idRole: userRole.idRole,
      status: "active",
    })
    .returning();

  const teamName = `${uniqueUsername}'s Team`;
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

  const recaptchaToken = (body.recaptchaToken as string) || "";
  const ok = await verifyRecaptchaOrFail(c, recaptchaToken);
  if (!ok) {
    return c.json(
      { status: "error", message: "reCAPTCHA verification failed" },
      400
    );
  }

  const username = (body.username as string) || "";
  const email = (body.email as string) || "";
  const password = (body.password as string) || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ status: "error", message: "Valid email is required" }, 400);
  }
  if (!username) {
    return c.json({ status: "error", message: "Username is required" }, 400);
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
      email,
      password: await Bun.password.hash(password),
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
          email: user.email,
          id_role: user.idRole,
        },
      },
    });
  } catch (err) {
    return c.json(
      { status: "error", message: (err as Error).message },
      500
    );
  }
});

authRoutes.post("/login", async (c) => {
  const body = await getBody(c);
  if (!body) {
    return c.json({ status: "error", message: "Invalid JSON body" }, 400);
  }

  const recaptchaToken = (body.recaptchaToken as string) || "";
  const ok = await verifyRecaptchaOrFail(c, recaptchaToken);
  if (!ok) {
    return c.json(
      { status: "error", message: "reCAPTCHA verification failed" },
      400
    );
  }

  const email = (body.username as string) || "";
  const password = (body.password as string) || "";

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
      { status: "error", message: "Invalid email or password" },
      401
    );
  }

  const passwordValid = await Bun.password.verify(password, user.password);
  if (!passwordValid) {
    return c.json(
      { status: "error", message: "Invalid email or password" },
      401
    );
  }

  const token = await signJwt({
    id_users: user.idUsers,
    email: user.email,
    id_role: user.idRole,
  });

  return c.json({
    status: "ok",
    message: "Login successful",
    data: {
      token,
      user: {
        id_users: user.idUsers,
        username: user.username,
        email: user.email,
        id_role: user.idRole,
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

    const username = (body.username as string)?.trim();
    const email = (body.email as string)?.trim();
    const noTelp = (body.noTelp as string)?.trim() || null;
    const currentPassword = (body.currentPassword as string) || "";
    const newPassword = (body.newPassword as string) || "";

    if (!username) {
      return c.json({ status: "error", message: "Username is required" }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ status: "error", message: "Valid email is required" }, 400);
    }

    if (newPassword && newPassword.length < 6) {
      return c.json({ status: "error", message: "Password must be at least 6 characters" }, 400);
    }

    // Prevent another user (or newly registered user) from taking this email.
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
      // Require the current password before allowing a password change.
      if (!user.password) {
        return c.json({ status: "error", message: "Set a password first to change it" }, 400);
      }
      const valid = await Bun.password.verify(currentPassword, user.password);
      if (!valid) {
        return c.json({ status: "error", message: "Current password is incorrect" }, 401);
      }
      password = await Bun.password.hash(newPassword);
    }

    const [updated] = await db
      .update(schema.users)
      .set({ username, email, noTelp, password, updatedAt: new Date() })
      .where(eq(schema.users.idUsers, user.idUsers))
      .returning();

    return c.json({
      status: "ok",
      message: "Profile updated",
      data: {
        id_users: updated.idUsers,
        username: updated.username,
        email: updated.email,
        id_role: updated.idRole,
        no_telp: updated.noTelp,
      },
    });
  } catch (err) {
    return c.json({ status: "error", message: (err as Error).message }, 401);
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
      .select()
      .from(schema.users)
      .where(eq(schema.users.idUsers, payload.id_users))
      .limit(1);

    if (!user) {
      return c.json({ status: "error", message: "User not found" }, 404);
    }

    return c.json({
      status: "ok",
      data: {
        id_users: user.idUsers,
        username: user.username,
        email: user.email,
        id_role: user.idRole,
        no_telp: user.noTelp,
      },
    });
  } catch (err) {
    return c.json(
      { status: "error", message: (err as Error).message },
      401
    );
  }
});

async function ensureUniqueUsername(base: string): Promise<string> {
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
