import type { SkillSummary } from "../../types.js";

export function ageLabel(ageDays: number): { text: string; color: "green" | "yellow" | "red" } {
  const d = Math.round(ageDays);
  const text = d === 0 ? "today" : d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${Math.round(d / 365)}y`;
  const color = ageDays <= 7 ? "green" : ageDays <= 30 ? "yellow" : "red";
  return { text, color };
}

export function renderBadgeRow(skill: SkillSummary): string {
  const parts: string[] = [];
  if (skill.health) {
    const a = ageLabel(skill.health.ageDays);
    parts.push(`{${a.color}-fg}${a.text}{/}`);
    if (skill.health.wordCount > 500) parts.push(`{gray-fg}${skill.health.wordCount}w{/}`);
    if (skill.health.completenessGaps.includes("no-examples")) parts.push("{red-fg}no examples{/}");
  }
  return parts.join(" · ");
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
