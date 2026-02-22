"use client";

export function BuildInfo() {
  const deployment = process.env.NEXT_PUBLIC_DEPLOYMENT_ID;
  const sha = process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7);

  // Don't show anything in development
  if (deployment === 'local' && sha === 'dev') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Deploy: {deployment}</span>
      <span>·</span>
      <span>Commit: {sha}</span>
    </div>
  );
}
