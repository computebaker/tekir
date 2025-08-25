"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/admin-shell";
import AdminGuard from "@/components/admin/admin-guard";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
// Stable empty array to avoid new reference on every render when data is missing
const EMPTY: any[] = [] as any[];
function yyyymmdd(ts: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return Number(`${y}${m}${day}`);
}
function dayNDaysAgo(n: number) {
  const now = new Date();
  const then = new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  return yyyymmdd(then.getTime());
}
function formatDayNum(num: number) {
  const s = num.toString();
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${y}-${m}-${d}`;
}

type Analytics = { users: number; feedbacks: number };

export default function AdminAnalyticsPage() {
  const users = useQuery(api.users.countUsers, {});
  const feedbacks = useQuery(api.feedbacks.countFeedbacks, {});
  // Date range filter: today, 7 days, 30 days
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const toDay = yyyymmdd(Date.now());
  const fromDay = useMemo(() => {
    if (range === 'today') return toDay;
    if (range === '7d') return dayNDaysAgo(6); // inclusive of today => 7 days
    return dayNDaysAgo(29); // 30 days
  }, [range, toDay]);

  // Broad usage ranges
  const searchRange = useQuery(api.usage.rangeSearchUsage as any, { fromDay, toDay }) as any[] | undefined;
  const aiRange = useQuery(api.usage.rangeAiUsage as any, { fromDay, toDay }) as any[] | undefined;
  const siteVisits = useQuery(api.usage.rangeSiteVisits as any, { fromDay, toDay }) as any[] | undefined;
  const apiHits = useQuery(api.usage.rangeApiHits as any, { fromDay, toDay }) as any[] | undefined;
  // Top tokens for end day of range (kept simple)
  const topTokens = useQuery(api.usage.topSearchTokensByDay as any, { day: toDay, limit: 20 }) as any[] | undefined;

  // Cache last known data so we don't blank the UI on filter changes
  const [usersCache, setUsersCache] = useState<number | undefined>(undefined);
  const [feedbacksCache, setFeedbacksCache] = useState<number | undefined>(undefined);
  const [searchRangeCache, setSearchRangeCache] = useState<any[] | undefined>(undefined);
  const [aiRangeCache, setAiRangeCache] = useState<any[] | undefined>(undefined);
  const [siteVisitsCache, setSiteVisitsCache] = useState<any[] | undefined>(undefined);
  const [apiHitsCache, setApiHitsCache] = useState<any[] | undefined>(undefined);
  const [topTokensCache, setTopTokensCache] = useState<any[] | undefined>(undefined);

  useEffect(() => { if (typeof users === 'number') setUsersCache(users); }, [users]);
  useEffect(() => { if (typeof feedbacks === 'number') setFeedbacksCache(feedbacks); }, [feedbacks]);
  useEffect(() => { if (searchRange) setSearchRangeCache(searchRange); }, [searchRange]);
  useEffect(() => { if (aiRange) setAiRangeCache(aiRange); }, [aiRange]);
  useEffect(() => { if (siteVisits) setSiteVisitsCache(siteVisits); }, [siteVisits]);
  useEffect(() => { if (apiHits) setApiHitsCache(apiHits); }, [apiHits]);
  useEffect(() => { if (topTokens) setTopTokensCache(topTokens); }, [topTokens]);

  const displayUsers = users ?? usersCache;
  const displayFeedbacks = feedbacks ?? feedbacksCache;
  const displaySearchRange = React.useMemo(() => (searchRange ?? searchRangeCache ?? EMPTY), [searchRange, searchRangeCache]);
  const displayAiRange = React.useMemo(() => (aiRange ?? aiRangeCache ?? EMPTY), [aiRange, aiRangeCache]);
  const displaySiteVisits = React.useMemo(() => (siteVisits ?? siteVisitsCache ?? EMPTY), [siteVisits, siteVisitsCache]);
  const displayApiHits = React.useMemo(() => (apiHits ?? apiHitsCache ?? EMPTY), [apiHits, apiHitsCache]);
  const displayTopTokens = React.useMemo(() => (topTokens ?? topTokensCache ?? EMPTY), [topTokens, topTokensCache]);

  const initialPageLoading =
    (users ?? usersCache) === undefined &&
    (feedbacks ?? feedbacksCache) === undefined &&
    (searchRange ?? searchRangeCache) === undefined &&
    (aiRange ?? aiRangeCache) === undefined &&
    (siteVisits ?? siteVisitsCache) === undefined &&
    (apiHits ?? apiHitsCache) === undefined &&
    (topTokens ?? topTokensCache) === undefined;

  // Provider/type filters (null = include all)
  const [providerFilter, setProviderFilter] = useState<string[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<string[] | null>(null);

  const providers = useMemo(() => Array.from(new Set((displaySearchRange || []).map(r => r.provider))).sort(), [displaySearchRange]);
  const types = useMemo(() => Array.from(new Set((displaySearchRange || []).map(r => r.type))).sort(), [displaySearchRange]);

  const filteredSearch = useMemo(() => {
    const rows = displaySearchRange || [];
    return rows.filter(r => (
      (providerFilter ? providerFilter.includes(r.provider) : true) &&
      (typeFilter ? typeFilter.includes(r.type) : true)
    ));
  }, [displaySearchRange, providerFilter, typeFilter]);

  const searchSummary = useMemo(() => {
    const totalCount = filteredSearch.reduce((sum, r) => sum + (r.count || 0), 0);
    const totalLatency = filteredSearch.reduce((sum, r) => sum + (r.totalResponseTimeMs || 0), 0);
    const totalResults = filteredSearch.reduce((sum, r) => sum + (r.totalResults || 0), 0);
    const avgLatency = totalCount > 0 ? Math.round(totalLatency / totalCount) : 0;
    return { totalCount, avgLatency, totalResults };
  }, [filteredSearch]);

  const aiSummary = useMemo(() => {
    const rows = displayAiRange || [];
    const totalCount = rows.reduce((sum, r) => sum + (r.count || 0), 0);
    const totalLatency = rows.reduce((sum, r) => sum + (r.totalLatencyMs || 0), 0);
    const totalChars = rows.reduce((sum, r) => sum + (r.totalAnswerChars || 0), 0);
    const avgLatency = totalCount > 0 ? Math.round(totalLatency / totalCount) : 0;
    return { totalCount, avgLatency, totalChars };
  }, [displayAiRange]);

  const loading = [users, feedbacks, searchRange, aiRange, siteVisits, apiHits, topTokens].some(v => v === undefined);

  // Prepare daily series for charts (by day key)
  const dayKeys = useMemo(() => {
    const keys: number[] = [];
    let d = fromDay;
    while (d <= toDay) {
      keys.push(d);
      // increment YYYYMMDD safely
      const s = d.toString();
      const y = Number(s.slice(0, 4));
      const m = Number(s.slice(4, 6));
      const day = Number(s.slice(6, 8));
      const dt = new Date(Date.UTC(y, m - 1, day));
      dt.setUTCDate(dt.getUTCDate() + 1);
      const ny = dt.getUTCFullYear();
      const nm = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
      const nd = dt.getUTCDate().toString().padStart(2, '0');
      d = Number(`${ny}${nm}${nd}`);
    }
    return keys;
  }, [fromDay, toDay]);

  type Pt = { x: number; y: number };
  const mkSeries = (rows: any[] | undefined, pick: (r: any) => number) => {
    const map = new Map<number, number>();
    for (const r of rows || []) {
      map.set(r.day, (map.get(r.day) || 0) + pick(r));
    }
    return dayKeys.map((k, i) => ({ x: i, y: map.get(k) || 0 }));
  };
  const searchSeries = mkSeries(displaySearchRange, r => r.count || 0);
  const aiSeries = mkSeries(displayAiRange, r => r.count || 0);
  const visitSeries = mkSeries(displaySiteVisits, r => r.count || 0);
  const apiSeries = mkSeries(displayApiHits, r => r.count || 0);
  const dayLabels = useMemo(() => dayKeys.map(formatDayNum), [dayKeys]);

  const BarChart = ({ series, title, labels }: { series: Pt[]; title: string; labels?: string[] }) => {
    const maxY = Math.max(1, ...series.map(p => p.y));
    const width = Math.max(120, series.length * 10);
    const height = 60;
    const barW = Math.max(2, Math.floor(width / Math.max(1, series.length * 1.5)));
    const gap = Math.max(1, Math.floor(barW / 2));
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground mb-2">{title}</div>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {series.map((p, idx) => {
            const h = Math.round((p.y / maxY) * (height - 4));
            const x = idx * (barW + gap);
            const y = height - h;
            const label = labels?.[idx] ?? `${idx}`;
            return (
              <g key={idx}>
                <rect x={x} y={y} width={barW} height={h} rx={1} className="fill-primary/70" />
                <title>{`${title}: ${p.y}\n${label}`}</title>
              </g>
            );
          })}
          <line x1={0} y1={height-1} x2={width} y2={height-1} className="stroke-muted" strokeWidth={1} />
        </svg>
      </div>
    );
  };

  const exportCsv = () => {
    const rows = dayKeys.map((dayNum, i) => {
      const day = formatDayNum(dayNum);
      const searches = searchSeries[i]?.y ?? 0;
      const ai = aiSeries[i]?.y ?? 0;
      const visits = visitSeries[i]?.y ?? 0;
      const hits = apiSeries[i]?.y ?? 0;
      return `${day},${searches},${ai},${visits},${hits}`;
    });
    const csv = [
      'day,searches,ai_requests,site_visits,api_hits',
      ...rows,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${fromDay}-${toDay}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell>
      <AdminGuard />
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Overview</h2>
  {initialPageLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-6 animate-pulse h-24" />
            <div className="rounded-lg border border-border bg-card p-6 animate-pulse h-24" />
            <div className="rounded-lg border border-border bg-card p-6 sm:col-span-2">
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-48 bg-muted rounded" />
                <div className="grid sm:grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-3 w-40 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-56 bg-muted rounded" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-10 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-56 bg-muted rounded" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-3 w-28 bg-muted rounded" />
                    <div className="h-3 w-10 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground">Total Users</div>
              {displayUsers === undefined ? (
                <div className="h-8 bg-muted rounded animate-pulse w-24" />
              ) : (
                <div className="text-3xl font-bold">{displayUsers}</div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground">Feedback Entries</div>
              {displayFeedbacks === undefined ? (
                <div className="h-8 bg-muted rounded animate-pulse w-24" />
              ) : (
                <div className="text-3xl font-bold">{displayFeedbacks}</div>
              )}
            </div>
            {/* Filters & Summaries */}
            <div className="rounded-lg border border-border bg-card p-6 col-span-2">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="text-sm text-muted-foreground">Range</div>
                <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background">
                  {([
                    { k: 'today', label: 'Today' },
                    { k: '7d', label: 'Last 7 days' },
                    { k: '30d', label: 'Last 30 days' },
                  ] as const).map(opt => (
                    <button key={opt.k}
                      onClick={() => setRange(opt.k)}
                      className={`px-3 py-1 rounded-md text-sm ${range === opt.k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >{opt.label}</button>
                  ))}
                </div>
                <div className="flex-1" />
                <button onClick={exportCsv} className="px-3 py-1 rounded-md border text-sm hover:bg-muted" title="Export per-day metrics as CSV">
                  Export CSV
                </button>

                {/* Provider filters */}
                {providers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Providers</div>
                    <div className="flex flex-wrap gap-2">
                      {providers.map(p => {
                        const active = !providerFilter || providerFilter.includes(p);
                        return (
                          <button key={p}
                            onClick={() => {
                              setProviderFilter(prev => {
                                if (prev === null) return [p];
                                const set = new Set(prev);
                                if (set.has(p)) set.delete(p); else set.add(p);
                                const next = Array.from(set);
                                return next.length === providers.length ? null : next;
                              });
                            }}
                            className={`px-2 py-1 rounded border text-xs ${active ? 'bg-secondary text-secondary-foreground border-secondary' : 'hover:bg-muted'}`}
                            title={`Toggle ${p}`}
                          >{p}</button>
                        );
                      })}
                      <button
                        onClick={() => setProviderFilter(null)}
                        className="px-2 py-1 rounded border text-xs hover:bg-muted"
                      >All</button>
                    </div>
                  </div>
                )}

                {/* Type filters */}
                {types.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Types</div>
                    <div className="flex flex-wrap gap-2">
                      {types.map(t => {
                        const active = !typeFilter || typeFilter.includes(t);
                        return (
                          <button key={t}
                            onClick={() => {
                              setTypeFilter(prev => {
                                if (prev === null) return [t];
                                const set = new Set(prev);
                                if (set.has(t)) set.delete(t); else set.add(t);
                                const next = Array.from(set);
                                return next.length === types.length ? null : next;
                              });
                            }}
                            className={`px-2 py-1 rounded border text-xs ${active ? 'bg-secondary text-secondary-foreground border-secondary' : 'hover:bg-muted'}`}
                            title={`Toggle ${t}`}
                          >{t}</button>
                        );
                      })}
                      <button
                        onClick={() => setTypeFilter(null)}
                        className="px-2 py-1 rounded border text-xs hover:bg-muted"
                      >All</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Summaries */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground mb-1">Searches</div>
                  {displaySearchRange.length === 0 && (searchRange ?? searchRangeCache) === undefined ? (
                    <div className="h-6 bg-muted rounded animate-pulse w-20" />
                  ) : (
                    <div className="text-2xl font-bold">{searchSummary.totalCount}</div>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground mb-1">Avg Search Latency</div>
                  {displaySearchRange.length === 0 && (searchRange ?? searchRangeCache) === undefined ? (
                    <div className="h-6 bg-muted rounded animate-pulse w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{searchSummary.avgLatency} ms</div>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground mb-1">Total Results Returned</div>
                  {displaySearchRange.length === 0 && (searchRange ?? searchRangeCache) === undefined ? (
                    <div className="h-6 bg-muted rounded animate-pulse w-28" />
                  ) : (
                    <div className="text-2xl font-bold">{searchSummary.totalResults}</div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground mb-1">AI Requests</div>
                  {displayAiRange.length === 0 && (aiRange ?? aiRangeCache) === undefined ? (
                    <div className="h-6 bg-muted rounded animate-pulse w-20" />
                  ) : (
                    <div className="text-2xl font-bold">{aiSummary.totalCount}</div>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground mb-1">Avg AI Latency</div>
                  {displayAiRange.length === 0 && (aiRange ?? aiRangeCache) === undefined ? (
                    <div className="h-6 bg-muted rounded animate-pulse w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{aiSummary.avgLatency} ms</div>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground mb-1">Total AI Answer Chars</div>
                  {displayAiRange.length === 0 && (aiRange ?? aiRangeCache) === undefined ? (
                    <div className="h-6 bg-muted rounded animate-pulse w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{aiSummary.totalChars}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">Top Search Tokens (latest day)</div>
              <div className="text-sm space-y-1">
                {(displayTopTokens || []).map((t: any) => (
                  <div key={t.token} className="flex items-center justify-between">
                    <span>{t.token}</span>
                    <span className="font-semibold">{t.count}</span>
                  </div>
                ))}
                {((topTokens ?? topTokensCache) === undefined) && (
                  <div className="space-y-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-10 bg-muted rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                )}
                {(displayTopTokens.length === 0 && (topTokens ?? topTokensCache) !== undefined) && (
                  <div className="text-muted-foreground">No data yet</div>
                )}
              </div>
            </div>
            {/* Charts */}
            <div className="sm:col-span-2 grid md:grid-cols-4 gap-4">
              {(displaySearchRange.length === 0 && (searchRange ?? searchRangeCache) === undefined) ? (
                <div className="rounded-lg border border-border bg-card p-4 animate-pulse h-[100px]" />
              ) : (
                <BarChart series={searchSeries} title="Searches per day" labels={dayLabels} />
              )}
              {(displayAiRange.length === 0 && (aiRange ?? aiRangeCache) === undefined) ? (
                <div className="rounded-lg border border-border bg-card p-4 animate-pulse h-[100px]" />
              ) : (
                <BarChart series={aiSeries} title="AI requests per day" labels={dayLabels} />
              )}
              {(displaySiteVisits.length === 0 && (siteVisits ?? siteVisitsCache) === undefined) ? (
                <div className="rounded-lg border border-border bg-card p-4 animate-pulse h-[100px]" />
              ) : (
                <BarChart series={visitSeries} title="Site visits per day" labels={dayLabels} />
              )}
              {(displayApiHits.length === 0 && (apiHits ?? apiHitsCache) === undefined) ? (
                <div className="rounded-lg border border-border bg-card p-4 animate-pulse h-[100px]" />
              ) : (
                <BarChart series={apiSeries} title="API hits per day" labels={dayLabels} />
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
