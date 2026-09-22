"use client";

import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileVideo2, CalendarDays, Link2, StickyNote, Pencil } from "lucide-react";
import { api } from "@/lib/api";

const statusStyle = {
  approved: "bg-green-500/10 text-green-600 dark:text-green-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  revision_needed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export default function ContentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ judulKonten: "", fileDraft: "", catatan: "", revisionNote: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const json = await api(`/api/me/contents/${id}`);
        setData(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const startEdit = () => {
    setForm({
      judulKonten: data.judulKonten || "",
      fileDraft: data.fileDraft || "",
      catatan: data.catatan || "",
      revisionNote: data.revisionNote || "",
    });
    setSaveError("");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!form.judulKonten.trim()) {
      setSaveError("Content title is required");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const json = await api(`/api/me/contents/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          judulKonten: form.judulKonten.trim(),
          fileDraft: form.fileDraft || null,
          catatan: form.catatan || null,
          revisionNote: form.revisionNote || null,
        }),
      });
      setData(json.data);
      setEditing(false);
      setNotice("Content updated and reset to pending for review.");
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        to="/app/project"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      {notice && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-6 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : data ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500 shrink-0">
                <FileVideo2 className="h-5 w-5" />
              </span>
              <div>
                {editing ? (
                  <input
                    type="text"
                    value={form.judulKonten}
                    onChange={(e) => setForm({ ...form, judulKonten: e.target.value })}
                    className="w-full max-w-md px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-lg font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                ) : (
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">{data.judulKonten}</h1>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.namaProjek} · {data.namaTim}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  statusStyle[data.statusApproval] || "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                }`}
              >
                {data.statusApproval}
              </span>
              {!editing && (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>
          </div>

          <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-gray-200 dark:border-gray-800">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Uploader</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                {data.uploaderName || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Revisor</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                {data.revisions?.length ? data.revisions[0].reviewerName || "—" : "—"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {data.revisions?.length && data.revisions[0].createdAt
                  ? new Date(data.revisions[0].createdAt).toLocaleString()
                  : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Uploaded</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                {data.createdAt ? new Date(data.createdAt).toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                File Draft
              </p>
              {editing ? (
                <input
                  type="text"
                  value={form.fileDraft}
                  onChange={(e) => setForm({ ...form, fileDraft: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="e.g. URL or drive link"
                />
              ) : data.fileDraft ? (
                <a
                  href={data.fileDraft}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline break-all"
                >
                  <Link2 className="h-4 w-4 shrink-0" /> {data.fileDraft}
                </a>
              ) : (
                <p className="text-sm text-gray-400 italic">No file draft.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Note
              </p>
              {editing ? (
                <textarea
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="Write a note..."
                />
              ) : data.catatan ? (
                <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {data.catatan}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">No note.</p>
              )}
              {editing && saveError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>
              )}
              {editing && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-pink-500 hover:bg-pink-600 text-white disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Revision Note
              </p>
              {editing ? (
                <textarea
                  value={form.revisionNote}
                  onChange={(e) => setForm({ ...form, revisionNote: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="Describe what was fixed or changed for review..."
                />
              ) : data.revisionNote ? (
                <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  <p className="whitespace-pre-wrap">{data.revisionNote}</p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    by {data.revisionByName || "—"} · {data.revisionNoteAt ? new Date(data.revisionNoteAt).toLocaleString() : "—"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No revision note.</p>
              )}
            </div>

            {data.revisions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Revision Log
                </p>
                <div className="space-y-3">
                  {data.revisions.map((r) => (
                    <div
                      key={r.idRevision}
                      className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {r.reviewerName || "—"}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                              String(r.statusRevisi || "").toLowerCase() === "resolved"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {r.statusRevisi || "open"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {r.createdAt
                              ? new Date(r.createdAt).toLocaleString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {r.catatanRevisi || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <CalendarDays className="h-3.5 w-3.5" /> Last updated{" "}
              {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}