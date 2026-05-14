"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, MoreVertical, Phone, Upload, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { CLERK_ENABLED } from "@/lib/clerk-config";
import {
  useAddKbFromQuestion,
  useAddKnowledgeBaseQA,
  useAgents,
  useAssignNumber,
  useCreateAgent,
  useDeleteAgent,
  useUnansweredQuestions,
  useUpdateAgent,
} from "@/lib/hooks/use-agents";
import {
  useCreateKBDocument,
  useDeleteKBDocument,
  useKBDocuments,
  useUploadKBDocument,
} from "@/lib/hooks/use-knowledge-base";
import { useOrgRoleWithClerk } from "@/lib/hooks/use-org-role-clerk";
import { usePlanLimits } from "@/lib/hooks/use-plan-limits";
import {
  useAddCustomNumberCandidate,
  useBuyPhoneNumber,
  usePhoneNumbers,
  useRemoveCustomNumberCandidate,
  useRemovePhoneNumber,
  useUnassignPhoneNumber,
} from "@/lib/hooks/use-phone-numbers";

type AgentView = "training" | "memory" | "test";

const COUNTRY_DIAL_CODES: Array<{ name: string; code: string }> = [
  { name: "United States", code: "+1" },
  { name: "United Kingdom", code: "+44" },
  { name: "Pakistan", code: "+92" },
  { name: "India", code: "+91" },
  { name: "United Arab Emirates", code: "+971" },
  { name: "Saudi Arabia", code: "+966" },
  { name: "Canada", code: "+1" },
  { name: "Australia", code: "+61" },
  { name: "Germany", code: "+49" },
  { name: "France", code: "+33" },
];

function PillButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-accent text-white" : "bg-bgElevated text-textSecondary hover:bg-accentDim"
      }`}
    >
      {label}
    </button>
  );
}

function AgentExperiencePageInner({ isAdmin }: { isAdmin: boolean }): JSX.Element {
  const fieldClass =
    "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary";
  const textAreaClass =
    "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary";
  const [view, setView] = useState<AgentView>("training");
  const [asTextResponse, setAsTextResponse] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState("Rachel");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful and concise voice assistant for inbound business calls."
  );
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedPurchasedNumber, setSelectedPurchasedNumber] = useState("");
  const [assignTargetAgentId, setAssignTargetAgentId] = useState("");
  const [assignTargetNumber, setAssignTargetNumber] = useState("");
  const [customCountryCode, setCustomCountryCode] = useState("+1");
  const [customLocalNumber, setCustomLocalNumber] = useState("");
  const [kbFileName, setKbFileName] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const agentsQuery = useAgents();
  const createAgentMutation = useCreateAgent();
  const updateAgentMutation = useUpdateAgent();
  const assignNumberMutation = useAssignNumber();
  const deleteAgentMutation = useDeleteAgent();
  const numbersQuery = usePhoneNumbers();
  const buyMutation = useBuyPhoneNumber();
  const addCustomNumberMutation = useAddCustomNumberCandidate();
  const removeCustomNumberMutation = useRemoveCustomNumberCandidate();
  const removeNumberMutation = useRemovePhoneNumber();
  const unassignNumberMutation = useUnassignPhoneNumber();
  const kbDocsQuery = useKBDocuments(selectedAgentId);
  const createDocMutation = useCreateKBDocument();
  const uploadDocMutation = useUploadKBDocument();
  const deleteDocMutation = useDeleteKBDocument();
  const unansweredQuery = useUnansweredQuestions(selectedAgentId);
  const addKbFromQuestionMutation = useAddKbFromQuestion();
  const addKnowledgeBaseQAMutation = useAddKnowledgeBaseQA();
  const planLimits = usePlanLimits();
  const { showToast } = useToast();
  const agents = agentsQuery.data ?? [];
  const availableNumbers = numbersQuery.data?.available_numbers ?? [];
  const customAvailableNumbers = numbersQuery.data?.custom_available_numbers ?? [];
  const purchasedNumbers = numbersQuery.data?.purchased_numbers ?? [];
  const assignedNumbers = numbersQuery.data?.assigned ?? [];
  const kbDocs = kbDocsQuery.data ?? [];
  const unanswered = unansweredQuery.data ?? [];

  const activeAgent = useMemo(() => agents.find((item) => item.is_active) ?? agents[0], [agents]);
  const availablePurchasedForAssignment = useMemo(() => {
    const assignedSet = new Set(assignedNumbers.map((item) => item.phone_number));
    return purchasedNumbers.filter((number) => !assignedSet.has(number));
  }, [purchasedNumbers, assignedNumbers]);
  const assignedCountByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of assignedNumbers) {
      counts.set(item.agent_id, (counts.get(item.agent_id) ?? 0) + 1);
    }
    return counts;
  }, [assignedNumbers]);
  const assignedNumbersByAgent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of assignedNumbers) {
      const current = map.get(item.agent_id) ?? [];
      current.push(item.phone_number);
      map.set(item.agent_id, current);
    }
    return map;
  }, [assignedNumbers]);
  const canSubmit = name.trim().length > 0 && systemPrompt.trim().length >= 20;

  useEffect(() => {
    if (!selectedAgentId && activeAgent?.id) {
      setSelectedAgentId(activeAgent.id);
    }
  }, [activeAgent, selectedAgentId]);

  async function handleCreateAgent(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    if (!planLimits.canCreateAgent()) {
      setShowUpgradeModal(true);
      return;
    }
    try {
      await createAgentMutation.mutateAsync({
        name: name.trim(),
        voice_id: voiceId.trim(),
        system_prompt: systemPrompt.trim(),
        language: "en-US",
        llm_model: "gpt-4o",
      });
      showToast("Agent created", "success");
      setName("");
      setVoiceId("Rachel");
      setSystemPrompt("You are a helpful and concise voice assistant for inbound business calls.");
      setShowCreateForm(false);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Could not create agent"), "error");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean): Promise<void> {
    try {
      await updateAgentMutation.mutateAsync({
        id,
        is_active: !isActive,
      });
      showToast("Agent status updated", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Could not update agent status"), "error");
    }
  }

  function handleOpenAssignForAgent(agentId: string): void {
    if (availablePurchasedForAssignment.length === 0) {
      showToast("Please purchase the number first", "error");
      return;
    }
    setAssignTargetAgentId(agentId);
    setAssignTargetNumber((prev) => prev || availablePurchasedForAssignment[0] || "");
  }

  async function handleAssignToTargetAgent(): Promise<void> {
    if (!assignTargetAgentId || !assignTargetNumber) {
      return;
    }
    try {
      await assignNumberMutation.mutateAsync({
        id: assignTargetAgentId,
        phone_number: assignTargetNumber,
      });
      showToast("Number assigned to agent", "success");
      setAssignTargetAgentId("");
      setAssignTargetNumber("");
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

  async function handleAssignPurchasedNumber(): Promise<void> {
    if (!selectedAgentId || !selectedPurchasedNumber) {
      return;
    }
    try {
      await assignNumberMutation.mutateAsync({
        id: selectedAgentId,
        phone_number: selectedPurchasedNumber,
      });
      showToast("Number assigned to agent", "success");
      setSelectedPurchasedNumber("");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to assign number"), "error");
    }
  }

  async function handleCreateDoc(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedAgentId || !kbFileName.trim() || !kbContent.trim()) {
      return;
    }
    if (!planLimits.canUploadKBDoc()) {
      setShowUpgradeModal(true);
      return;
    }
    try {
      await addKnowledgeBaseQAMutation.mutateAsync({
        agent_id: selectedAgentId,
        question: kbFileName.trim(),
        answer: kbContent.trim(),
        source: "manual",
      });
      await createDocMutation.mutateAsync({
        agent_id: selectedAgentId,
        file_name: kbFileName.trim(),
        content: kbContent.trim(),
      });
      setKbFileName("");
      setKbContent("");
      showToast("Memory document saved", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save memory"), "error");
    }
  }

  async function handleUploadDoc(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedAgentId || !uploadFile) {
      return;
    }
    if (!planLimits.canUploadKBDoc()) {
      setShowUpgradeModal(true);
      return;
    }
    try {
      await uploadDocMutation.mutateAsync({ agent_id: selectedAgentId, file: uploadFile });
      setUploadFile(null);
      showToast("Knowledge file uploaded", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to upload file"), "error");
    }
  }

  return (
    <div className="space-y-5">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-textPrimary">Agent</h1>
          <p className="text-sm text-textSecondary">
            Train how your AI receptionist speaks, responds and books.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PillButton active={view === "training"} label="Training" onClick={() => setView("training")} />
          <PillButton active={view === "memory"} label="Memory Training" onClick={() => setView("memory")} />
          <PillButton active={view === "test"} label="Test Grace" onClick={() => setView("test")} />
        </div>
      </div>

      {view === "training" ? (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-bgSurface p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-textPrimary">Manage Agents</h3>
                <p className="text-sm text-textSecondary">
                  Create and control agents in one place.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowCreateForm((prev) => !prev)}>
                {showCreateForm ? "Close" : "Create Agent"}
              </Button>
            </div>
            <div className="mb-4 md:max-w-sm">
              <label className="mb-1 block text-xs text-textSecondary">Active Agent Workspace</label>
              <select
                className={fieldClass}
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
              >
                <option value="">Select agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            {showCreateForm ? (
              <form className="mb-4 grid gap-2 rounded-xl border border-border bg-bgBase p-3 md:grid-cols-2" onSubmit={handleCreateAgent}>
                <input
                  className={fieldClass}
                  placeholder="Agent name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <input
                  className={fieldClass}
                  placeholder="Voice ID"
                  value={voiceId}
                  onChange={(event) => setVoiceId(event.target.value)}
                />
                <textarea
                  className={`min-h-20 md:col-span-2 ${textAreaClass}`}
                  placeholder="System prompt (min 20 chars)"
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                />
                <div className="md:col-span-2">
                  <Button type="submit" size="sm" disabled={!canSubmit || createAgentMutation.isPending}>
                    {createAgentMutation.isPending ? "Creating..." : "Save Agent"}
                  </Button>
                  {!planLimits.canCreateAgent() ? (
                    <p className="mt-2 text-xs text-[color:var(--danger)]">
                      Agent limit reached. Upgrade to add more agents.
                    </p>
                  ) : null}
                </div>
              </form>
            ) : null}

            {agentsQuery.isLoading ? <p className="text-sm text-textSecondary">Loading agents...</p> : null}
            {agentsQuery.isError ? (
              <p className="text-sm text-[color:var(--danger)]">Failed to load agents.</p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-xl border border-border bg-bgBase p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-textPrimary">{agent.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        agent.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {agent.is_active ? "active" : "inactive"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-textSecondary">
                    <p>Phone: {agent.phone_number ?? "Unassigned"}</p>
                    <p>Voice: {agent.voice_id}</p>
                    <p>Language: {agent.language}</p>
                    <p>Assigned numbers: {assignedCountByAgent.get(agent.id) ?? 0}</p>
                    <p>
                      Numbers:{" "}
                      {(assignedNumbersByAgent.get(agent.id) ?? [agent.phone_number].filter(Boolean)).join(", ") ||
                        "None"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/agents/${agent.id}`}>Open Builder</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleToggleActive(agent.id, agent.is_active)}
                    >
                      {agent.is_active ? "Set Inactive" : "Set Active"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAssignForAgent(agent.id)}
                    >
                      Assign Number
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!isAdmin}
                      title={!isAdmin ? "Admin only" : undefined}
                      onClick={() => void handleDeleteAgent(agent.id)}
                    >
                      Delete
                    </Button>
                  </div>
                  {assignTargetAgentId === agent.id ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <select
                        className={fieldClass}
                        value={assignTargetNumber}
                        onChange={(event) => setAssignTargetNumber(event.target.value)}
                      >
                        {availablePurchasedForAssignment.map((number) => (
                          <option key={`agent-assign-${agent.id}-${number}`} value={number}>
                            {number}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => void handleAssignToTargetAgent()}
                        disabled={assignNumberMutation.isPending || !assignTargetNumber}
                      >
                        {assignNumberMutation.isPending ? "Assigning..." : "Assign"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssignTargetAgentId("");
                          setAssignTargetNumber("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-4 rounded-xl border border-border bg-bgBase p-4">
              <h4 className="text-sm font-semibold text-textPrimary">Phone Numbers</h4>
              <div className="grid gap-2 md:grid-cols-[1fr_1.6fr_auto]">
                <select
                  className={fieldClass}
                  value={customCountryCode}
                  onChange={(event) => setCustomCountryCode(event.target.value)}
                >
                  {COUNTRY_DIAL_CODES.map((item) => (
                    <option key={`${item.name}-${item.code}`} value={item.code}>
                      {item.name} {item.code}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass}
                  placeholder="Enter local phone number"
                  value={customLocalNumber}
                  onChange={(event) => setCustomLocalNumber(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={addCustomNumberMutation.isPending || !isAdmin}
                  title={!isAdmin ? "Admin only" : undefined}
                  onClick={async () => {
                    const local = customLocalNumber.trim();
                    if (!local) {
                      showToast("Enter a phone number first", "error");
                      return;
                    }
                    const candidate = `${customCountryCode}${local}`.replace(/[^\d+]/g, "");
                    try {
                      await addCustomNumberMutation.mutateAsync(candidate);
                      showToast(`Added ${candidate} to purchase list`, "success");
                      setCustomLocalNumber("");
                    } catch (error) {
                      showToast(getApiErrorMessage(error, "Could not add number"), "error");
                    }
                  }}
                >
                  {addCustomNumberMutation.isPending ? "Adding..." : "Add Number"}
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {availableNumbers.slice(0, 6).map((number) => (
                  <div key={number} className="rounded-md border border-border bg-bgSurface p-2">
                    <p className="mb-2 text-xs font-medium text-textPrimary">{number}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={buyMutation.isPending || !isAdmin}
                        title={!isAdmin ? "Admin only" : undefined}
                        onClick={async () => {
                          try {
                            await buyMutation.mutateAsync(number);
                            showToast(`Purchased ${number}`, "success");
                          } catch (error) {
                            showToast(getApiErrorMessage(error, "Could not purchase number"), "error");
                          }
                        }}
                      >
                        Assign
                      </Button>
                      {customAvailableNumbers.includes(number) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={removeCustomNumberMutation.isPending || !isAdmin}
                          title={!isAdmin ? "Admin only" : undefined}
                          onClick={async () => {
                            try {
                              await removeCustomNumberMutation.mutateAsync(number);
                              showToast(`Removed ${number}`, "success");
                            } catch (error) {
                              showToast(getApiErrorMessage(error, "Could not remove number"), "error");
                            }
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className={fieldClass}
                  value={selectedPurchasedNumber}
                  onChange={(event) => setSelectedPurchasedNumber(event.target.value)}
                >
                  <option value="">Select assign number</option>
                  {purchasedNumbers.map((number) => (
                    <option key={number} value={number}>
                      {number}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass}
                  value={selectedAgentId}
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                >
                  <option value="">Select agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => void handleAssignPurchasedNumber()}
                  disabled={assignNumberMutation.isPending}
                >
                  {assignNumberMutation.isPending ? "Assigning..." : "Assign Number"}
                </Button>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-textSecondary">
                  Purchased numbers (click a number to select it, or remove using X)
                </p>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {availablePurchasedForAssignment.map((number) => (
                    <div
                      key={`purchased-${number}`}
                      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                        selectedPurchasedNumber === number
                          ? "border-accent bg-accent/10"
                          : "border-border bg-bgSurface"
                      }`}
                    >
                      <button
                        type="button"
                        className="truncate text-left font-medium text-textPrimary"
                        onClick={() => setSelectedPurchasedNumber(number)}
                        title="Select for assignment"
                      >
                        {number}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-textSecondary hover:bg-bgElevated hover:text-[color:var(--danger)]"
                        title="Remove number"
                        disabled={removeNumberMutation.isPending || !isAdmin}
                        onClick={async () => {
                          try {
                            await removeNumberMutation.mutateAsync(number);
                            if (selectedPurchasedNumber === number) {
                              setSelectedPurchasedNumber("");
                            }
                            showToast(`Removed ${number}`, "success");
                          } catch (error) {
                            showToast(getApiErrorMessage(error, "Could not remove number"), "error");
                          }
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                {assignedNumbers.slice(0, 4).map((item) => (
                  <div
                    key={`${item.phone_number}-${item.agent_id}`}
                    className="flex items-center justify-between rounded-md border border-border bg-bgSurface px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium">{item.phone_number}</span>
                      <span className="text-textSecondary"> {" -> "} {item.agent_name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unassignNumberMutation.isPending || !isAdmin}
                      title={!isAdmin ? "Admin only" : undefined}
                      onClick={async () => {
                        try {
                          await unassignNumberMutation.mutateAsync({
                            agent_id: item.agent_id,
                            phone_number: item.phone_number,
                          });
                          showToast(`Unassigned ${item.phone_number}`, "success");
                        } catch (error) {
                          showToast(getApiErrorMessage(error, "Could not unassign number"), "error");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-r from-[#d8eef8] to-[#f1ebff] p-8 dark:from-[#12243a] dark:to-[#1a2f46]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-textSecondary">Agent Training</p>
                <h2 className="text-4xl font-semibold text-textPrimary">Train your AI Receptionist</h2>
                <p className="mt-2 text-sm text-textSecondary">
                  Upload FAQ&apos;s and answers so Grace can handle more questions by itself.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-white/80 p-3 text-textPrimary hover:bg-white dark:bg-bgSurface dark:hover:bg-bgElevated"
                onClick={() => setView("memory")}
              >
                <ArrowRight />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-3xl font-semibold text-textPrimary">Unanswered Questions from Customers</h3>
            <div className="overflow-hidden rounded-2xl border border-border bg-bgSurface">
              <div className="grid grid-cols-[1.2fr_2fr_1fr] bg-bgElevated px-8 py-5 text-lg font-semibold text-textPrimary">
                <p className="text-textPrimary">Customer Name</p>
                <p className="text-textPrimary">Questions</p>
                <p className="text-right text-textPrimary">Action</p>
              </div>
              {unanswered.map((item, index) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-[1.2fr_2fr_1fr] items-center px-8 py-5 ${
                    index % 2 === 1 ? "bg-bgBase" : "bg-bgSurface"
                  }`}
                >
                  <p className="text-textPrimary">{item.contact_name}</p>
                  <p className="text-textPrimary">
                    <span className="mr-2 rounded bg-bgElevated px-2 py-0.5 text-xs uppercase">{item.source}</span>
                    {item.content}
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border bg-bgSurface text-textPrimary hover:bg-bgElevated"
                      onClick={async () => {
                        if (!selectedAgentId) {
                          showToast("Select an agent first", "error");
                          return;
                        }
                        try {
                          await addKbFromQuestionMutation.mutateAsync({
                            agent_id: selectedAgentId,
                            question: item.content,
                            source_id: item.id,
                            source_type: item.source,
                          });
                          showToast("Added to knowledge base", "success");
                        } catch (error) {
                          showToast(getApiErrorMessage(error, "Failed to add question"), "error");
                        }
                      }}
                    >
                      Add to Knowledge Base
                    </Button>
                    <button type="button" className="rounded p-1 text-textSecondary hover:bg-bgElevated">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {unanswered.length === 0 ? (
                <div className="px-8 py-5 text-sm text-textSecondary">No unanswered questions found.</div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "memory" ? (
        <section className="space-y-5">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-textSecondary hover:text-textPrimary"
            onClick={() => setView("training")}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="text-4xl font-semibold text-textPrimary">Agent Memory Training</h2>

          <div className="rounded-xl border border-border bg-bgSurface p-4">
            <label className="mb-2 block text-sm font-medium text-textPrimary">Target Agent</label>
            <select
              className={`${fieldClass} md:w-[420px]`}
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
            >
              <option value="">Select agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-accent bg-[#e7f1ff] p-10 text-center dark:bg-bgElevated">
            <Upload className="mx-auto mb-4 text-accent" size={52} />
            <p className="mb-5 text-sm text-textSecondary">Upload Knowledge File (PDF/CSV/Doc)</p>
            <form className="space-y-3" onSubmit={handleUploadDoc}>
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.doc,.docx"
                className="mx-auto block w-full max-w-md rounded-md border border-border bg-bgSurface px-3 py-2 text-sm text-textPrimary file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1 file:text-xs file:font-medium file:text-black dark:bg-bgBase dark:text-textPrimary"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              <Button type="submit" disabled={uploadDocMutation.isPending || !selectedAgentId || !uploadFile}>
                {uploadDocMutation.isPending ? "Uploading..." : "Upload & Ingest"}
              </Button>
              {!planLimits.canUploadKBDoc() ? (
                <p className="text-xs text-[color:var(--danger)]">Knowledge document limit reached for your plan.</p>
              ) : null}
            </form>
          </div>

          <form className="space-y-3 rounded-2xl border border-border bg-bgSurface p-5" onSubmit={handleCreateDoc}>
            <h3 className="text-3xl font-semibold text-textPrimary">Manual Entry</h3>
            <div className="space-y-2">
              <label className="text-lg font-medium">Question:</label>
              <input
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary"
                placeholder="e.g, What is the callout fee?"
                value={kbFileName}
                onChange={(event) => setKbFileName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-lg font-medium">Answer:</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary"
                placeholder="Enter the answer..."
                value={kbContent}
                onChange={(event) => setKbContent(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={asTextResponse}
                onChange={(event) => setAsTextResponse(event.target.checked)}
              />
              Send this as a text response to the customer
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setView("training")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDocMutation.isPending || !selectedAgentId}>
                {createDocMutation.isPending ? "Saving..." : "Save to Memory"}
              </Button>
            </div>
          </form>

          <div className="space-y-3 rounded-2xl border border-border bg-bgSurface p-5">
            <h3 className="text-2xl font-semibold text-textPrimary">Saved Memory Documents</h3>
            {!selectedAgentId ? <p className="text-sm text-textSecondary">Select an agent to load documents.</p> : null}
            {kbDocsQuery.isLoading ? <p className="text-sm text-textSecondary">Loading documents...</p> : null}
            {kbDocsQuery.isError ? <p className="text-sm text-[color:var(--danger)]">Failed to load documents.</p> : null}
            {kbDocs.map((doc) => (
              <div key={doc.id} className="rounded-md border border-border bg-bgElevated p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{doc.file_name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deleteDocMutation.mutateAsync({ agent_id: doc.agent_id, doc_id: doc.id });
                        showToast("Document deleted", "success");
                      } catch (error) {
                        showToast(getApiErrorMessage(error, "Failed to delete document"), "error");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <p className="text-xs text-textSecondary">{doc.content_preview}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view === "test" ? (
        <section className="space-y-4">
          <h2 className="text-4xl font-semibold text-textPrimary">Test Grace</h2>
          <p className="text-sm text-textSecondary">Experience Grace AI firsthand.</p>

          <div className="rounded-2xl border border-border bg-gradient-to-r from-[#cbe7fb] to-[#dceeff] p-10 dark:from-[#16273b] dark:to-[#1c3148]">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <h3 className="text-4xl font-semibold text-textPrimary">Talk to Grace!</h3>
                <div className="space-y-4">
                  <p className="flex items-center gap-3 text-2xl text-textPrimary">
                    <span className="rounded-full bg-accent/15 p-2 text-accent">
                      <Video size={20} />
                    </span>
                    See Grace in action, live
                  </p>
                  <p className="flex items-center gap-3 text-2xl text-textPrimary">
                    <span className="rounded-full bg-accent/15 p-2 text-accent">
                      <Phone size={20} />
                    </span>
                    Ask questions, request information
                  </p>
                  <p className="flex items-center gap-3 text-2xl text-textPrimary">
                    <span className="rounded-full bg-accent/15 p-2 text-accent">
                      <CalendarDays size={20} />
                    </span>
                    Test her booking and scheduling skills
                  </p>
                </div>
                <div>
                  <Button className="px-10 py-6 text-lg">
                    <Phone className="mr-2" size={18} /> Call Now
                  </Button>
                  <p className="mt-3 text-xl font-semibold text-accent">+1 (555) 123-4567</p>
                </div>
                <p className="text-sm text-textSecondary">
                  Active Agent: {activeAgent?.name ?? "No active agent found"}
                </p>
              </div>

              <div className="mx-auto w-full max-w-[310px] rounded-[2.6rem] border-[10px] border-white/80 bg-white/80 p-4 shadow-xl dark:border-[#35506f] dark:bg-[#20344a]">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#7e6f63] to-[#d1c6bc] p-6 text-center dark:from-[#435f7c] dark:to-[#20344c]">
                  <p className="text-xs text-white/80">Incoming Video Call</p>
                  <p className="text-2xl font-semibold text-white">Grace</p>
                  <div className="mx-auto mt-4 h-56 w-40 rounded-3xl bg-white/20 dark:bg-white/15" />
                  <div className="mt-5 flex items-center justify-center gap-8">
                    <div className="text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white">
                        <Phone size={16} />
                      </div>
                      <p className="mt-1 text-xs text-white">Decline</p>
                    </div>
                    <div className="text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white">
                        <Phone size={16} />
                      </div>
                      <p className="mt-1 text-xs text-white">Answer</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AgentExperienceWithClerk(): JSX.Element {
  const { isAdmin } = useOrgRoleWithClerk();
  return <AgentExperiencePageInner isAdmin={isAdmin} />;
}

export default function AgentExperiencePage(): JSX.Element {
  if (!CLERK_ENABLED) {
    return <AgentExperiencePageInner isAdmin={true} />;
  }
  return <AgentExperienceWithClerk />;
}
