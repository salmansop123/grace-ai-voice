"use client";

import { useMemo, useState } from "react";

import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAgents } from "@/lib/hooks/use-agents";
import {
  useCampaigns,
  useCreateCampaign,
  useLaunchCampaign,
  useUpdateCampaignStatus
} from "@/lib/hooks/use-campaigns";
import { useContacts } from "@/lib/hooks/use-contacts";
import { usePlanLimits } from "@/lib/hooks/use-plan-limits";

export default function CampaignsPage(): JSX.Element {
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [launchCooldownById, setLaunchCooldownById] = useState<Record<string, boolean>>({});

  const campaignsQuery = useCampaigns();
  const createCampaignMutation = useCreateCampaign();
  const updateCampaignStatusMutation = useUpdateCampaignStatus();
  const launchCampaignMutation = useLaunchCampaign();
  const contactsQuery = useContacts();
  const agentsQuery = useAgents();
  const planLimits = usePlanLimits();
  const { showToast } = useToast();

  const campaigns = campaignsQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  const contactLabelMap = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, `${contact.name} (${contact.phone})`])),
    [contacts]
  );
  const agentLabelMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);
  const filteredContacts = useMemo(() => {
    const needle = contactSearch.trim().toLowerCase();
    if (!needle) {
      return contacts;
    }
    return contacts.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(needle) ||
        contact.phone.toLowerCase().includes(needle) ||
        (contact.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [contactSearch, contacts]);
  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedContactIds.includes(contact.id)),
    [contacts, selectedContactIds]
  );

  function toggleContactSelection(contactId: string): void {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((item) => item !== contactId) : [...prev, contactId]
    );
  }

  async function handleCreateCampaign(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim() || !agentId || selectedContactIds.length === 0) {
      return;
    }
    if (!planLimits.canLaunchCampaign()) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      await createCampaignMutation.mutateAsync({
        name: name.trim(),
        agent_id: agentId,
        contact_ids: selectedContactIds,
        scheduled: scheduled ? new Date(scheduled).toISOString() : undefined
      });
      showToast("Campaign created", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Campaign creation failed"), "error");
      return;
    }

    setName("");
    setScheduled("");
    setSelectedContactIds([]);
    setContactSearch("");
  }

  return (
    <div className="space-y-6">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Upgrade to create more campaigns" />
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Campaigns</h1>
        <p className="text-sm text-textSecondary">Build outbound call campaigns with agent + contact groups.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateCampaign}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-textSecondary">Campaign message/name</label>
              <input
                className="w-full rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
                placeholder="e.g. Summer promo follow-up calls"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="text-[11px] text-textSecondary">
                This helps your team identify the campaign purpose.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-textSecondary">Agent</label>
              <select
                className="w-full rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
              >
                <option value="">Select agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-textSecondary">Schedule date & time</label>
              <input
                className="w-full cursor-pointer rounded-md border border-border bg-bgBase px-3 py-2 text-sm text-textPrimary placeholder:text-textSecondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                type="datetime-local"
                value={scheduled}
                onChange={(event) => setScheduled(event.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-textSecondary">Contacts (select one or more)</label>
              <div className="space-y-2 rounded-md border border-border bg-bgBase p-3">
                <div className="space-y-1">
                  <input
                    className="w-full rounded-md border border-border bg-bgSurface px-3 py-2 text-sm"
                    placeholder="Search existing customers by name, phone, or email"
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                  />
                  <p className="text-[11px] text-textSecondary">
                    Select contacts from your customer list. This field is a selector, not free-text entry.
                  </p>
                </div>

                {selectedContacts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedContacts.map((contact) => (
                      <button
                        key={`selected-${contact.id}`}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-bgSurface px-3 py-1 text-xs text-textPrimary hover:bg-bgElevated"
                        onClick={() => toggleContactSelection(contact.id)}
                        title="Remove selected contact"
                      >
                        <span>{contact.name}</span>
                        <span className="text-textSecondary">{contact.phone}</span>
                        <span aria-hidden>✕</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-textSecondary">No contacts selected yet.</p>
                )}

                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-bgSurface">
                  {contactsQuery.isLoading ? (
                    <p className="p-3 text-sm text-textSecondary">Loading contacts...</p>
                  ) : null}
                  {!contactsQuery.isLoading && filteredContacts.length === 0 ? (
                    <p className="p-3 text-sm text-textSecondary">
                      {contacts.length === 0
                        ? "No contacts found. Add customers first in the Customers module."
                        : "No matches for your search."}
                    </p>
                  ) : null}
                  {filteredContacts.map((contact) => {
                    const isSelected = selectedContactIds.includes(contact.id);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        className={`flex w-full items-start gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 ${
                          isSelected ? "bg-accentDim" : "hover:bg-bgElevated"
                        }`}
                        onClick={() => toggleContactSelection(contact.id)}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={isSelected}
                          readOnly
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-textPrimary">{contact.name}</span>
                          <span className="block truncate text-xs text-textSecondary">
                            {contact.phone}
                            {contact.email ? ` · ${contact.email}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createCampaignMutation.isPending || !planLimits.canLaunchCampaign()}>
                {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
              {!planLimits.canLaunchCampaign() ? (
                <p className="mt-2 text-xs text-[color:var(--danger)]">
                  Campaign limit reached for your plan. Upgrade to create more.
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign List</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {campaignsQuery.isLoading ? <p className="text-sm text-textSecondary">Loading campaigns...</p> : null}
          {campaignsQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">
              Could not load campaigns. Check backend settings.
            </p>
          ) : null}
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-textSecondary">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Agent</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Scheduled</th>
                <th className="py-2 font-medium">Calls Queued</th>
                <th className="py-2 font-medium">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-border/60 align-top">
                  <td className="py-3">{campaign.name}</td>
                  <td className="py-3">{agentLabelMap.get(campaign.agent_id) ?? campaign.agent_id}</td>
                  <td className="py-3">{campaign.status}</td>
                  <td className="py-3">{campaign.scheduled ? new Date(campaign.scheduled).toLocaleString() : "--"}</td>
                  <td className="py-3">{campaign.calls_made}</td>
                  <td className="py-3">
                    <div className="flex flex-col gap-1">
                      {campaign.contact_ids.map((contactId) => (
                        <span key={contactId}>{contactLabelMap.get(contactId) ?? contactId}</span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={Boolean(launchCooldownById[campaign.id])}
                        onClick={async () => {
                          if (!planLimits.canLaunchCampaign()) {
                            setShowUpgradeModal(true);
                            return;
                          }
                          try {
                            setLaunchCooldownById((prev) => ({ ...prev, [campaign.id]: true }));
                            await launchCampaignMutation.mutateAsync({ id: campaign.id });
                            showToast("Campaign launched and calls queued", "success");
                          } catch (error) {
                            showToast(getApiErrorMessage(error, "Campaign launch failed"), "error");
                          } finally {
                            window.setTimeout(() => {
                              setLaunchCooldownById((prev) => ({ ...prev, [campaign.id]: false }));
                            }, 5000);
                          }
                        }}
                      >
                        {launchCooldownById[campaign.id] ? "Launch cooling..." : "Launch"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          void updateCampaignStatusMutation.mutateAsync({
                            id: campaign.id,
                            status: "running"
                          })
                        }
                      >
                        Start
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          void updateCampaignStatusMutation.mutateAsync({
                            id: campaign.id,
                            status: "paused"
                          })
                        }
                      >
                        Pause
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void updateCampaignStatusMutation.mutateAsync({
                            id: campaign.id,
                            status: "draft"
                          })
                        }
                      >
                        Reset
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
