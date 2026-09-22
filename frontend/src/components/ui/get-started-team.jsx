"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, KeyRound, Plus, LogIn } from "lucide-react";
import { api } from "@/lib/api";

export default function GetStartedTeam({ onJoined }) {
  const navigate = useNavigate();

  const [teamName, setTeamName] = useState("");
  const [code, setCode] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const createTeam = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }
    setCreateLoading(true);
    try {
      const json = await api("/api/me/team", {
        method: "POST",
        body: JSON.stringify({ namaTim: teamName.trim() }),
      });
      const team = json.data;
      setSuccess(`Team "${team.namaTim}" created successfully! Team code: ${team.kodeTim}`);
      setTeamName("");
      setTimeout(() => {
        onJoined?.();
        navigate("/app/team");
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const joinTeam = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!code.trim()) {
      setError("Team code is required");
      return;
    }
    setJoinLoading(true);
    try {
      const json = await api("/api/me/team/join", {
        method: "POST",
        body: JSON.stringify({ kodeTim: code.trim() }),
      });
      setSuccess(`Joined team "${json.data.namaTim}" successfully`);
      setCode("");
      setTimeout(() => {
        onJoined?.();
        navigate("/app/team");
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Start Collaborating
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create a new team or join an existing team using its code.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <form
          onSubmit={createTeam}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Create New Team
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You will become the team leader and get a code to share with other
            members.
          </p>
          <input
            type="text"
            placeholder="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="mt-4 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          <button
            type="submit"
            disabled={createLoading}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {createLoading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Team
          </button>
        </form>

        <form
          onSubmit={joinTeam}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <KeyRound className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Join Team
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter the team code shared by the leader to join.
          </p>
          <input
            type="text"
            placeholder="Team code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-4 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            type="submit"
            disabled={joinLoading}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {joinLoading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Join Team
          </button>
        </form>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-4 text-sm text-green-600 dark:text-green-400">
          {success}
        </p>
      )}
    </div>
  );
}