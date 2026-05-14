"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCalls } from "@/lib/hooks/use-calls";

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "--";
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function CallsPage(): JSX.Element {
  const [direction, setDirection] = useState("");
  const [outcome, setOutcome] = useState("");
  const [status, setStatus] = useState("");

  const filters = useMemo(
    () => ({
      direction,
      outcome,
      status
    }),
    [direction, outcome, status]
  );

  const callsQuery = useCalls(filters);
  const rows = callsQuery.data ?? [];
  const connectedCount = rows.filter((row) => row.connected).length;
  const conversationCount = rows.filter((row) => row.had_conversation).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Call History</h1>
        <p className="text-sm text-textSecondary">Recent calls with outcomes and durations.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customers Picked Up</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{connectedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Had Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{conversationCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Calls</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="mb-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
            >
              <option value="">All directions</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            >
              <option value="">All outcomes</option>
              <option value="booked">Booked</option>
              <option value="lead">Lead</option>
              <option value="completed">Completed</option>
              <option value="transferred">Transferred</option>
              <option value="no-answer">No answer</option>
            </select>
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="initiated">Initiated</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <button
              type="button"
              className="rounded-md border border-border bg-bgElevated px-3 py-2 text-sm"
              onClick={() => {
                setDirection("");
                setOutcome("");
                setStatus("");
              }}
            >
              Clear filters
            </button>
          </div>
          {callsQuery.isLoading ? <p className="mb-3 text-sm text-textSecondary">Loading call history...</p> : null}
          {callsQuery.isError ? (
            <p className="mb-3 text-sm text-[color:var(--danger)]">
              Failed to load calls. Check API auth/config and retry.
            </p>
          ) : null}
          <div className="-mx-1 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-textSecondary">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">From</th>
                <th className="py-2 font-medium">Agent</th>
                <th className="py-2 font-medium">Direction</th>
                <th className="py-2 font-medium">Duration</th>
                <th className="py-2 font-medium">Outcome</th>
                <th className="py-2 font-medium">Picked Up</th>
                <th className="py-2 font-medium">Conversation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-3">
                    <Link className="text-accent hover:underline" href={`/dashboard/calls/${row.id}`}>
                      {row.from_number}
                    </Link>
                  </td>
                  <td className="py-3">{row.agent_name}</td>
                  <td className="py-3">{row.direction}</td>
                  <td className="py-3">{formatDuration(row.duration)}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-accentDim px-2 py-1 text-xs">
                      {row.outcome ?? row.status}
                    </span>
                  </td>
                  <td className="py-3">{row.connected ? "Yes" : "No"}</td>
                  <td className="py-3">{row.had_conversation ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
