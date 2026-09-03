import { App, MarkdownRenderChild, Modal, Notice } from "obsidian";
import { FollowUpIndex } from "./indexer";
import { SourceWriter } from "./source-writer";
import {
  sortNewestFirst,
  type FollowUpBlockOptions,
  type FollowUpCalendarSettings,
  type FollowUpItem,
  type WeekStart
} from "./types";

type ViewKind = "calendar" | "list";

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBoolean(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function parseBlockOptions(source: string): FollowUpBlockOptions {
  const options: FollowUpBlockOptions = {};

  for (const line of source.split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().toLowerCase();
    if (key === "weekStart" && (value === "monday" || value === "sunday")) {
      options.weekStart = value;
    }
    if (key === "showCompleted") {
      options.showCompleted = parseBoolean(value);
    }
  }

  return options;
}

function sourceName(item: FollowUpItem): string {
  const name = item.filePath.split("/").pop() ?? item.filePath;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

class CopyFallbackModal extends Modal {
  constructor(app: App, private readonly value: string) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("라이브 달력 블록 복사");
    const textarea = this.contentEl.createEl("textarea", {
      cls: "follow-up-calendar-copy-fallback"
    });
    textarea.value = this.value;
    textarea.setAttr("readonly", "true");
    textarea.focus();
    textarea.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FollowUpRenderChild extends MarkdownRenderChild {
  private unsubscribe: (() => void) | undefined;
  private readonly options: FollowUpBlockOptions;
  private showCompleted: boolean;
  private currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  private readonly expandedDates = new Set<string>();

  constructor(
    containerEl: HTMLElement,
    private readonly app: App,
    private readonly kind: ViewKind,
    source: string,
    private readonly index: FollowUpIndex,
    private readonly writer: SourceWriter,
    private readonly getSettings: () => FollowUpCalendarSettings
  ) {
    super(containerEl);
    this.options = parseBlockOptions(source);
    this.showCompleted = this.options.showCompleted ?? getSettings().showCompleted;
  }

  onload(): void {
    this.unsubscribe = this.index.subscribe(() => this.render());
    this.render();
  }

  onunload(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.containerEl.empty();
  }

  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass("follow-up-calendar-root");

    if (this.kind === "calendar") this.renderCalendar();
    else this.renderList();
  }

  private visibleItems(): FollowUpItem[] {
    const items = this.index.getItems();
    return this.showCompleted ? items : items.filter((item) => !item.completed);
  }

  private renderCalendar(): void {
    const settings = this.getSettings();
    const weekStart = this.options.weekStart ?? settings.weekStart;
    const wrapper = this.containerEl.createDiv("follow-up-calendar");
    const header = wrapper.createDiv("follow-up-calendar-header");
    const navigation = header.createDiv("follow-up-calendar-navigation");

    this.createButton(navigation, "‹", "이전 달", () => this.changeMonth(-1));
    const monthLabel = navigation.createEl("strong", { cls: "follow-up-calendar-month" });
    monthLabel.setText(
      new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(
        this.currentMonth
      )
    );
    this.createButton(navigation, "›", "다음 달", () => this.changeMonth(1));
    this.createButton(navigation, "오늘", "이번 달로 이동", () => {
      const now = new Date();
      this.currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.render();
    });

    const actions = header.createDiv("follow-up-calendar-actions");
    this.createButton(
      actions,
      this.showCompleted ? "완료 숨김" : "완료 표시",
      "완료 일정 표시 전환",
      () => {
        this.showCompleted = !this.showCompleted;
        this.render();
      }
    );
    this.createButton(actions, "복사", "라이브 달력 블록 복사", () => {
      void this.copyCalendarBlock(weekStart);
    });

    const grid = wrapper.createDiv("follow-up-calendar-grid");
    const weekdayLabels =
      weekStart === "monday"
        ? ["월", "화", "수", "목", "금", "토", "일"]
        : ["일", "월", "화", "수", "목", "금", "토"];

    for (const label of weekdayLabels) {
      grid.createDiv({ cls: "follow-up-calendar-weekday", text: label });
    }

    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const leadingDays = weekStart === "monday" ? (firstWeekday + 6) % 7 : firstWeekday;
    const firstCell = new Date(year, month, 1 - leadingDays);
    const today = formatDateKey(new Date());
    const byDate = new Map<string, FollowUpItem[]>();

    for (const item of this.visibleItems()) {
      const existing = byDate.get(item.date) ?? [];
      existing.push(item);
      byDate.set(item.date, existing);
    }

    for (let offset = 0; offset < 42; offset += 1) {
      const date = new Date(
        firstCell.getFullYear(),
        firstCell.getMonth(),
        firstCell.getDate() + offset
      );
      const dateKey = formatDateKey(date);
      const cell = grid.createDiv("follow-up-calendar-day");
      if (date.getMonth() !== month) cell.addClass("is-outside-month");
      if (dateKey === today) cell.addClass("is-today");

      cell.createDiv({ cls: "follow-up-calendar-day-number", text: String(date.getDate()) });
      const dayItems = (byDate.get(dateKey) ?? []).sort((left, right) =>
        left.title.localeCompare(right.title, "ko")
      );
      const expanded = this.expandedDates.has(dateKey);
      const shown = expanded ? dayItems : dayItems.slice(0, 3);

      for (const item of shown) this.renderCalendarItem(cell, item, today);

      if (!expanded && dayItems.length > 3) {
        this.createButton(cell, `+${dayItems.length - 3}`, "모두 표시", () => {
          this.expandedDates.add(dateKey);
          this.render();
        }, "follow-up-calendar-more");
      }
    }
  }

  private renderList(): void {
    const wrapper = this.containerEl.createDiv("follow-up-list");
    const header = wrapper.createDiv("follow-up-list-header");
    header.createEl("strong", { text: "일정 목록" });
    header.createSpan({ cls: "follow-up-list-order", text: "최신 날짜순" });
    this.createButton(
      header,
      this.showCompleted ? "완료 숨김" : "완료 표시",
      "완료 일정 표시 전환",
      () => {
        this.showCompleted = !this.showCompleted;
        this.render();
      }
    );

    const items = sortNewestFirst(this.visibleItems());
    if (items.length === 0) {
      wrapper.createDiv({
        cls: "follow-up-calendar-empty",
        text: "표시할 후속 일정이 없습니다."
      });
      return;
    }

    const today = formatDateKey(new Date());
    const rows = wrapper.createDiv("follow-up-list-rows");
    for (const item of items) this.renderListItem(rows, item, today);
  }

  private renderCalendarItem(parent: HTMLElement, item: FollowUpItem, today: string): void {
    const row = parent.createDiv("follow-up-calendar-item");
    if (item.completed) row.addClass("is-completed");
    if (!item.completed && item.date < today) row.addClass("is-overdue");
    this.addCheckbox(row, item);
    this.addSourceButton(row, item, item.title);
  }

  private renderListItem(parent: HTMLElement, item: FollowUpItem, today: string): void {
    const row = parent.createDiv("follow-up-list-item");
    if (item.completed) row.addClass("is-completed");
    if (!item.completed && item.date < today) row.addClass("is-overdue");

    this.addCheckbox(row, item);
    row.createSpan({ cls: "follow-up-list-date", text: item.date });
    const content = row.createDiv("follow-up-list-content");
    this.addSourceButton(content, item, item.title);
    content.createSpan({ cls: "follow-up-list-source", text: sourceName(item) });
  }

  private addCheckbox(parent: HTMLElement, item: FollowUpItem): void {
    const checkbox = parent.createEl("input", {
      cls: "follow-up-calendar-checkbox",
      attr: { type: "checkbox", "aria-label": `${item.title} 완료 상태` }
    });
    checkbox.checked = item.completed;
    checkbox.addEventListener("change", () => {
      const requested = checkbox.checked;
      checkbox.disabled = true;
      void this.writer.setCompleted(item, requested).then((success) => {
        if (checkbox.isConnected) {
          if (!success) checkbox.checked = !requested;
          checkbox.disabled = false;
        }
      });
    });
  }

  private addSourceButton(parent: HTMLElement, item: FollowUpItem, label: string): void {
    const button = parent.createEl("button", {
      cls: "follow-up-calendar-source-button",
      text: label,
      attr: { title: `${item.filePath}:${item.line + 1}` }
    });
    button.addEventListener("click", () => void this.writer.openSource(item));
  }

  private createButton(
    parent: HTMLElement,
    text: string,
    label: string,
    action: () => void,
    className = "follow-up-calendar-button"
  ): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls: className,
      text,
      attr: { type: "button", "aria-label": label, title: label }
    });
    button.addEventListener("click", action);
    return button;
  }

  private changeMonth(delta: number): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + delta,
      1
    );
    this.render();
  }

  private async copyCalendarBlock(weekStart: WeekStart): Promise<void> {
    const value = [
      "```follow-up-calendar",
      `weekStart: ${weekStart}`,
      `showCompleted: ${this.showCompleted}`,
      "```"
    ].join("\n");

    try {
      await navigator.clipboard.writeText(value);
      new Notice("라이브 달력 블록을 복사했습니다.");
    } catch {
      new CopyFallbackModal(this.app, value).open();
    }
  }
}
