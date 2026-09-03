import {
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  normalizePath,
  type App
} from "obsidian";
import { FollowUpIndex } from "./indexer";
import { SourceWriter } from "./source-writer";
import type { FollowUpCalendarSettings, WeekStart } from "./types";
import { FollowUpRenderChild } from "./views";

const DEFAULT_SETTINGS: FollowUpCalendarSettings = {
  hubPath: "Follow-up Calendar.md",
  weekStart: "monday",
  showCompleted: false
};

const HUB_TEMPLATE = `---
follow_up_calendar_hub: true
cssclasses: [follow-up-calendar-hub]
---

# Follow-up Calendar

\`\`\`follow-up-calendar
\`\`\`

## List

\`\`\`follow-up-list
\`\`\`
`;

export default class FollowUpCalendarPlugin extends Plugin {
  settings: FollowUpCalendarSettings = DEFAULT_SETTINGS;
  private index!: FollowUpIndex;
  private writer!: SourceWriter;
  private openingHub: Promise<void> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.index = new FollowUpIndex(this.app);
    this.writer = new SourceWriter(this.app, (file) => this.index.reindexFile(file));

    this.addRibbonIcon("calendar-check-2", "Follow-up Calendar", () => {
      void this.openHub();
    }).addClass("follow-up-calendar-ribbon");

    this.addCommand({
      id: "open-follow-up-calendar",
      name: "Open Follow-up Calendar",
      callback: () => void this.openHub()
    });

    this.registerMarkdownCodeBlockProcessor("follow-up-calendar", (source, element, context) => {
      context.addChild(
        new FollowUpRenderChild(
          element,
          this.app,
          "calendar",
          source,
          this.index,
          this.writer,
          () => this.settings
        )
      );
    });

    this.registerMarkdownCodeBlockProcessor("follow-up-list", (source, element, context) => {
      context.addChild(
        new FollowUpRenderChild(
          element,
          this.app,
          "list",
          source,
          this.index,
          this.writer,
          () => this.settings
        )
      );
    });

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") this.index.schedule(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") this.index.schedule(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") this.index.remove(file.path);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.index.rename(file, oldPath);
        }
      })
    );

    this.addSettingTab(new FollowUpCalendarSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => void this.index.scanAll());
  }

  onunload(): void {
    this.index?.dispose();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.index.refreshViews();
  }

  private async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<FollowUpCalendarSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
  }

  private openHub(): Promise<void> {
    if (this.openingHub) return this.openingHub;

    this.openingHub = this.doOpenHub()
      .catch((error) => {
        console.error("[Follow-up Calendar] Could not open the hub note.", error);
        new Notice("Follow-up Calendar 노트를 열지 못했습니다.");
      })
      .finally(() => {
        this.openingHub = null;
      });
    return this.openingHub;
  }

  private async doOpenHub(): Promise<void> {
    let path = normalizePath(this.settings.hubPath.trim() || DEFAULT_SETTINGS.hubPath);
    if (!path.toLowerCase().endsWith(".md")) path += ".md";

    let abstractFile = this.app.vault.getAbstractFileByPath(path);
    if (abstractFile instanceof TFolder) {
      new Notice("허브 경로가 폴더와 겹칩니다. 설정에서 파일 경로를 바꿔 주세요.");
      return;
    }

    if (!abstractFile) {
      await this.ensureParentFolder(path);
      abstractFile = await this.app.vault.create(path, HUB_TEMPLATE);
    }

    if (!(abstractFile instanceof TFile)) return;

    const hubViewState = {
      type: "markdown",
      state: { file: abstractFile.path, mode: "preview", source: false },
      active: true
    };

    const existingLeaf = this.app.workspace
      .getLeavesOfType("markdown")
      .find(
        (leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === abstractFile.path
      );

    if (existingLeaf) {
      await existingLeaf.setViewState(hubViewState);
      this.app.workspace.revealLeaf(existingLeaf);
      return;
    }

    await this.app.workspace.getLeaf("tab").setViewState(hubViewState);
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const parts = path.split("/");
    parts.pop();
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFile) throw new Error(`${current} is a file.`);
      if (!existing) await this.app.vault.createFolder(current);
    }
  }
}

class FollowUpCalendarSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: FollowUpCalendarPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Follow-up Calendar").setHeading();

    new Setting(containerEl)
      .setName("허브 노트 경로")
      .setDesc("리본 아이콘이 여는 Markdown 파일입니다.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.hubPath)
          .setValue(this.plugin.settings.hubPath)
          .onChange(async (value) => {
            this.plugin.settings.hubPath = value.trim() || DEFAULT_SETTINGS.hubPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("주 시작 요일")
      .setDesc("달력의 첫 번째 요일입니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("monday", "월요일")
          .addOption("sunday", "일요일")
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            this.plugin.settings.weekStart = value as WeekStart;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("완료 일정 기본 표시")
      .setDesc("달력과 리스트를 처음 열 때 완료 항목도 표시합니다.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showCompleted).onChange(async (value) => {
          this.plugin.settings.showCompleted = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
