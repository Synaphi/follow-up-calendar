import type { FollowUpItem } from "./types";

const CHECKBOX_PATTERN = /^(\s*(?:>\s*)*[-*+]\s+\[)([ xX])(\]\s+)(.*)$/u;
const DATE_PATTERN = /📅\s*(\d{4})-(\d{2})-(\d{2})/gu;
const FOLLOW_UP_TAG_PATTERN = /(?:^|\s)#follow-up(?=$|\s|[.,;:!?()[\]{}])/u;
const FOLLOW_UP_TAG_REMOVE_PATTERN = /(?:^|\s)#follow-up(?=$|\s|[.,;:!?()[\]{}])/gu;
const ANY_TAG_PATTERN = /(?:^|\s)#([\p{L}\p{N}_-]+)(?=$|\s|[.,;:!?()[\]{}])/gu;

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function isValidDate(yearText: string, monthText: string, dayText: string): boolean {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function stripHtmlComments(line: string, state: { inComment: boolean }): string {
  let remaining = line;
  let visible = "";

  while (remaining.length > 0) {
    if (state.inComment) {
      const end = remaining.indexOf("-->");
      if (end < 0) return visible;
      remaining = remaining.slice(end + 3);
      state.inComment = false;
      continue;
    }

    const start = remaining.indexOf("<!--");
    if (start < 0) return visible + remaining;

    visible += remaining.slice(0, start);
    remaining = remaining.slice(start + 4);
    state.inComment = true;
  }

  return visible;
}

function normalizeTitle(body: string): string {
  return body
    .replace(DATE_PATTERN, " ")
    .replace(FOLLOW_UP_TAG_REMOVE_PATTERN, " ")
    .replace(ANY_TAG_PATTERN, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/gu, "$2")
    .replace(/\[\[([^\]]+)\]\]/gu, (_match, target: string) => {
      return target.split("/").pop() ?? target;
    })
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/\*\*|__|~~|`/gu, "")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

function findProjectTag(body: string): string | undefined {
  for (const match of body.matchAll(ANY_TAG_PATTERN)) {
    const tag = match[1];
    if (tag !== "follow-up") return tag;
  }
  return undefined;
}

export function parseFollowUpLine(
  visibleLine: string,
  rawLine: string,
  filePath: string,
  line: number
): FollowUpItem | null {
  const rawCheckboxMatch = rawLine.match(CHECKBOX_PATTERN);
  if (!rawCheckboxMatch) return null;

  const checkboxMatch = visibleLine.match(CHECKBOX_PATTERN);
  if (!checkboxMatch) return null;

  const body = checkboxMatch[4];
  if (!FOLLOW_UP_TAG_PATTERN.test(body)) return null;

  const dateMatches = [...body.matchAll(DATE_PATTERN)];
  if (dateMatches.length === 0) return null;

  const dateMatch = dateMatches[0];
  if (!isValidDate(dateMatch[1], dateMatch[2], dateMatch[3])) return null;

  if (dateMatches.length > 1) {
    console.warn(
      `[Follow-up Calendar] Multiple calendar dates in ${filePath}:${line + 1}; using the first one.`
    );
  }

  const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  const title = normalizeTitle(body);
  if (title.length === 0) return null;

  return {
    id: `${filePath}:${line}:${hash(rawLine)}`,
    filePath,
    line,
    rawLine,
    title,
    projectTag: findProjectTag(body),
    date,
    completed: rawCheckboxMatch[2].toLowerCase() === "x"
  };
}

export function parseFollowUps(content: string, filePath: string): FollowUpItem[] {
  const lines = content.split(/\r?\n/u);
  const items: FollowUpItem[] = [];
  const commentState = { inComment: false };
  let inFrontmatter = lines.length > 0 && lines[0].trim() === "---";
  let fenceCharacter: "`" | "~" | null = null;
  let fenceLength = 0;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const rawLine = lines[lineNumber];

    if (inFrontmatter) {
      if (lineNumber > 0 && rawLine.trim() === "---") inFrontmatter = false;
      continue;
    }

    const fenceCandidate = rawLine.replace(/^\s*(?:>\s*)+/u, "");

    if (fenceCharacter) {
      const trimmed = fenceCandidate.trim();
      const closesFence =
        trimmed.length >= fenceLength &&
        [...trimmed].every((character) => character === fenceCharacter);
      if (closesFence) {
        fenceCharacter = null;
        fenceLength = 0;
      }
      continue;
    }

    const fenceMatch = fenceCandidate.match(/^\s*(`{3,}|~{3,})/u);
    if (fenceMatch) {
      fenceCharacter = fenceMatch[1][0] as "`" | "~";
      fenceLength = fenceMatch[1].length;
      continue;
    }

    const visibleLine = stripHtmlComments(rawLine, commentState);
    const item = parseFollowUpLine(visibleLine, rawLine, filePath, lineNumber);
    if (item) items.push(item);
  }

  return items;
}

export function shouldIndexPath(filePath: string): boolean {
  return !/(^|\/)(?:node_modules|\.git|\.obsidian)(?:\/|$)/u.test(filePath);
}
