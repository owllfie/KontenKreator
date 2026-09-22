"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

const dateFmt = {
  weekday: "long",
  year: "numeric",
  month: "short",
  day: "numeric",
};

const timeFmt = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

export default function SidebarDateTime({ open }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={`mb-6 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 ${
        open ? "" : "px-2 py-2"
      }`}
    >
      <div className={`flex items-center gap-2 ${open ? "" : "justify-center"}`}>
        <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
        {open && (
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
              {now.toLocaleDateString(undefined, dateFmt)}
            </p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {now.toLocaleTimeString(undefined, timeFmt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}