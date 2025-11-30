import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
