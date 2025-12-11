import { query } from "./_generated/server";

// NOTE: This is intentionally lightweight and should only be used in development.
// It helps diagnose whether Convex is receiving an auth identity from the browser.
// Intentionally left blank.
//
// This file previously held a temporary auth debug query.
// We keep the module to avoid breaking imports or generated types in-flight,
// but we deliberately export nothing.
