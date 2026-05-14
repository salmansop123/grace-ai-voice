"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  useInboxThread,
  useInboxThreads,
  useMarkInboxThreadRead,
  useSendInboxMessage,
} from "@/lib/hooks/use-inbox";

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export default function InboxPage(): JSX.Element {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"all" | "call" | "email" | "text">("all");
  const [status, setStatus] = useState<"all" | "read" | "unread">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [detailChannelFilter, setDetailChannelFilter] = useState<"all" | "call" | "email" | "text">("all");
  const [composerChannel, setComposerChannel] = useState<"email" | "text" | "call">("email");
  const [composerBody, setComposerBody] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const threadsQuery = useInboxThreads({
    q: search,
    channel,
    status,
    sort,
  });
  const threadQuery = useInboxThread(selectedThreadId);
  const markReadMutation = useMarkInboxThreadRead();
  const sendMessageMutation = useSendInboxMessage();

  const threads = threadsQuery.data ?? [];
  const selectedThread = threadQuery.data;

  useEffect(() => {
    const fromUrl = searchParams.get("thread");
    if (fromUrl) {
      setSelectedThreadId(fromUrl);
      return;
    }
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [searchParams, selectedThreadId, threads]);

  useEffect(() => {
    if (selectedThreadId && selectedThread?.unread_count && selectedThread.unread_count > 0) {
      void markReadMutation.mutateAsync(selectedThreadId);
    }
  }, [markReadMutation, selectedThread?.unread_count, selectedThreadId]);

  const visibleMessages = useMemo(() => {
    const items = selectedThread?.messages ?? [];
    if (detailChannelFilter === "all") {
      return items;
    }
    return items.filter((message) => message.channel === detailChannelFilter);
  }, [detailChannelFilter, selectedThread?.messages]);

  async function handleSendMessage(): Promise<void> {
    if (!selectedThreadId || !composerBody.trim()) {
      return;
    }
    try {
      await sendMessageMutation.mutateAsync({
        threadId: selectedThreadId,
        body: composerBody.trim(),
        channel: composerChannel,
        senderRole: "agent_ai",
      });
      setComposerBody("");
      showToast("Reply sent", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to send reply"), "error");
    }
  }

  const selectedCounts = useMemo(() => {
    if (!selectedThread) {
      return { call: 0, email: 0, text: 0 };
    }
    return selectedThread.messages.reduce(
      (acc, message) => {
        if (message.channel in acc) {
          acc[message.channel as "call" | "email" | "text"] += 1;
        }
        return acc;
      },
      { call: 0, email: 0, text: 0 }
    );
  }, [selectedThread]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-bgSurface lg:h-[calc(100dvh-5.5rem)] lg:flex-row">
      <section className="flex max-h-[min(42vh,360px)] w-full shrink-0 flex-col border-b border-border bg-bgSurface lg:max-h-none lg:h-full lg:w-[min(100%,360px)] lg:border-b-0 lg:border-r">
        <div className="border-b border-border p-4">
          <h1 className="mb-3 text-2xl font-semibold text-textPrimary">Inbox</h1>
          <div className="mb-2 flex min-w-0 flex-wrap gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="Search customer by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button type="button" variant="outline" className="shrink-0">
              Filter
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | "read" | "unread")}
            >
              <option value="all">All messages</option>
              <option value="read">Read messages</option>
              <option value="unread">Unread messages</option>
            </select>
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value as "newest" | "oldest")}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
          <div className="mt-2">
            <select
              className="w-full rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as "all" | "call" | "email" | "text")}
            >
              <option value="all">All channels</option>
              <option value="call">Calls</option>
              <option value="email">Emails</option>
              <option value="text">Texts</option>
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:h-[calc(100%-178px)] lg:flex-none">
          {threadsQuery.isLoading ? <p className="p-4 text-sm text-textSecondary">Loading inbox...</p> : null}
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => {
                setSelectedThreadId(thread.id);
                router.replace(`/dashboard/inbox?thread=${thread.id}`);
              }}
              className={`w-full border-b border-border px-4 py-3 text-left hover:bg-accentDim ${
                selectedThreadId === thread.id ? "bg-accentDim" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-textPrimary">{thread.customer_name}</p>
                <p className="text-xs text-textSecondary">{formatRelativeTime(thread.last_message_at)}</p>
              </div>
              <div className="mb-1 flex gap-2 text-xs text-textSecondary">
                <span>Call {thread.counts.call}</span>
                <span>Email {thread.counts.email}</span>
                <span>Text {thread.counts.text}</span>
                {thread.unread_count > 0 ? (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-black">
                    {thread.unread_count}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-textSecondary">{thread.last_message_preview.slice(0, 110)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-bgBase lg:min-h-0">
        {!selectedThread ? (
          <div className="flex h-full items-center justify-center text-textSecondary">
            Select a customer conversation.
          </div>
        ) : (
          <div className="flex min-h-0 h-full flex-col">
            <div className="border-b border-border bg-bgSurface px-4 py-3">
              <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-textPrimary">{selectedThread.customer_name}</p>
                  <p className="text-xs text-textSecondary">
                    {selectedThread.customer_email || "--"} · {selectedThread.customer_phone || "--"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedThread.contact_id}
                    onClick={() => {
                      if (!selectedThread.contact_id) {
                        showToast("Customer details are not available for this thread", "error");
                        return;
                      }
                      router.push(`/dashboard/customers/${selectedThread.contact_id}`);
                    }}
                  >
                    View Customer
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-textSecondary">
                <span>Call {selectedCounts.call}</span>
                <span>Email {selectedCounts.email}</span>
                <span>Text {selectedCounts.text}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["all", "call", "email", "text"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={detailChannelFilter === value ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setDetailChannelFilter(value)}
                  >
                    {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {visibleMessages.map((message) => (
                  <Card
                    key={message.id}
                    className={`${
                      message.sender_role === "customer"
                        ? "mr-auto max-w-[80%] bg-bgElevated"
                        : "ml-auto max-w-[80%] bg-accentDim"
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase text-textSecondary">
                          {message.sender_role === "customer" ? "Customer" : "Grace AI"}
                        </p>
                        <p className="text-[11px] text-textSecondary">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-textSecondary">
                        {message.channel}
                      </p>
                      <p className="text-sm text-textPrimary whitespace-pre-wrap">{message.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="border-t border-border bg-bgSurface p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-border bg-bgBase px-2 py-1 text-xs"
                    value={composerChannel}
                    onChange={(event) =>
                      setComposerChannel(event.target.value as "email" | "text" | "call")
                    }
                  >
                    <option value="email">Email</option>
                    <option value="text">Text</option>
                    <option value="call">Call Note</option>
                  </select>
                </div>
              </div>
              <textarea
                className="mb-2 min-h-20 w-full rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
                placeholder="Write your message here..."
                value={composerBody}
                onChange={(event) => setComposerBody(event.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={sendMessageMutation.isPending || !composerBody.trim()}
                >
                  {sendMessageMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
