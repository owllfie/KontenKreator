"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, RotateCcw, Bot, User } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {
    // ignore
  }
  return "";
}

const WELCOME = {
  role: "assistant",
  content:
    "Halo! Saya Copilot untuk Creator Studio. Tanya saya seputar pengguna, tim, proyek, konten, akses, atau backup database.",
};

function ChatPanel({ open, onToggle }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, streaming]);

  const send = async () => {
    const content = input.trim();
    if (!content || streaming) return;

    const nextMessages = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setError(null);

    const userIdx = nextMessages.length - 2;
    const assistantIdx = nextMessages.length - 1;

    const history = nextMessages.slice(0, assistantIdx);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let detail = text;
        try {
          detail = JSON.parse(text)?.message || text;
        } catch {
          // keep raw
        }
        throw new Error(detail || `Error ${res.status}`);
      }

      if (!res.body) throw new Error("Tidak ada response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;

          let json;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }

          if (json.done) continue;
          if (typeof json.delta === "string") {
            finalText += json.delta;
            setMessages((prev) => {
              const copy = [...prev];
              copy[assistantIdx] = {
                role: "assistant",
                content: finalText,
              };
              return copy;
            });
          }
        }
      }
    } catch (e) {
      if (e.name === "AbortError") {
        // stream cancelled, keep partial text
      } else {
        setError(e.message || "Terjadi kesalahan");
        setMessages((prev) => {
          const copy = prev.map((m, i) =>
            i === assistantIdx && m.content === ""
              ? { ...m, content: `Maaf, terjadi kesalahan. ${e.message || ""}` }
              : m
          );
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([WELCOME]);
    setError(null);
    setStreaming(false);
  };

  return (
    <>
      {/* Floating toggle button (shown only when closed) */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed right-5 bottom-5 z-40 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 bg-red-600 hover:bg-red-700 text-white shadow-red-600/30"
          title="Buka copilot"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* In-flow panel: takes up width when open, pushes main content */}
      <div
        className={`border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
          open ? "w-full sm:w-[400px]" : "w-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold whitespace-nowrap">Copilot</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Siap membantu
            </p>
          </div>
          <button
            onClick={reset}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            title="Mulai ulang percakapan"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 text-sm rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-red-600 text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md"
                }`}
              >
                {m.content}
                {streaming && i === messages.length - 1 && m.role === "assistant" && (
                  <span className="inline-block h-3 w-0.5 ml-0.5 align-middle bg-gray-400 dark:bg-gray-300 animate-pulse" />
                )}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 flex items-center gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${d * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-red-600 dark:text-red-400">
              {error} — pastikan backend berjalan dan file <span className="font-mono">apikey</span> berisi kunci Groq.
            </p>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Tanya sesuatu..."
              className="flex-1 resize-none max-h-32 px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-40"
              title="Kirim"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
            Copilot dapat membuat kesalahan. Tekan Shift+Enter untuk baris baru.
          </p>
        </div>
      </div>
    </>
  );
}

export default ChatPanel;