"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicApi } from "@/lib/api";
import { useLiveOverview } from "@/lib/hooks/use-live-overview";

type LiveMessage = {
  call_sid: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

type ChannelEvent = {
  channel: "email" | "sms";
  preview: string;
  timestamp: string;
};

export default function LiveCallsPage(): JSX.Element {
  const [events, setEvents] = useState<LiveMessage[]>([]);
  const [channel, setChannel] = useState<"calls" | "email" | "sms">("calls");
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "error">("connecting");
  const [emailEvents, setEmailEvents] = useState<ChannelEvent[]>([]);
  const [smsEvents, setSmsEvents] = useState<ChannelEvent[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastInboxIdRef = useRef<string | null>(null);
  const liveOverviewQuery = useLiveOverview();
  const overview = liveOverviewQuery.data?.channels;

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
              setEmailEvents((prev) => [
                { channel: "email" as const, preview: row.preview, timestamp: row.timestamp },
                ...prev,
              ].slice(0, 5));
            }
            if (row.channel === "text" || row.channel === "sms") {
              setSmsEvents((prev) => [
                { channel: "sms" as const, preview: row.preview, timestamp: row.timestamp },
                ...prev,
              ].slice(0, 5));
            }
          }
        } catch {
          // no-op fallback
        }
      }, 10000);
    };

    const connect = () => {
      if (stopped) {
        return;
      }
      setConnectionState("connecting");
      setIsReconnecting(true);
      source = new EventSource(streamUrl);
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as
            | LiveMessage
            | { event: string; active_calls?: string[] };
          if ((payload as { event?: string }).event === "snapshot") {
            setConnectionState("connected");
            setIsReconnecting(false);
            retryMs = 5000;
            return;
          }
          if ((payload as { event?: string }).event === "heartbeat") {
            setConnectionState("connected");
            setIsReconnecting(false);
            return;
          }
          const channelPayload = payload as { channel?: string; subject_or_preview?: string; message_preview?: string; timestamp?: string };
          if (channelPayload.channel === "email") {
            setEmailEvents((prev) => [
              {
                channel: "email" as const,
                preview: channelPayload.subject_or_preview ?? "",
                timestamp: channelPayload.timestamp ?? new Date().toISOString(),
              },
              ...prev,
            ].slice(0, 5));
            setConnectionState("connected");
            setIsReconnecting(false);
            return;
          }
          if (channelPayload.channel === "sms") {
            setSmsEvents((prev) => [
              {
                channel: "sms" as const,
                preview: channelPayload.message_preview ?? channelPayload.subject_or_preview ?? "",
                timestamp: channelPayload.timestamp ?? new Date().toISOString(),
              },
              ...prev,
            ].slice(0, 5));
            setConnectionState("connected");
            setIsReconnecting(false);
            return;
          }
          setEvents((prev) => [...prev.slice(-99), payload as LiveMessage]);
          setConnectionState("connected");
          setIsReconnecting(false);
        } catch {
          setConnectionState("error");
        }
      };
      source.onerror = () => {
        setConnectionState("error");
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
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
      }
    };
  }, []);

  const groupedByCall = useMemo(() => {
    const groups = new Map<string, LiveMessage[]>();
    for (const item of events) {
      const list = groups.get(item.call_sid) ?? [];
      list.push(item);
      groups.set(item.call_sid, list);
    }
    return Array.from(groups.entries()).reverse();
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Live Calls Monitor</h1>
        <p className="text-sm text-textSecondary">
          Real-time communication monitoring across Calls, Email and SMS.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-textSecondary">Customers: {overview?.calls.customers ?? 0}</p>
            <p className="text-2xl font-semibold text-textPrimary">{overview?.calls.communications ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-textSecondary">Customers: {overview?.email.customers ?? 0}</p>
            <p className="text-2xl font-semibold text-textPrimary">{overview?.email.communications ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SMS</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-textSecondary">Customers: {overview?.sms.customers ?? 0}</p>
            <p className="text-2xl font-semibold text-textPrimary">{overview?.sms.communications ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="rounded-full bg-accentDim px-2 py-1 text-xs text-textPrimary">{connectionState}</span>
          {isReconnecting ? <span className="ml-2 text-xs text-textSecondary">reconnecting...</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-sm ${channel === "calls" ? "bg-accent text-black" : "bg-bgElevated"}`}
              onClick={() => setChannel("calls")}
            >
              Calls
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-sm ${channel === "email" ? "bg-accent text-black" : "bg-bgElevated"}`}
              onClick={() => setChannel("email")}
            >
              Email
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-sm ${channel === "sms" ? "bg-accent text-black" : "bg-bgElevated"}`}
              onClick={() => setChannel("sms")}
            >
              SMS
            </button>
          </div>
          <div className="rounded-md border border-border bg-bgElevated p-3 text-sm">
            <p className="font-medium capitalize">{channel} Overview</p>
            {channel === "calls" ? (
              <p className="text-textSecondary">
                Communicating with {overview?.calls.customers ?? 0} customers over {overview?.calls.communications ?? 0} call records.
              </p>
            ) : null}
            {channel === "email" ? (
              <p className="text-textSecondary">
                Communicating with {overview?.email.customers ?? 0} customers over {overview?.email.communications ?? 0} emails.
              </p>
            ) : null}
            {channel === "sms" ? (
              <p className="text-textSecondary">
                Communicating with {overview?.sms.customers ?? 0} customers over {overview?.sms.communications ?? 0} SMS messages.
              </p>
            ) : null}
          </div>
          {liveOverviewQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">
              Failed to load live channel stats.
            </p>
          ) : null}
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Active Conversations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {groupedByCall.length === 0 ? (
            <p className="text-sm text-textSecondary">Waiting for live call events...</p>
          ) : null}
          {groupedByCall.map(([callSid, messages]) => (
            <div key={callSid} className="rounded-md border border-border bg-bgElevated p-3">
              <p className="mb-2 text-xs font-medium text-textSecondary">Call SID: {callSid}</p>
              <div className="space-y-2">
                {messages.slice(-8).map((message, index) => (
                  <div key={`${message.timestamp}-${index}`} className="text-sm">
                    <span className="mr-2 rounded bg-accentDim px-1.5 py-0.5 text-xs">{message.role}</span>
                    <span>{message.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
