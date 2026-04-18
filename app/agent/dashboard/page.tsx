"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Docket = {
  id: string;
  created_at: string;
  status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  destination_city: string | null;
  destination_province: string | null;
  budget_bracket: string | null;
  timeline: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  questions_sent: "Questions Sent",
  answers_received: "Answers Received",
  research_in_progress: "Research In Progress",
  report_sent: "Report Sent",
  decision_made: "Decision Made",
  cleared: "Cleared",
  lost: "Lost",
  paused: "Paused",
  unresponsive: "Unresponsive",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  new: "bg-yellow-400/15 text-yellow-300 ring-1 ring-yellow-300/35",
  questions_sent: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-300/35",
  answers_received: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-300/35",
  research_in_progress: "bg-orange-400/15 text-orange-300 ring-1 ring-orange-300/35",
  report_sent: "bg-violet-400/15 text-violet-300 ring-1 ring-violet-300/35",
  decision_made: "bg-green-400/15 text-green-300 ring-1 ring-green-300/35",
  cleared: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/35",
  lost: "bg-red-500/15 text-red-300 ring-1 ring-red-300/35",
  paused: "bg-zinc-400/20 text-zinc-300 ring-1 ring-zinc-300/35",
  unresponsive: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/35",
};

function formatStatus(status: string | null | undefined) {
  const normalized = status ?? "new";
  return STATUS_LABELS[normalized] ?? normalized;
}

function buildVehicleLabel(
  year: string | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined
) {
  return [year, make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function deriveDisplayNameFromEmail(email?: string | null) {
  if (!email) {
    return null;
  }

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) {
    return null;
  }

  const firstToken = localPart.split(/[._-]+/)[0]?.trim();
  if (!firstToken) {
    return null;
  }

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

async function getAgentProfile(userId: string, supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (byId.data?.role) {
    return {
      role: byId.data.role as string,
    };
  }

  return {
    role: null,
  };
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [loading, setLoading] = useState(true);
  const [dockets, setDockets] = useState<Docket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [agentDisplayName, setAgentDisplayName] = useState("there");

  useEffect(() => {
    async function loadDashboard() {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse.user;

      if (!user) {
        router.replace("/agent/login");
        return;
      }

      const profile = await getAgentProfile(user.id, supabase);
      const role = profile.role;

      if (role !== "agent" && role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/agent/login");
        return;
      }

      setRole(role);
      setAgentDisplayName(deriveDisplayNameFromEmail(user.email) ?? "there");

      if (role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }

      const { data, error: docketError } = await supabase
        .from("dockets")
        .select(
          "id, created_at, status, customer_first_name, customer_last_name, vehicle_year, vehicle_make, vehicle_model, destination_city, destination_province, budget_bracket, timeline"
        )
        .order("created_at", { ascending: false });

      if (docketError) {
        setError(docketError.message);
        setLoading(false);
        return;
      }

      setDockets((data as Docket[]) ?? []);
      setLoading(false);
    }

    void loadDashboard();
  }, [router, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/agent/login");
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <header className="relative mb-8 border-b border-white/10 pb-5">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#E55125]">JDM Rush</p>
            <h1 className="mt-2 text-3xl font-semibold">Export Agent Dashboard</h1>
          </div>
          <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
            <div className="flex items-center gap-2">
              {role === "admin" ? (
                <Link
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  href="/admin/dashboard"
                >
                  Admin Dashboard
                </Link>
              ) : null}
              <button
                className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white"
                onClick={handleSignOut}
                type="button"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {loading ? <p className="text-white/75">Loading dockets...</p> : null}
        {error ? <p className="text-red-400">{error}</p> : null}

        {!loading && !error && dockets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center text-white/70">
            No dockets yet.
          </div>
        ) : null}

        {!loading && !error && dockets.length > 0 ? (
          <>
            <section className="pb-6">
              <h2 className="text-2xl font-semibold text-white">
                Welcome back, {agentDisplayName}. You&apos;ve got active dockets ready for your attention — let&apos;s
                get these builds moving. 🇯🇵
              </h2>
              <p className="mt-2 text-base text-[#888]">
                Each docket below represents a real buyer ready to find their perfect JDM vehicle. Review each one,
                pull your research, and let&apos;s get these deals moving. 🇯🇵
              </p>
            </section>
            <div className="grid gap-4">
              {dockets.map((docket) => {
                const status = docket.status ?? "new";
                const badgeClass = STATUS_BADGE_STYLES[status] ?? "bg-white/10 text-white ring-1 ring-white/25";
                const badgeLabel = formatStatus(status);
                const customerName =
                  `${docket.customer_first_name ?? ""} ${docket.customer_last_name ?? ""}`.trim() ||
                  "Unnamed Customer";
                const vehicle = buildVehicleLabel(docket.vehicle_year, docket.vehicle_make, docket.vehicle_model);
                const destination = [docket.destination_city, docket.destination_province].filter(Boolean).join(", ");

                return (
                  <article
                    className="rounded-xl border border-white/12 bg-[#171717] p-5 shadow-lg"
                    key={docket.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-white">{customerName}</h2>
                        <p className="text-sm text-white/80">Vehicle: {vehicle || "N/A"}</p>
                        <p className="text-sm text-white/80">Destination: {destination || "N/A"}</p>
                        <p className="text-sm text-white/80">Budget: {docket.budget_bracket || "N/A"}</p>
                        <p className="text-sm text-white/80">Timeline: {docket.timeline || "N/A"}</p>
                        <p className="text-sm text-white/70">
                          Created: {new Date(docket.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                        <Link
                          className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                          href={`/agent/docket/${docket.id}`}
                        >
                          Open Docket
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
