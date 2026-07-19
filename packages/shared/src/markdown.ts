/** Bullets under a markdown `## Requirements` heading, up to the next `##` heading.
 *  Used to seed project milestones from the in-app PRD (V2 PRD §3.4). */
export function parseRequirementBullets(markdown: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^##\s+requirements\b/i.test(l.trim()));
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line.trim())) break;
    const m = line.trim().match(/^[-*]\s+(.+)$/);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}
