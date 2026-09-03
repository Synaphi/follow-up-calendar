import { describe, expect, it, vi } from "vitest";
import { parseFollowUps, shouldIndexPath } from "../src/parser";

describe("parseFollowUps", () => {
  it("accepts only tasks with both the calendar marker and exact follow-up tag", () => {
    const content = [
      "- [ ] Alpha · valid 📅 2026-09-13 #follow-up #alpha",
      "- [ ] date only 📅 2026-09-14 #alpha",
      "- [ ] tag only #follow-up #alpha",
      "- [ ] bare date 2026-09-15 #follow-up #alpha",
      "- [ ] wrong tag 📅 2026-09-16 #follow-up-later"
    ].join("\n");

    const items = parseFollowUps(content, "Tasks.md");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      date: "2026-09-13",
      title: "Alpha · valid",
      projectTag: "alpha",
      completed: false
    });
  });

  it("supports bullet variants and completed tasks", () => {
    const content = [
      "* [x] Complete 📅 2026-09-13 #follow-up",
      "+ [X] Also complete 📅 2026-09-14 #follow-up",
      "> - [ ] Quoted 📅 2026-09-15 #follow-up"
    ].join("\n");

    const items = parseFollowUps(content, "Tasks.md");
    expect(items.map((item) => item.completed)).toEqual([true, true, false]);
  });

  it("skips frontmatter, fenced code blocks, and HTML comments", () => {
    const content = [
      "---",
      "sample: - [ ] Frontmatter 📅 2026-09-11 #follow-up",
      "---",
      "```markdown",
      "- [ ] Fenced 📅 2026-09-12 #follow-up",
      "```",
      "<!--",
      "- [ ] Commented 📅 2026-09-13 #follow-up",
      "-->",
      "- [ ] Visible 📅 2026-09-14 #follow-up"
    ].join("\n");

    const items = parseFollowUps(content, "Tasks.md");
    expect(items.map((item) => item.title)).toEqual(["Visible"]);
  });

  it("skips fenced examples inside blockquotes", () => {
    const content = [
      "> ```markdown",
      "> - [ ] Fenced 📅 2026-09-12 #follow-up",
      "> ```",
      "> - [ ] Visible 📅 2026-09-14 #follow-up"
    ].join("\n");

    const items = parseFollowUps(content, "Tasks.md");
    expect(items.map((item) => item.title)).toEqual(["Visible"]);
  });

  it("validates real calendar dates including leap years", () => {
    const content = [
      "- [ ] Leap 📅 2028-02-29 #follow-up",
      "- [ ] Not leap 📅 2027-02-29 #follow-up",
      "- [ ] Bad day 📅 2026-02-30 #follow-up",
      "- [ ] Bad month 📅 2026-13-01 #follow-up"
    ].join("\n");

    expect(parseFollowUps(content, "Tasks.md").map((item) => item.title)).toEqual(["Leap"]);
  });

  it("uses the first marked date and warns when a line has more than one", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const content =
      "- [ ] Multiple 📅 2026-09-13 then 📅 2026-09-14 #follow-up #alpha";

    const items = parseFollowUps(content, "Tasks.md");
    expect(items[0].date).toBe("2026-09-13");
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("keeps the list concise by removing common Markdown decoration", () => {
    const content =
      "- [ ] **Project** · [[Folder/Source|review]] [report](https://example.com) `soon` 📅 2026-09-13 #follow-up #alpha";

    const items = parseFollowUps(content, "Tasks.md");
    expect(items[0].title).toBe("Project · review report soon");
  });
});

describe("shouldIndexPath", () => {
  it("ignores development and Obsidian internals", () => {
    expect(shouldIndexPath("Notes/Tasks.md")).toBe(true);
    expect(shouldIndexPath("Project/node_modules/pkg/README.md")).toBe(false);
    expect(shouldIndexPath("Project/.git/description.md")).toBe(false);
    expect(shouldIndexPath(".obsidian/plugins/example/README.md")).toBe(false);
  });
});
