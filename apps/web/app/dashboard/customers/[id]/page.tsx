"use client";

import { Mail, MessageSquare, Phone, PhoneCall, UserCircle2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAgents } from "@/lib/hooks/use-agents";
import { useCustomerDetail, useCustomerTimeline, useUpdateCustomer } from "@/lib/hooks/use-customers";

export default function CustomerDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const customerId = params.id ?? "";
  const { showToast } = useToast();
  const customerQuery = useCustomerDetail(customerId);
  const timelineQuery = useCustomerTimeline(customerId);
  const agentsQuery = useAgents();
  const updateMutation = useUpdateCustomer();
  const customer = customerQuery.data;
  const timeline = timelineQuery.data ?? [];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");

  const defaultAgent = useMemo(
    () => (agentsQuery.data ?? []).find((a) => a.is_active) ?? (agentsQuery.data ?? [])[0],
    [agentsQuery.data]
  );

  const stats = useMemo(() => {
    const calls = timeline.filter((item) => item.type === "call");
    const inbox = timeline.filter((item) => item.type === "inbox" || item.type === "sms");
    const sentiments = calls
      .map((item) => (item.type === "call" ? item.sentiment : null))
      .filter(Boolean) as string[];
    return {
      totalCalls: calls.length,
      avgSentiment: sentiments.length > 0 ? sentiments[Math.floor(sentiments.length / 2)] : "n/a",
      lastContacted: timeline[0]?.created_at ?? null,
      totalMessages: inbox.length,
    };
  }, [timeline]);

  async function handleCallNow(): Promise<void> {
    if (!customer?.phone || !defaultAgent?.id) {
      showToast("Missing customer phone or active agent", "error");
      return;
    }
    try {
      await publicApi.post("/api/calls/outbound", { to: customer.phone, agent_id: defaultAgent.id });
      showToast("Outbound call started", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to start outbound call"), "error");
    }
  }

  async function handleSave(): Promise<void> {
    if (!customer) return;
    try {
      await updateMutation.mutateAsync({
        id: customer.id,
        name: name || customer.name,
        phone: phone || customer.phone,
        email: email || customer.email || undefined,
        notes: notes || customer.notes || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : customer.tags,
      });
      showToast("Customer updated", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to update customer"), "error");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-accentDim p-3">
              <UserCircle2 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{customer?.name ?? "Customer"}</h1>
              <p className="text-sm text-textSecondary">{customer?.phone ?? "--"} · {customer?.email ?? "--"}</p>
              <p className="text-xs text-textSecondary">Tags: {(customer?.tags ?? []).join(", ") || "--"}</p>
            </div>
          </div>
          <Button onClick={() => void handleCallNow()}>
            <PhoneCall className="mr-2" size={16} /> Call Now
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-textSecondary">Total Calls</p><p className="text-2xl font-semibold">{stats.totalCalls}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-textSecondary">Avg Sentiment</p><p className="text-2xl font-semibold capitalize">{stats.avgSentiment}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-textSecondary">Last Contacted</p><p className="text-sm font-semibold">{stats.lastContacted ? new Date(stats.lastContacted).toLocaleString() : "--"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-textSecondary">Total Messages</p><p className="text-2xl font-semibold">{stats.totalMessages}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {timeline.map((item) => (
              <div key={`${item.type}-${item.id}-${item.created_at}`} className="rounded-md border border-border bg-bgElevated p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-textSecondary">
                  {item.type === "call" ? <Phone size={14} /> : null}
                  {item.type === "inbox" ? <Mail size={14} /> : null}
                  {item.type === "sms" ? <MessageSquare size={14} /> : null}
                  <span className="uppercase">{item.type}</span>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                {item.type === "call" ? (
                  <div className="text-sm">
                    <p>Direction: {item.direction} · Duration: {item.duration ?? "--"}s</p>
                    <p>Outcome: {item.outcome ?? "n/a"} · Sentiment: {item.sentiment ?? "n/a"}</p>
                    {item.summary ? <p className="mt-1 text-textSecondary">{item.summary}</p> : null}
                  </div>
                ) : null}
                {item.type === "inbox" ? (
                  <div className="text-sm">
                    <p>{item.subject ?? item.preview}</p>
                    <p className="text-textSecondary">{item.body}</p>
                  </div>
                ) : null}
                {item.type === "job" ? <p className="text-sm">{item.campaign_name} · {item.status}</p> : null}
                {item.type === "sms" ? <p className="text-sm">{item.message}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Edit Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <input className="w-full rounded border border-border bg-bgBase px-3 py-2 text-sm" placeholder={customer?.name ?? "Name"} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full rounded border border-border bg-bgBase px-3 py-2 text-sm" placeholder={customer?.phone ?? "Phone"} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="w-full rounded border border-border bg-bgBase px-3 py-2 text-sm" placeholder={customer?.email ?? "Email"} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full rounded border border-border bg-bgBase px-3 py-2 text-sm" placeholder={(customer?.tags ?? []).join(", ") || "tag1, tag2"} value={tags} onChange={(e) => setTags(e.target.value)} />
            <textarea className="min-h-20 w-full rounded border border-border bg-bgBase px-3 py-2 text-sm" placeholder={customer?.notes ?? "Notes"} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
