"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type AgentRow = {
  id: string;
  email: string | null;
  created_at: string;
  role: string | null;
};

type AgentsGetResponse = {
  success: boolean;
  error?: string;
  agents?: AgentRow[];
};

type AgentCreateResponse = {
  success: boolean;
  error?: string;
  agent?: AgentRow;
};

type AgentDeleteResponse = {
  success: boolean;
  error?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function AgentManagementClient() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  async function loadAgents() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/agents", { method: "GET" });
      const result = (await response.json()) as AgentsGetResponse;

      if (!response.ok || !result.success || !result.agents) {
        throw new Error(result.error ?? "Failed to load agents");
      }

      setAgents(result.agents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  async function handleCreateAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (tempPassword.trim().length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          tempPassword,
        }),
      });
      const result = (await response.json()) as AgentCreateResponse;

      if (!response.ok || !result.success || !result.agent) {
        throw new Error(result.error ?? "Failed to create agent");
      }

      const createdAgent = result.agent;
      setAgents((previous) => [createdAgent, ...previous.filter((agent) => agent.id !== createdAgent.id)]);
      setFirstName("");
      setLastName("");
      setEmail("");
      setTempPassword("");
      setSuccess("Agent account created and welcome email sent.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAgent(id: string) {
    const confirmed = window.confirm("Are you sure you want to delete this agent? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingId(id);

    try {
      const response = await fetch(`/api/admin/agents/${id}`, { method: "DELETE" });
      const result = (await response.json()) as AgentDeleteResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to delete agent");
      }

      setAgents((previous) => previous.filter((agent) => agent.id !== id));
      setSuccess("Agent deleted successfully.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete agent");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-6 text-white sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 border-b border-white/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#E55125]">JDM Rush</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Agent Management</h1>
              <p className="mt-1 text-sm text-white/70">Create and manage export agent accounts</p>
            </div>
            <Link
              className="rounded-md border border-[#333333] bg-transparent px-4 py-2 text-sm text-gray-300 transition-colors hover:border-[#E55125] hover:text-[#E55125]"
              href="/admin/dashboard"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        <section className="mb-6 rounded-xl border border-white/10 bg-[#141414] p-5">
          <h2 className="mb-4 text-lg font-semibold">Create New Agent</h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAgent}>
            <label className="text-sm text-white/80">
              First Name
              <input
                className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
                required
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </label>
            <label className="text-sm text-white/80">
              Last Name
              <input
                className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
                required
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </label>
            <label className="text-sm text-white/80 md:col-span-2">
              Email Address
              <input
                className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="text-sm text-white/80 md:col-span-2">
              Temporary Password
              <input
                className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
                minLength={8}
                required
                type="text"
                value={tempPassword}
                onChange={(event) => setTempPassword(event.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <button
                className="rounded-md border border-[#E55125]/80 bg-[#E55125]/15 px-4 py-2 text-sm font-medium text-[#ffb59e] hover:bg-[#E55125]/25 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Creating..." : "Create Agent"}
              </button>
            </div>
          </form>
        </section>

        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-green-400">{success}</p> : null}

        <section className="rounded-xl border border-white/10 bg-[#131313]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold">Existing Agents</h2>
          </div>
          {loading ? (
            <p className="px-5 py-5 text-sm text-white/70">Loading agents...</p>
          ) : agents.length === 0 ? (
            <p className="px-5 py-5 text-sm text-white/70">No agent accounts found.</p>
          ) : (
            <ul>
              {agents.map((agent) => (
                <li
                  className="flex flex-col gap-3 border-t border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={agent.id}
                >
                  <div>
                    <p className="text-sm font-medium">{agent.email ?? "No email"}</p>
                    <p className="text-xs text-white/60">Created: {formatDate(agent.created_at)}</p>
                  </div>
                  <button
                    className="rounded-md border border-red-500/60 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deletingId === agent.id}
                    onClick={() => void handleDeleteAgent(agent.id)}
                    type="button"
                  >
                    {deletingId === agent.id ? "Deleting..." : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
