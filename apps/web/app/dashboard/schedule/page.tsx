"use client";

import { ChevronLeft, ChevronRight, Clock3, Filter, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { useCreateScheduleJob, useScheduleJobs, useUpdateScheduleJobStatus } from "@/lib/hooks/use-schedule";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_COLORS: Record<string, string> = {
  booked: "bg-amber-100 text-amber-900 border-amber-300",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-300",
  cancelled: "bg-rose-100 text-rose-900 border-rose-300",
};

function formatMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function startOfWeek(date: Date): Date {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  base.setDate(base.getDate() - base.getDay());
  return base;
}

function buildMonthCells(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const last = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const cells: Date[] = [];

  const start = startOfWeek(first);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  const cursor = new Date(start);
  while (cursor <= end) {
    cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function buildWeekCells(viewDate: Date): Date[] {
  const start = startOfWeek(viewDate);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

export default function SchedulePage(): JSX.Element {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [statusFilter, setStatusFilter] = useState<"all" | "booked" | "completed" | "cancelled">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});

  const monthKey = formatMonthKey(viewDate);
  const scheduleJobsQuery = useScheduleJobs(monthKey);
  const createScheduleJob = useCreateScheduleJob(monthKey);
  const updateScheduleJobStatus = useUpdateScheduleJobStatus(monthKey);
  const { showToast } = useToast();

  const calendarCells = useMemo(
    () => (viewMode === "month" ? buildMonthCells(viewDate) : buildWeekCells(viewDate)),
    [viewDate, viewMode]
  );

  const jobs = scheduleJobsQuery.data ?? [];
  const filteredJobs = useMemo(
    () => (statusFilter === "all" ? jobs : jobs.filter((item) => item.status === statusFilter)),
    [jobs, statusFilter]
  );

  const jobsByDay = useMemo(() => {
    const map = new Map<string, typeof filteredJobs>();
    for (const item of filteredJobs) {
      const key = new Date(item.starts_at).toDateString();
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [filteredJobs]);

  const selectedDateJobs = useMemo(() => {
    if (!selectedDateKey) return [];
    return jobsByDay.get(selectedDateKey) ?? [];
  }, [jobsByDay, selectedDateKey]);

  const nowTime = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    []
  );

  const metrics = useMemo(() => {
    const total = jobs.length;
    const booked = jobs.filter((job) => job.status === "booked").length;
    const completed = jobs.filter((job) => job.status === "completed").length;
    return { total, booked, completed };
  }, [jobs]);

  async function handleCreateJob(): Promise<void> {
    if (!customerName.trim() || !title.trim() || !startDate || !startTime) {
      showToast("Please fill customer, title, date and time.", "error");
      return;
    }
    const startsAt = `${startDate}T${startTime}`;
    try {
      await createScheduleJob.mutateAsync({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        title: title.trim(),
        notes: notes.trim() || undefined,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(new Date(startsAt).getTime() + Number(durationMinutes) * 60_000).toISOString(),
        source: "manual",
      });
      setCustomerName("");
      setCustomerPhone("");
      setTitle("");
      setStartDate("");
      setStartTime("09:00");
      setDurationMinutes("30");
      setNotes("");
      setIsCreateOpen(false);
      showToast("Job added to schedule", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to add job"), "error");
    }
  }

  function goPrev(): void {
    setViewDate((d) =>
      viewMode === "month"
        ? new Date(d.getFullYear(), d.getMonth() - 1, 1)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)
    );
  }

  function goNext(): void {
    setViewDate((d) =>
      viewMode === "month"
        ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
    );
  }

  async function handleJobStatusChange(jobId: string, next: string): Promise<void> {
    if (!["booked", "completed", "cancelled"].includes(next)) return;
    try {
      await updateScheduleJobStatus.mutateAsync({
        id: jobId,
        status: next as "booked" | "completed" | "cancelled",
      });
      setStatusDrafts((prev) => ({ ...prev, [jobId]: next }));
      showToast("Job status updated", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to update status"), "error");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Schedule</h1>
        <p className="text-xs text-textSecondary">
          Customer jobs and booking calendar. AI-booked appointments are tagged as AI Auto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-bgSurface p-3">
            <p className="text-xs text-textSecondary">Total Jobs</p>
            <p className="text-2xl font-semibold text-textPrimary">{metrics.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-bgSurface p-3">
            <p className="text-xs text-textSecondary">Booked</p>
            <p className="text-2xl font-semibold text-amber-600">{metrics.booked}</p>
          </div>
          <div className="rounded-xl border border-border bg-bgSurface p-3">
            <p className="text-xs text-textSecondary">Completed</p>
            <p className="text-2xl font-semibold text-emerald-600">{metrics.completed}</p>
          </div>
          <div className="rounded-xl border border-border bg-bgSurface p-3">
            <p className="mb-2 text-xs text-textSecondary">Status Legend</p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Booked
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Cancelled
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold">{formatMonthTitle(viewDate)}</h2>
              <button type="button" className="rounded-md p-1 hover:bg-accentDim" onClick={goPrev}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="rounded-md p-1 hover:bg-accentDim" onClick={goNext}>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <Clock3 size={14} />
                <span className="text-sm font-medium">{nowTime}</span>
              </div>
              <div className="flex rounded-md border border-border bg-bgSurface p-0.5">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${viewMode === "month" ? "bg-accent text-white" : ""}`}
                  onClick={() => setViewMode("month")}
                >
                  Monthly View
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${viewMode === "week" ? "bg-accent text-white" : ""}`}
                  onClick={() => setViewMode("week")}
                >
                  Weekly View
                </button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
                <Filter size={14} className="mr-1" /> All
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusFilter("booked")}>
                Booked
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusFilter("completed")}>
                Completed
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusFilter("cancelled")}>
                Cancelled
              </Button>
              <Button type="button" size="sm" onClick={() => setIsCreateOpen((v) => !v)}>
                <Plus size={14} className="mr-1" /> Add Job
              </Button>
            </div>
          </div>

          {isCreateOpen ? (
            <div className="grid gap-2 rounded-lg border border-border bg-bgSurface p-3 md:grid-cols-3">
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs"
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs"
                placeholder="Customer phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs"
                placeholder="Job title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs text-textPrimary placeholder:text-textSecondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs text-textPrimary placeholder:text-textSecondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <select
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
              <input
                className="rounded-md border border-border bg-bgBase px-3 py-1.5 text-xs"
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="md:col-span-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleCreateJob()}
                  disabled={createScheduleJob.isPending}
                >
                  {createScheduleJob.isPending ? "Saving..." : "Save Job"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-border bg-bgSurface">
            <div className="grid min-w-[640px] grid-cols-7 border-b border-border">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-textSecondary">
                  {day}
                </div>
              ))}
            </div>

            {scheduleJobsQuery.isLoading ? <div className="p-4 text-xs text-textSecondary">Loading schedule...</div> : null}

            <div className="grid min-w-[640px] grid-cols-7">
              {calendarCells.map((date) => {
                const dateKey = date.toDateString();
                const dayJobs = jobsByDay.get(dateKey) ?? [];
                const isCurrentMonth = date.getMonth() === viewDate.getMonth();
                const isSelected = selectedDateKey === dateKey;
                return (
                  <div
                    key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    className={`min-h-[102px] border-r border-t border-border p-2 last:border-r-0 ${
                      viewMode === "month" && !isCurrentMonth ? "bg-bgBase/30 text-textSecondary" : "bg-bgSurface"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDateKey(dateKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDateKey(dateKey);
                      }
                    }}
                  >
                    <div className={`mb-1 text-sm font-medium ${isSelected ? "text-accent" : ""}`}>{date.getDate()}</div>
                    <div className="space-y-1">
                      {dayJobs.slice(0, 2).map((job) => (
                        <div
                          key={job.id}
                          className={`rounded-md border px-1.5 py-1 text-[10px] ${
                            STATUS_COLORS[job.status] ?? "bg-slate-100 text-slate-900 border-slate-300"
                          }`}
                          title="Select date to edit all jobs"
                        >
                          <p className="truncate font-semibold">
                            {job.customer_name}
                            {job._localOnly ? (
                              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
                                Local
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate">{job.title}</p>
                          <p className="truncate uppercase tracking-wide">{job.source === "ai" ? "AI Auto" : "Manual"}</p>
                          <p>
                            {new Date(job.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                      {dayJobs.length > 2 ? <p className="text-[10px] text-textSecondary">+{dayJobs.length - 2} more</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDateKey ? (
            <div className="rounded-xl border border-border bg-bgSurface p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-textPrimary">
                  Jobs on {new Date(selectedDateKey).toLocaleDateString()}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedDateKey(null)}>
                  Close
                </Button>
              </div>
              {selectedDateJobs.length === 0 ? (
                <p className="text-xs text-textSecondary">No jobs on this date.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateJobs.map((job) => {
                    const draft = statusDrafts[job.id] ?? job.status;
                    return (
                      <div
                        key={job.id}
                        className="grid gap-2 rounded-md border border-border bg-bgBase p-2 md:grid-cols-[1fr_auto_auto]"
                      >
                        <div>
                          <p className="text-sm font-medium text-textPrimary">{job.customer_name}</p>
                          <p className="text-xs text-textSecondary">{job.title}</p>
                          <p className="text-xs text-textSecondary">
                            {new Date(job.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-bgSurface px-2 py-1 text-xs"
                          value={draft}
                          onChange={(event) =>
                            setStatusDrafts((prev) => ({ ...prev, [job.id]: event.target.value.toLowerCase() }))
                          }
                        >
                          <option value="booked">Booked</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleJobStatusChange(job.id, draft)}
                          disabled={updateScheduleJobStatus.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
