"use client";

import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/providers/toast-provider";
import api from "@/lib/api";
import { flushSyncQueue } from "@/lib/sync-queue";

type Status = "online" | "offline" | "checking";

export function SyncStatus(): JSX.Element | null {
  const [status, setStatus] = useState<Status>("checking");
  const previousStatus = useRef<Status>("checking");
  const { showToast } = useToast();

  useEffect(() => {
    const check = async () => {
      try {
        await api.get("/health", { timeout: 3000 });
        setStatus("online");
      } catch {
        setStatus("offline");
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const wasOffline = previousStatus.current === "offline";
    if (status === "online" && wasOffline) {
      void flushSyncQueue(api).then((count) => {
        if (count > 0) {
          showToast(`Synced ${count} pending records to cloud.`, "success");
        }
      });
    }
    previousStatus.current = status;
  }, [showToast, status]);

  if (status === "checking") return null;
  return (
    <div className="rounded-md border border-border bg-bgBase px-2 py-1 text-xs text-textSecondary">
      {status === "online" ? "Cloud Sync: On" : "Offline - Data saved locally"}
    </div>
  );
}
