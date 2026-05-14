"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallDetail } from "@/lib/hooks/use-call-detail";

type Props = { params: { id: string } };

export default function CallDetailPage({ params }: Props): JSX.Element {
  const callQuery = useCallDetail(params.id);
  const call = callQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-textPrimary">Call Detail</h1>
          <p className="text-sm text-textSecondary">Transcript, AI summary, sentiment and recording.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/calls">Back to Calls</Link>
        </Button>
      </div>

      {callQuery.isLoading ? <p className="text-sm text-textSecondary">Loading call...</p> : null}
      {callQuery.isError ? (
        <p className="text-sm text-[color:var(--danger)]">Failed to load call details.</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Post-call Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-textSecondary">Sentiment:</span>{" "}
            <span className="rounded bg-accentDim px-2 py-1 text-xs">{call?.sentiment ?? "n/a"}</span>
          </p>
          <p>
            <span className="text-textSecondary">Outcome:</span>{" "}
            <span className="rounded bg-accentDim px-2 py-1 text-xs">{call?.outcome ?? "n/a"}</span>
          </p>
          <p>
            <span className="text-textSecondary">Summary:</span> {call?.summary ?? "No summary available."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recording</CardTitle>
        </CardHeader>
        <CardContent>
          {call?.recording_url ? (
            <audio controls src={call.recording_url} className="w-full" />
          ) : (
            <p className="text-sm text-textSecondary">Recording not available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(call?.transcript ?? [])
            .filter((m) => m.role !== "system")
            .map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-md border p-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto border-accent bg-accentDim text-textPrimary"
                    : "mr-auto border-border bg-bgElevated text-textPrimary"
                }`}
              >
                <p className="mb-1 text-xs uppercase text-textSecondary">{message.role}</p>
                <p>{message.content}</p>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
