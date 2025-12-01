import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key";

type AuthTokenClaims = JwtPayload & {
    userId?: string;
    roles?: string[];
};

function decodeAuthToken(authToken: string): AuthTokenClaims {
    if (!authToken) {
        throw new Error("Unauthorized: Missing auth token");
    }

    try {
        return jwt.verify(authToken, JWT_SECRET, { algorithms: ["HS256"] }) as AuthTokenClaims;
    } catch (error) {
        throw new Error("Unauthorized: Invalid auth token");
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

/**
 * Require a user to be authenticated and have the 'admin' role.
 * Returns the user document.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
    const identity = await requireAuth(ctx);

    if (!identity.email) {
        throw new Error("Unauthorized: Email required for admin check");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
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
    const claims = decodeAuthToken(authToken);

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
