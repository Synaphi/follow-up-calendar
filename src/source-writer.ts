import { App, MarkdownView, Notice, TFile } from "obsidian";
import { updateCheckboxInSource } from "./source-text";
import type { FollowUpItem } from "./types";

export class SourceWriter {
  constructor(
    private readonly app: App,
    private readonly refreshFile: (file: TFile) => Promise<void>
  ) {}

  async setCompleted(item: FollowUpItem, completed: boolean): Promise<boolean> {
    const abstractFile = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(abstractFile instanceof TFile)) {
      new Notice("원본 파일을 찾을 수 없습니다.");
      return false;
    }

    try {
      const content = await this.app.vault.read(abstractFile);
      const result = updateCheckboxInSource(content, item, completed);

      if (result.kind === "conflict") {
        await this.refreshFile(abstractFile);
        new Notice("원본이 변경되어 다시 불러왔습니다. 한 번 더 눌러 주세요.");
        return false;
      }

      if (result.kind === "unchanged") return true;

      await this.app.vault.modify(abstractFile, result.content);
      await this.refreshFile(abstractFile);
      return true;
    } catch (error) {
      console.error("[Follow-up Calendar] Could not update the source task.", error);
      new Notice("원본 일정을 수정하지 못했습니다.");
      return false;
    }
  }

  async openSource(item: FollowUpItem): Promise<void> {
    const abstractFile = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(abstractFile instanceof TFile)) {
      new Notice("원본 파일을 찾을 수 없습니다.");
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(abstractFile, { active: true });

    if (leaf.view instanceof MarkdownView) {
      const position = { line: item.line, ch: 0 };
      leaf.view.editor.setCursor(position);
      leaf.view.editor.scrollIntoView({ from: position, to: position }, true);
      leaf.view.editor.focus();
    }
  }
}
