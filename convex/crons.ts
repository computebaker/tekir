import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Run resetDailyRequestCounts shortly after midnight UTC every day
// Using internal mutation since cron jobs don't have auth context
crons.cron("daily-reset-request-counts", "5 0 * * *", internal.sessions.resetDailyRequestCountsInternal);

// Also run cleanExpiredSessions every hour to keep the table small
crons.interval("hourly-clean-expired-sessions", { hours: 1 }, api.sessions.cleanExpiredSessions);

// Daily subscription validation - runs at 03:00 UTC every day
// Verifies all Plus users have active subscriptions in Polar
// Removes 'paid' role from users whose subscriptions have expired or been canceled
crons.cron("daily-subscription-validation", "0 3 * * *", internal.subscriptions.validateSubscriptions);

export default crons;
