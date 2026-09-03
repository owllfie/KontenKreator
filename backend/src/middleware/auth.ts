import { Context, Next } from "hono";
import { verifyJwt } from "../lib/jwt";

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ status: "error", message: "Unauthorized" }, 401);
  }
  try {
    const payload = await verifyJwt(authHeader.slice(7));
    c.set("jwtPayload", payload);
    await next();
  } catch {
    return c.json({ status: "error", message: "Invalid or expired token" }, 401);
  }
};
