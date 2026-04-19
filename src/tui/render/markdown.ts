// Render markdown to a string using blessed tag syntax ({bold}, {cyan-fg}, etc.)
// Keep it small and predictable; trade fidelity for zero deps.

export function escapeBlessed(s: string): string {
  return s.replace(/[{}]/g, (c) => (c === "{" ? "{open}" : "{close}"));
}

export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inFence = false;
  let fenceBuf: string[] = [];

  const flushFence = (): void => {
    if (fenceBuf.length === 0) return;
    out.push("{gray-fg}" + escapeBlessed(fenceBuf.join("\n")) + "{/}");
    fenceBuf = [];
  };

  for (const raw of lines) {
    if (/^```/.test(raw)) {
      if (inFence) { flushFence(); inFence = false; }
      else { inFence = true; }
      continue;
    }
    if (inFence) { fenceBuf.push(raw); continue; }

    const line = raw;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = escapeBlessed(h[2]);
      const color = level === 1 ? "yellow" : level === 2 ? "cyan" : "white";
      out.push(`{bold}{${color}-fg}${text}{/}{/bold}`);
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      out.push("{gray-fg}" + "─".repeat(60) + "{/}");
      continue;
    }
    const bq = /^>\s?(.*)$/.exec(line);
    if (bq) { out.push("{gray-fg}│ " + renderInline(bq[1]) + "{/}"); continue; }
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) { out.push(bullet[1] + "• " + renderInline(bullet[2])); continue; }
    const num = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (num) { out.push(`${num[1]}${num[2]}. ` + renderInline(num[3])); continue; }
    out.push(renderInline(line));
  }
  if (inFence) flushFence();
  return out.join("\n");
}

function renderInline(s: string): string {
  // Escape braces first, then apply tag substitutions.
  let t = escapeBlessed(s);
  t = t.replace(/`([^`]+)`/g, "{cyan-fg}$1{/}");
  t = t.replace(/\*\*([^*]+)\*\*/g, "{bold}$1{/bold}");
  return t;
}
