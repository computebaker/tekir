import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Run resetDailyRequestCounts shortly after midnight UTC every day
crons.cron("daily-reset-request-counts", "5 0 * * *", api.sessions.resetDailyRequestCounts);

// Also run cleanExpiredSessions every hour to keep the table small
crons.interval("hourly-clean-expired-sessions", { hours: 1 }, api.sessions.cleanExpiredSessions);

export default crons;
