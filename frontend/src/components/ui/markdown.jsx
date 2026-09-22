import React from "react";

export function cleanThinking(text) {
  if (!text) return text;
  let out = text
    .replace(/(?:\r?\n)?\s*thinking\s*\r?\n[\s\S]*?\r?\n\s*response\s*(?:\r?\n)?/g, "\n\n")
    .replace(/<\s*thinking\b[\s\S]*?<\/\s*thinking\s*>/gi, "\n\n")
    .replace(/<\s*think\b[\s\S]*?<\/\s*think\s*>/gi, "\n\n")
    .replace(/```\s*thinking[\s\S]*?```/gi, "\n\n");
  if (
    /^\s*(thinking|<\s*thinking)/.test(out) &&
    !/(response\s*\r?\n|<\/\s*thinking)/.test(out)
  ) {
    out = "";
  }
  return out.trim();
}

const TOKEN_RE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]*\]\([^)\s]+\))/g;

function inline(text) {
  const parts = String(text).split(TOKEN_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^__[^_]+__$/.test(part))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^_[^_]+_$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part))
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-gray-900/10 dark:bg-gray-700/60 font-mono text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    const link = part.match(/^\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (link)
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-red-600 dark:text-red-400 underline break-all"
        >
          {link[1]}
        </a>
      );
    return part;
  });
}

function parseRow(line) {
  const cells = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
  return cells.map((c) => c.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-+:?\s*(\||$)/.test(line);
}

function renderTable(rows, key) {
  const header = parseRow(rows[0]);
  if (rows[1] && isTableSeparator(rows[1])) {
    rows = rows.slice(2);
  } else {
    rows = rows.slice(1);
  }
  const body = rows.filter((r) => r.trim() && !isTableSeparator(r));
  return (
    <table
      key={key}
      className="my-2 w-full border-collapse overflow-hidden rounded-lg text-[12px]"
    >
      <thead>
        <tr>
          {header.map((h, i) => (
            <th
              key={i}
              className="border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 text-left font-semibold"
            >
              {inline(h)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((r, i) => (
          <tr key={i}>
            {parseRow(r).map((c, j) => (
              <td key={j} className="border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                {inline(c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const Markdown = ({ text }) => {
  const lines = String(text ?? "").split("\n");
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        code.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <pre
          key={nodes.length}
          className="my-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-[12px] text-gray-100 dark:bg-gray-950"
        >
          <code>{code.join("\n").trim()}</code>
        </pre>
      );
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      nodes.push(
        <h3 key={nodes.length} className="mt-3 mb-1 text-sm font-bold">
          {inline(trimmed.replace(/^#{1,6}\s*/, ""))}
        </h3>
      );
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^[-*•]\s+/.test(lines[j].trim())) {
        items.push(lines[j].replace(/^[-*•]\s+/, ""));
        j++;
      }
      nodes.push(
        <ul key={nodes.length} className="my-2 list-disc space-y-1 pl-5">
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^\d+[.)]\s+/.test(lines[j].trim())) {
        items.push(lines[j].replace(/^\d+[.)]\s+/, ""));
        j++;
      }
      nodes.push(
        <ol key={nodes.length} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </ol>
      );
      i = j;
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      const table = [];
      let j = i;
      while (j < lines.length && /^\s*\|.+\|\s*$/.test(lines[j])) {
        table.push(lines[j]);
        j++;
      }
      nodes.push(renderTable(table, nodes.length));
      i = j;
      continue;
    }

    if (/^>/.test(trimmed)) {
      const quote = [];
      let j = i;
      while (j < lines.length && /^>/.test(lines[j].trim())) {
        quote.push(lines[j].replace(/^>\s?/, ""));
        j++;
      }
      nodes.push(
        <blockquote
          key={nodes.length}
          className="my-2 border-l-4 border-gray-300 pl-3 italic text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          {inline(quote.join(" "))}
        </blockquote>
      );
      i = j;
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(trimmed)) {
      nodes.push(
        <hr key={nodes.length} className="my-3 border-gray-200 dark:border-gray-700" />
      );
      i++;
      continue;
    }

    const para = [];
    let j = i;
    while (
      j < lines.length &&
      lines[j].trim() &&
      !/^#{1,6}\s+/.test(lines[j].trim()) &&
      !/^\s*\|.+\|\s*$/.test(lines[j]) &&
      !/^```/.test(lines[j].trim()) &&
      !/^[-*•]\s+/.test(lines[j].trim()) &&
      !/^\d+[.)]\s+/.test(lines[j].trim())
    ) {
      para.push(lines[j].trim());
      j++;
    }
    nodes.push(
      <p key={nodes.length} className="my-1.5">
        {inline(para.join(" "))}
      </p>
    );
    i = j;
  }

  return <>{nodes}</>;
};

export default Markdown;