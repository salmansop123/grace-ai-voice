"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicApi } from "@/lib/api";
import { useCalls } from "@/lib/hooks/use-calls";
import { type JobsChannel, useJobsOverview, useJobsTotals } from "@/lib/hooks/use-jobs";
import { useLiveOverview } from "@/lib/hooks/use-live-overview";
import { useOpsOverview } from "@/lib/hooks/use-ops-overview";

type ChannelEvent = {
  channel: "email" | "sms";
  preview: string;
  timestamp: string;
};

export default function JobsPage(): JSX.Element {
  const [channel, setChannel] = useState<JobsChannel>("all");
  const [direction, setDirection] = useState("");
  const [outcome, setOutcome] = useState("");
  const [status, setStatus] = useState("");
  const [liveConnectionState, setLiveConnectionState] = useState<"connecting" | "connected" | "error">("connecting");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [emailEvents, setEmailEvents] = useState<ChannelEvent[]>([]);
  const [smsEvents, setSmsEvents] = useState<ChannelEvent[]>([]);
  const lastInboxIdRef = useRef<string | null>(null);

  const overviewQuery = useJobsOverview(channel);
  const totalsQuery = useJobsTotals();
  const opsQuery = useOpsOverview();
  const liveOverviewQuery = useLiveOverview();
  const callsQuery = useCalls({ direction, outcome, status });
  const rows = overviewQuery.data ?? [];
  const totals = totalsQuery.data;
  const ops = opsQuery.data;
  const live = liveOverviewQuery.data?.channels;
  const callRows = callsQuery.data ?? [];
  const connectedCount = callRows.filter((row) => row.connected).length;
  const conversationCount = callRows.filter((row) => row.had_conversation).length;

  const headerLabel = useMemo(() => {
    if (channel === "calls") return "Calls";
    if (channel === "email") return "Emails";
    if (channel === "sms") return "SMS";
    return "Total Activity";
  }, [channel]);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const streamUrl = `${baseUrl}/api/live/stream`;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let retryMs = 5000;

    const startFallbackPolling = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(async () => {
        try {
          const response = await publicApi.get<Array<{ id: string; channel: string; preview: string; timestamp: string }>>(
            "/api/inbox/recent",
            { params: { limit: 5, since: lastInboxIdRef.current ?? undefined } }
          );
          const rows = response.data ?? [];
          if (rows.length > 0) {
            lastInboxIdRef.current = rows[0].id;
          }
          for (const row of rows) {
            if (row.channel === "email") {
              setEmailEvents((prev) =>
                [
                  { channel: "email" as const, preview: row.preview, timestamp: row.timestamp },
                  ...prev,
                ].slice(0, 5)
              );
            }
            if (row.channel === "text" || row.channel === "sms") {
              setSmsEvents((prev) =>
                [
                  { channel: "sms" as const, preview: row.preview, timestamp: row.timestamp },
                  ...prev,
                ].slice(0, 5)
              );
            }
          }
        } catch {
          // polling fallback intentionally silent
        }
      }, 10000);
    };

    const connect = () => {
      if (stopped) return;
      setLiveConnectionState("connecting");
      setIsReconnecting(true);
      source = new EventSource(streamUrl);
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as
            | { event: string; active_calls?: string[] }
            | { channel?: string; subject_or_preview?: string; message_preview?: string; timestamp?: string };
          if ((payload as { event?: string }).event === "snapshot" || (payload as { event?: string }).event === "heartbeat") {
            setLiveConnectionState("connected");
            setIsReconnecting(false);
            retryMs = 5000;
            return;
          }
          const channelPayload = payload as { channel?: string; subject_or_preview?: string; message_preview?: string; timestamp?: string };
          if (channelPayload.channel === "email") {
            setEmailEvents((prev) =>
              [
                {
                  channel: "email" as const,
                  preview: channelPayload.subject_or_preview ?? "",
                  timestamp: channelPayload.timestamp ?? new Date().toISOString(),
                },
                ...prev,
              ].slice(0, 5)
            );
          }
          if (channelPayload.channel === "sms") {
            setSmsEvents((prev) =>
              [
                {
                  channel: "sms" as const,
                  preview: channelPayload.message_preview ?? channelPayload.subject_or_preview ?? "",
                  timestamp: channelPayload.timestamp ?? new Date().toISOString(),
                },
                ...prev,
              ].slice(0, 5)
            );
          }
          setLiveConnectionState("connected");
          setIsReconnecting(false);
        } catch {
          setLiveConnectionState("error");
        }
      };
      source.onerror = () => {
        setLiveConnectionState("error");
        source?.close();
        setIsReconnecting(true);
        startFallbackPolling();
        reconnectTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
      };
    };

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Jobs</h1>
        <p className="text-sm text-textSecondary">
          Agent activity across calls, email, and SMS.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Communications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-textSecondary">Customers: {live?.calls.customers ?? 0}</p>
                <p className="text-2xl font-semibold text-textPrimary">{live?.calls.communications ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-textSecondary">Customers: {live?.email.customers ?? 0}</p>
                <p className="text-2xl font-semibold text-textPrimary">{live?.email.communications ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live SMS</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-textSecondary">Customers: {live?.sms.customers ?? 0}</p>
                <p className="text-2xl font-semibold text-textPrimary">{live?.sms.communications ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border border-border bg-bgElevated px-3 py-2 text-sm">
            <span className="rounded-full bg-accentDim px-2 py-1 text-xs text-textPrimary">{liveConnectionState}</span>
            {isReconnecting ? <span className="ml-2 text-xs text-textSecondary">reconnecting...</span> : null}
          </div>

          {liveOverviewQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">Failed to load live stats.</p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Live Email Feed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {emailEvents.length === 0 ? <p className="text-sm text-textSecondary">No recent email events.</p> : null}
                {emailEvents.map((item, index) => (
                  <motion.div
                    key={`${item.timestamp}-${index}`}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="rounded-md border border-border bg-bgElevated p-2 text-sm"
                  >
                    <p>{item.preview}</p>
                    <p className="text-xs text-textSecondary">{new Date(item.timestamp).toLocaleTimeString()}</p>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Live SMS Feed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {smsEvents.length === 0 ? <p className="text-sm text-textSecondary">No recent SMS events.</p> : null}
                {smsEvents.map((item, index) => (
                  <motion.div
                    key={`${item.timestamp}-${index}`}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="rounded-md border border-border bg-bgElevated p-2 text-sm"
                  >
                    <p>{item.preview}</p>
                    <p className="text-xs text-textSecondary">{new Date(item.timestamp).toLocaleTimeString()}</p>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{totals?.calls ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{totals?.connected_calls ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{totals?.conversations ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emails Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{totals?.emails ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SMS Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-textPrimary">{totals?.sms ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Job Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <div className="grid gap-2 md:grid-cols-2">
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as JobsChannel)}
            >
              <option value="all">All channels</option>
              <option value="calls">Calls</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <button
              type="button"
              className="rounded-md border border-border bg-bgElevated px-3 py-2 text-sm"
              onClick={() => setChannel("all")}
            >
              Clear filters
            </button>
          </div>

          {overviewQuery.isLoading ? (
            <p className="text-sm text-textSecondary">Loading jobs...</p>
          ) : null}

          {overviewQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">
              Failed to load jobs activity.
            </p>
          ) : null}

          <div className="-mx-1 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-textSecondary">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Agent</th>
                <th className="py-2 font-medium">{headerLabel}</th>
                <th className="py-2 font-medium">Connected Calls</th>
                <th className="py-2 font-medium">Conversations</th>
                <th className="py-2 font-medium">Emails</th>
                <th className="py-2 font-medium">SMS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agent_id} className="border-b border-border/60">
                  <td className="py-3">{row.agent_name}</td>
                  <td className="py-3">{row.activity_count}</td>
                  <td className="py-3">{row.connected_calls}</td>
                  <td className="py-3">{row.conversations}</td>
                  <td className="py-3">{row.emails}</td>
                  <td className="py-3">{row.sms}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {channel === "calls" ? (
        <Card>
          <CardHeader>
            <CardTitle>Calls Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
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

            <div className="grid gap-2 md:grid-cols-4">
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
                Clear call filters
              </button>
            </div>

            {callsQuery.isLoading ? (
              <p className="text-sm text-textSecondary">Loading call activity...</p>
            ) : null}
            {callsQuery.isError ? (
              <p className="text-sm text-[color:var(--danger)]">Failed to load calls.</p>
            ) : null}

            <div className="-mx-1 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[920px] text-left text-sm">
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
                {callRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-3">
                      <Link className="text-accent hover:underline" href={`/dashboard/calls/${row.id}`}>
                        {row.from_number}
                      </Link>
                    </td>
                    <td className="py-3">{row.agent_name}</td>
                    <td className="py-3">{row.direction}</td>
                    <td className="py-3">
                      {row.duration === null
                        ? "--"
                        : `${String(Math.floor(row.duration / 60)).padStart(2, "0")}:${String(
                            row.duration % 60
                          ).padStart(2, "0")}`}
                    </td>
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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Operations Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Queued Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{ops?.calls.queued ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Failed Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{ops?.calls.failed ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Running Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{ops?.campaigns.running ?? 0}</p>
              </CardContent>
            </Card>
          </div>
          {opsQuery.isLoading ? <p className="text-sm text-textSecondary">Loading operations snapshot...</p> : null}
          {opsQuery.isError ? <p className="text-sm text-[color:var(--danger)]">Unable to load operations metrics.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
