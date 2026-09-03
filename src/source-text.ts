import type { FollowUpItem } from "./types";

interface SourceLine {
  text: string;
  start: number;
}

export type SourceUpdateResult =
  | { kind: "updated"; content: string; line: number }
  | { kind: "unchanged"; line: number }
  | { kind: "conflict" };

function splitWithOffsets(content: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;

  for (let index = 0; index <= content.length; index += 1) {
    if (index !== content.length && content[index] !== "\n") continue;

    let end = index;
    if (end > start && content[end - 1] === "\r") end -= 1;
    lines.push({ text: content.slice(start, end), start });
    start = index + 1;
  }

  return lines;
}

export function updateCheckboxInSource(
  content: string,
  item: FollowUpItem,
  completed: boolean
): SourceUpdateResult {
  const lines = splitWithOffsets(content);
  let targetLine = -1;

  if (lines[item.line]?.text === item.rawLine) {
    targetLine = item.line;
  } else {
    const matches = lines
      .map((line, index) => (line.text === item.rawLine ? index : -1))
      .filter((index) => index >= 0);

    if (matches.length !== 1) return { kind: "conflict" };
    targetLine = matches[0];
  }

  const target = lines[targetLine];
  const checkboxMatch = target.text.match(/^(\s*(?:>\s*)*[-*+]\s+\[)([ xX])(\])/u);
  if (!checkboxMatch) return { kind: "conflict" };

  const nextState = completed ? "x" : " ";
  if (checkboxMatch[2] === nextState || (completed && checkboxMatch[2] === "X")) {
    return { kind: "unchanged", line: targetLine };
  }

  const stateOffset = target.start + checkboxMatch[1].length;
  const updated = content.slice(0, stateOffset) + nextState + content.slice(stateOffset + 1);
  return { kind: "updated", content: updated, line: targetLine };
}
