import { App, MarkdownView, Notice, TFile } from "obsidian";
import { translate, type UiLanguage } from "./i18n";
import { updateCheckboxInSource } from "./source-text";
import type { FollowUpItem } from "./types";

export class SourceWriter {
  constructor(
    private readonly app: App,
    private readonly refreshFile: (file: TFile) => Promise<void>,
    private readonly getLanguage: () => UiLanguage
  ) {}

  async setCompleted(item: FollowUpItem, completed: boolean): Promise<boolean> {
    const abstractFile = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(abstractFile instanceof TFile)) {
      new Notice(translate(this.getLanguage(), "sourceMissing"));
      return false;
    }

    try {
      const content = await this.app.vault.read(abstractFile);
      const result = updateCheckboxInSource(content, item, completed);

      if (result.kind === "conflict") {
        await this.refreshFile(abstractFile);
        new Notice(translate(this.getLanguage(), "sourceChanged"));
        return false;
      }

      if (result.kind === "unchanged") return true;

      await this.app.vault.modify(abstractFile, result.content);
      await this.refreshFile(abstractFile);
      return true;
    } catch (error) {
      console.error("[Follow-up Calendar] Could not update the source task.", error);
      new Notice(translate(this.getLanguage(), "sourceUpdateFailed"));
      return false;
    }
  }

  async openSource(item: FollowUpItem): Promise<void> {
    const abstractFile = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(abstractFile instanceof TFile)) {
      new Notice(translate(this.getLanguage(), "sourceMissing"));
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
