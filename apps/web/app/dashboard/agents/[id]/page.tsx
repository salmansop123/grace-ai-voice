"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAgent, useAssignNumber, useSaveAgentFlow, useUpdateAgent } from "@/lib/hooks/use-agents";

type Props = { params: { id: string } };

export default function AgentBuilderPage({ params }: Props): JSX.Element {
  const agentQuery = useAgent(params.id);
  const updateAgentMutation = useUpdateAgent();
  const assignNumberMutation = useAssignNumber();
  const saveFlowMutation = useSaveAgentFlow();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [llmModel, setLlmModel] = useState("gpt-4o");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [flowJson, setFlowJson] = useState("{}");

  useEffect(() => {
    if (!agentQuery.data) {
      return;
    }
    setName(agentQuery.data.name);
    setVoiceId(agentQuery.data.voice_id);
    setLanguage(agentQuery.data.language);
    setLlmModel(agentQuery.data.llm_model);
    setSystemPrompt(agentQuery.data.system_prompt);
    setPhoneNumber(agentQuery.data.phone_number ?? "");
    setFlowJson(JSON.stringify(agentQuery.data.call_flow ?? {}, null, 2));
  }, [agentQuery.data]);

  const canSave = name.trim().length > 0 && systemPrompt.trim().length >= 20;

  async function handleSave(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    try {
      await updateAgentMutation.mutateAsync({
        id: params.id,
        name: name.trim(),
        voice_id: voiceId.trim(),
        language: language.trim(),
        llm_model: llmModel.trim(),
        system_prompt: systemPrompt.trim()
      });
      showToast("Agent updated", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save agent"), "error");
    }
  }

  async function handleAssignNumber(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!phoneNumber.trim()) {
      return;
    }
    try {
      await assignNumberMutation.mutateAsync({
        id: params.id,
        phone_number: phoneNumber.trim()
      });
      showToast("Number assigned", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to assign number"), "error");
    }
  }

  async function handleToggleActive(): Promise<void> {
    if (!agentQuery.data) {
      return;
    }
    try {
      await updateAgentMutation.mutateAsync({
        id: params.id,
        is_active: !agentQuery.data.is_active
      });
      showToast("Agent status updated", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to change status"), "error");
    }
  }

  async function handleSaveFlow(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const parsed = JSON.parse(flowJson) as Record<string, unknown>;
      await saveFlowMutation.mutateAsync({
        id: params.id,
        flow: parsed
      });
      showToast("Flow saved", "success");
    } catch (error) {
      if (error instanceof SyntaxError) {
        showToast("Invalid JSON. Please fix flow JSON format.", "error");
      } else {
        showToast(getApiErrorMessage(error, "Failed to save flow"), "error");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-textPrimary">Agent Builder</h1>
          <p className="text-sm text-textSecondary">Configure voice behavior and deployment details.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/agents">Back to Agents</Link>
        </Button>
      </div>

      {agentQuery.isLoading ? <p className="text-sm text-textSecondary">Loading agent...</p> : null}
      {agentQuery.isError ? (
        <p className="text-sm text-[color:var(--danger)]">Could not load this agent. Check API/auth and retry.</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Core Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSave}>
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
            <input
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="Language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            />
            <input
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="LLM model"
              value={llmModel}
              onChange={(event) => setLlmModel(event.target.value)}
            />
            <textarea
              className="min-h-32 rounded-md border border-border bg-bgBase px-3 py-2 text-sm md:col-span-2"
              placeholder="System prompt (min 20 chars)"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" disabled={!canSave || updateAgentMutation.isPending}>
                {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleToggleActive()}>
                {agentQuery.data?.is_active ? "Set Inactive" : "Set Active"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phone Number</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleAssignNumber}>
            <input
              className="w-full rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="E.164 phone number, e.g. +15551234567"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
            <Button type="submit" disabled={assignNumberMutation.isPending || phoneNumber.trim().length === 0}>
              {assignNumberMutation.isPending ? "Assigning..." : "Assign Number"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call Flow JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSaveFlow}>
            <textarea
              className="min-h-48 w-full rounded-md border border-border bg-bgBase px-3 py-2 font-mono text-xs"
              value={flowJson}
              onChange={(event) => setFlowJson(event.target.value)}
            />
            <Button type="submit" disabled={saveFlowMutation.isPending}>
              {saveFlowMutation.isPending ? "Saving Flow..." : "Save Flow"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
