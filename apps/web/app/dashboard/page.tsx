"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCalls } from "@/lib/hooks/use-calls";
import { useDashboardSummary } from "@/lib/hooks/use-dashboard-summary";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function DashboardPage(): JSX.Element {
  const summaryQuery = useDashboardSummary();
  const callsQuery = useCalls();

  const summary = summaryQuery.data;
  const recentCalls = (callsQuery.data ?? []).slice(0, 5);

  const stats = [
    { label: "Total Calls", value: String(summary?.calls_total ?? 0), delta: "Live from API" },
    {
      label: "Appointments Booked",
      value: String(summary?.appointments_booked ?? 0),
      delta: "Live from API"
    },
    { label: "Leads Captured", value: String(summary?.leads_captured ?? 0), delta: "Live from API" },
    {
      label: "Avg Duration",
      value: formatDuration(summary?.avg_duration_seconds ?? 0),
      delta: "Live from API"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Dashboard</h1>
        <p className="text-sm text-textSecondary">Live operational snapshot of your AI call center.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-textSecondary">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{item.value}</p>
              <p className="mt-1 text-xs text-textSecondary">{item.delta} vs previous period</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaryQuery.isLoading || callsQuery.isLoading ? (
            <p className="text-sm text-textSecondary">Loading dashboard data...</p>
          ) : null}
          {summaryQuery.isError || callsQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">
              Could not load live data. Check backend auth/config and refresh.
            </p>
          ) : null}
          {!callsQuery.isLoading && recentCalls.length === 0 ? (
            <p className="text-sm text-textSecondary">No calls found yet.</p>
          ) : null}
          {recentCalls.map((call) => (
            <div
              key={call.id}
              className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-bgElevated/60 p-3 md:flex-row md:items-center"
            >
              <div>
                <p className="text-sm font-medium">{call.from_number}</p>
                <p className="text-xs text-textSecondary">
                  {call.agent_name} · {new Date(call.created_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-accentDim px-3 py-1 text-xs text-textPrimary">
                {call.outcome ?? call.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
