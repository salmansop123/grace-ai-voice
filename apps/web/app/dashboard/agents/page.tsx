"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  useAgents,
  useAssignNumber,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent
} from "@/lib/hooks/use-agents";

export default function AgentsPage(): JSX.Element {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState("Rachel");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful and concise voice assistant for inbound business calls."
  );
  const agentsQuery = useAgents();
  const createAgentMutation = useCreateAgent();
  const updateAgentMutation = useUpdateAgent();
  const assignNumberMutation = useAssignNumber();
  const deleteAgentMutation = useDeleteAgent();
  const { showToast } = useToast();
  const agents = agentsQuery.data ?? [];

  const canSubmit = name.trim().length > 0 && systemPrompt.trim().length >= 20;

  async function handleCreateAgent(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    try {
      await createAgentMutation.mutateAsync({
        name: name.trim(),
        voice_id: voiceId.trim(),
        system_prompt: systemPrompt.trim(),
        language: "en-US",
        llm_model: "gpt-4o"
      });
      showToast("Agent created", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Could not create agent"), "error");
      return;
    }
    setName("");
    setVoiceId("Rachel");
    setSystemPrompt("You are a helpful and concise voice assistant for inbound business calls.");
    setShowCreateForm(false);
  }

  async function handleToggleActive(id: string, isActive: boolean): Promise<void> {
    try {
      await updateAgentMutation.mutateAsync({
        id,
        is_active: !isActive
      });
      showToast("Agent status updated", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Could not update agent status"), "error");
    }
  }

  async function handleAssignNumber(id: string): Promise<void> {
    const value = window.prompt("Enter phone number in E.164 format (e.g., +15551234567)");
    if (!value) {
      return;
    }
    try {
      await assignNumberMutation.mutateAsync({
        id,
        phone_number: value.trim()
      });
      showToast("Number assigned to agent", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Could not assign number"), "error");
    }
  }

  async function handleDeleteAgent(id: string): Promise<void> {
    const confirmed = window.confirm("Delete this agent? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    try {
      await deleteAgentMutation.mutateAsync(id);
      showToast("Agent deleted", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Could not delete agent"), "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-textPrimary">Agents</h1>
          <p className="text-sm text-textSecondary">Manage your deployed voice agents.</p>
        </div>
        <Button onClick={() => setShowCreateForm((prev) => !prev)}>
          {showCreateForm ? "Close" : "Create Agent"}
        </Button>
      </div>

      {showCreateForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Create New Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAgent}>
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
                placeholder="Agent name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
                placeholder="Voice ID"
                value={voiceId}
                onChange={(event) => setVoiceId(event.target.value)}
              />
              <textarea
                className="min-h-24 rounded-md border border-border bg-bgBase px-3 py-2 text-sm md:col-span-2"
                placeholder="System prompt (min 20 chars)"
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.target.value)}
              />
              <div className="md:col-span-2">
                <Button type="submit" disabled={!canSubmit || createAgentMutation.isPending}>
                  {createAgentMutation.isPending ? "Creating..." : "Save Agent"}
                </Button>
              </div>
            </form>
            {createAgentMutation.isError ? (
              <p className="mt-2 text-sm text-[color:var(--danger)]">
                Could not create agent. Check backend and try again.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {agentsQuery.isLoading ? <p className="text-sm text-textSecondary">Loading agents...</p> : null}
      {agentsQuery.isError ? (
        <p className="text-sm text-[color:var(--danger)]">
          Failed to load agents. Check API auth/config and try again.
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>{agent.name}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${agent.is_active ? "bg-[color:var(--success)]/20 text-[color:var(--success)]" : "bg-[color:var(--danger)]/20 text-[color:var(--danger)]"}`}
                >
                  {agent.is_active ? "active" : "inactive"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-textSecondary">
              <p>Phone: {agent.phone_number ?? "Unassigned"}</p>
              <p>Voice: {agent.voice_id}</p>
              <p>Language: {agent.language}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href={`/dashboard/agents/${agent.id}`}>Open Builder</Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleToggleActive(agent.id, agent.is_active)}
                >
                  {agent.is_active ? "Set Inactive" : "Set Active"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => void handleAssignNumber(agent.id)}>
                  Assign Number
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleDeleteAgent(agent.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
