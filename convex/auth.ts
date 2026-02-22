import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { jwtVerify, JWTPayload } from "jose";

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET environment variable is not configured.");
  }
  return secret;
}

type AuthTokenClaims = JWTPayload & {
    userId?: string;
    roles?: string[];
};

async function decodeAuthToken(authToken: string): Promise<AuthTokenClaims> {
    if (!authToken) {
        throw new Error("Unauthorized: Missing auth token");
    }

    try {
        const JWT_SECRET = getJWTSecret();
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(authToken, secret, { algorithms: ["HS256"] });
        return payload as AuthTokenClaims;
    } catch (error) {
        throw new Error("Unauthorized: Invalid auth token");
    }
}

/**
 * Decode Tekir's HS256 JWT (used in cookies and forwarded to Convex via convex.setAuth).
 * Exported so queries/mutations can validate roles without relying on Convex identity.
 */
export async function decodeTekirJwt(authToken: string): Promise<AuthTokenClaims> {
    return decodeAuthToken(authToken);
}

/**
 * Require an auth token and the admin role (Tekir JWT path).
 */
export async function requireAdminWithToken(authToken: string) {
    const claims = await decodeAuthToken(authToken);
    const roles = (claims.roles ?? []).map((r) => r?.toLowerCase());
    if (!roles.includes("admin")) {
        throw new Error("Forbidden: Admin access required");
    }
    return claims;
}

/**
 * Require a valid cron secret (server/cron path).
 *
 * This is intended for internal server-to-server calls only (e.g. Convex cron → Next route → Convex).
 * It does not rely on Convex auth identity, which isn't configured in Tekir.
 */
export function requireCronSecret(cronSecret?: string) {
    const expected = process.env.CONVEX_CRON_SECRET;
    if (!expected) {
        throw new Error("Unauthorized: Cron secret not configured");
    }
    if (!cronSecret || cronSecret !== expected) {
        throw new Error("Unauthorized: Invalid cron secret");
    }
}

/**
 * Require a user to be authenticated.
 * Returns the user identity.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("Unauthorized: Authentication required");
    }
    return identity;
}

function normalizedRolesFromIdentity(identity: any): string[] {
    const raw =
        identity?.tokenIdentifierClaims?.roles ??
        identity?.claims?.roles ??
        identity?.roles ??
        [];
    if (!Array.isArray(raw)) return [];
    return raw
        .map((r) => (typeof r === "string" ? r.toLowerCase() : ""))
        .filter(Boolean);
}

/**
 * Require a user to be authenticated and have the 'admin' role.
 * Returns the user document.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
    const identity = await requireAuth(ctx);

    // Preferred: roles embedded in the authenticated identity (JWT claims).
    // This avoids relying on email being present in the Convex identity.
    const roles = normalizedRolesFromIdentity(identity);
    if (roles.includes("admin")) {
        // Still return the user doc when possible (for auditing), but don't require it.
        const maybeEmail = (identity as any)?.email;
        if (typeof maybeEmail === "string" && maybeEmail.length > 0) {
            const user = await ctx.db
                .query("users")
                .withIndex("by_email", (q) => q.eq("email", maybeEmail))
                .unique();
            if (user) return user;
        }
        return null as any;
    }

    // Fallback: check the user record by email (legacy path).
    const email = (identity as any)?.email;
    if (!email) {
        throw new Error("Forbidden: Admin access required");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();

    if (!user || !user.roles?.includes("admin")) {
        throw new Error("Forbidden: Admin access required");
    }

    return user;
}

/**
 * Require the authenticated user to match the provided userId, or be an admin.
 * Returns the authenticated user document.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
    const identity = await requireAuth(ctx);

    if (!identity.email) {
        throw new Error("Unauthorized: Email required");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .unique();

    if (!user) {
        throw new Error("Unauthorized: User not found");
    }

    // Check if user matches target ID or is admin
    if (user._id !== userId && !user.roles?.includes("admin")) {
        throw new Error("Forbidden: You can only access your own data");
    }

    return user;
}

/**
 * Require authentication via Tekir JWT token instead of Convex auth identity.
 * Primarily used for browser clients that authenticate with our custom backend
 * and forward the JWT as part of Convex queries/mutations.
 */
export async function requireUserWithToken(
    ctx: QueryCtx | MutationCtx,
    userId: Id<"users">,
    authToken: string
) {
    const claims = await decodeAuthToken(authToken);

    if (!claims.userId) {
        throw new Error("Unauthorized: Invalid auth token payload");
    }

    const actorUserId = claims.userId as Id<"users">;
    const [actorUser, targetUser] = await Promise.all([
        ctx.db.get(actorUserId),
        ctx.db.get(userId),
    ]);

    if (!actorUser) {
        throw new Error("Unauthorized: Token user not found");
    }

    if (!targetUser) {
        throw new Error("Unauthorized: User not found");
    }

    const isSameUser = actorUser._id === userId;
    const isAdmin = !!actorUser.roles?.includes("admin");

    if (!isSameUser && !isAdmin) {
        throw new Error("Forbidden: You can only access your own data");
    }

    return targetUser;
}
