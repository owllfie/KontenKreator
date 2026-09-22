"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export function DataTable({
  columns,
  data,
  total,
  page,
  totalPages,
  onPageChange,
  loading,
  selectable,
  selected,
  onToggleRow,
  onToggleAll,
  getRowId,
}) {
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const selectedSet = selected || new Set();
  const pageIds = selectable && getRowId ? data.map((row) => getRowId(row)) : [];
  const allSelected =
    selectable && pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              {selectable && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleAll?.(pageIds)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowId = getRowId ? getRowId(row) : idx;
                return (
                  <tr
                    key={rowId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(rowId)}
                          onChange={() => onToggleRow?.(rowId)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-gray-700 dark:text-gray-300"
                      >
                        {col.render
                          ? col.render(row)
                          : row[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {data.length > 0 ? (page - 1) * 10 + 1 : 0}–
            {Math.min(page * 10, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pages.map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-2 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                    page === p
                      ? "bg-red-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}