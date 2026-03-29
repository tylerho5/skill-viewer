const FM_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

export function parseFrontmatter(content: string): Record<string, string> {
  content = content.replace(/\r\n/g, "\n");
  const match = content.match(FM_REGEX);
  if (!match) return {};

  const result: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of match[1].split("\n")) {
    const isContinuation = /^\s+/.test(line) || (lastKey !== null && line.indexOf(":") === -1);
    if (isContinuation && lastKey !== null) {
      result[lastKey] = result[lastKey] + "\n" + line.trimEnd();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key === "") continue;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
    lastKey = key;
  }
  return result;
}

export function extractFrontmatterRaw(content: string): string {
  const match = content.match(FM_REGEX);
  return match ? match[1] : "";
}

export function stripFrontmatter(content: string): string {
  return content.replace(FM_REGEX, "");
}
