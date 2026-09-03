import { describe, expect, it } from "vitest";
import { updateCheckboxInSource } from "../src/source-text";
import type { FollowUpItem } from "../src/types";

const rawLine = "- [ ] Alpha · verify 📅 2026-09-13 #follow-up #alpha";
const item: FollowUpItem = {
  id: "id",
  filePath: "Tasks.md",
  line: 1,
  rawLine,
  title: "Alpha · verify",
  projectTag: "alpha",
  date: "2026-09-13",
  completed: false
};

describe("updateCheckboxInSource", () => {
  it("changes only the checkbox state character", () => {
    const content = `before\r\n${rawLine}\r\nafter\r\n`;
    const result = updateCheckboxInSource(content, item, true);

    expect(result.kind).toBe("updated");
    if (result.kind === "updated") {
      expect(result.content).toBe(content.replace("- [ ]", "- [x]"));
      expect(result.content.length).toBe(content.length);
    }
  });

  it("finds a uniquely moved source line", () => {
    const content = `new first line\nmore\n${rawLine}\n`;
    const result = updateCheckboxInSource(content, item, true);

    expect(result.kind).toBe("updated");
    if (result.kind === "updated") expect(result.line).toBe(2);
  });

  it("refuses an ambiguous moved source line", () => {
    const content = `new first line\n${rawLine}\n${rawLine}\n`;
    const result = updateCheckboxInSource(content, { ...item, line: 9 }, true);
    expect(result).toEqual({ kind: "conflict" });
  });

  it("does not write when the requested state is already present", () => {
    const completedLine = rawLine.replace("- [ ]", "- [x]");
    const result = updateCheckboxInSource(
      completedLine,
      { ...item, line: 0, rawLine: completedLine, completed: true },
      true
    );
    expect(result).toEqual({ kind: "unchanged", line: 0 });
  });
});
