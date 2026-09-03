import {
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  moment,
  normalizePath,
  type App
} from "obsidian";
import { resolveLanguage, translate, type UiLanguage } from "./i18n";
import { FollowUpIndex } from "./indexer";
import { SourceWriter } from "./source-writer";
import type { FollowUpCalendarSettings, LanguagePreference, WeekStart } from "./types";
import { FollowUpRenderChild } from "./views";

const DEFAULT_SETTINGS: FollowUpCalendarSettings = {
  hubPath: "Follow-up Calendar.md",
  weekStart: "monday",
  showCompleted: false,
  language: "auto"
};

const HUB_TEMPLATE = `---
follow_up_calendar_hub: true
cssclasses: [follow-up-calendar-hub]
---

\`\`\`follow-up-calendar
\`\`\`

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
    this.writer = new SourceWriter(
      this.app,
      (file) => this.index.reindexFile(file),
      () => this.language
    );

    this.addRibbonIcon("calendar-check-2", translate(this.language, "calendarTitle"), () => {
      void this.openHub();
    }).addClass("follow-up-calendar-ribbon");

    this.addCommand({
      id: "open-follow-up-calendar",
      name: translate(this.language, "openCommand"),
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
          () => this.settings,
          () => this.language
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
          () => this.settings,
          () => this.language
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

  get language(): UiLanguage {
    return resolveLanguage(this.settings.language, moment.locale());
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
        new Notice(translate(this.language, "hubOpenFailed"));
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
      new Notice(translate(this.language, "hubFolderConflict"));
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
    const language = this.plugin.language;
    containerEl.empty();
    new Setting(containerEl).setName("Follow-up Calendar").setHeading();

    new Setting(containerEl)
      .setName(translate(language, "language"))
      .setDesc(translate(language, "languageDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", translate(language, "automatic"))
          .addOption("ko", translate(language, "korean"))
          .addOption("en", translate(language, "english"))
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as LanguagePreference;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(translate(language, "hubPath"))
      .setDesc(translate(language, "hubPathDesc"))
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
      .setName(translate(language, "weekStart"))
      .setDesc(translate(language, "weekStartDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("monday", translate(language, "monday"))
          .addOption("sunday", translate(language, "sunday"))
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            this.plugin.settings.weekStart = value as WeekStart;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(translate(language, "showCompletedDefault"))
      .setDesc(translate(language, "showCompletedDefaultDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showCompleted).onChange(async (value) => {
          this.plugin.settings.showCompleted = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
