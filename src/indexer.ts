import { App, TFile, getAllTags } from "obsidian";
import { parseFollowUps, shouldIndexPath } from "./parser";
import type { FollowUpItem } from "./types";

type IndexListener = () => void;

export class FollowUpIndex {
  private readonly byPath = new Map<string, FollowUpItem[]>();
  private readonly listeners = new Set<IndexListener>();
  private readonly pending = new Map<string, number>();
  private disposed = false;

  constructor(private readonly app: App) {}

  async scanAll(): Promise<void> {
    if (this.disposed) return;
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => shouldIndexPath(file.path))
      .filter((file) => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return true;
        return getAllTags(cache)?.includes("#follow-up") ?? false;
      });

    for (let offset = 0; offset < files.length; offset += 8) {
      if (this.disposed) return;
      const batch = files.slice(offset, offset + 8);
      await Promise.all(batch.map((file) => this.reindexFile(file, false)));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    if (!this.disposed) this.emit();
  }

  schedule(file: TFile): void {
    if (this.disposed || !shouldIndexPath(file.path)) return;

    const existing = this.pending.get(file.path);
    if (existing !== undefined) window.clearTimeout(existing);

    const scheduledPath = file.path;
    const timer = window.setTimeout(() => {
      this.pending.delete(scheduledPath);
      void this.reindexFile(file);
    }, 150);
    this.pending.set(file.path, timer);
  }

  async reindexFile(file: TFile, notify = true): Promise<void> {
    if (this.disposed || file.extension !== "md" || !shouldIndexPath(file.path)) return;

    try {
      const content = await this.app.vault.read(file);
      if (this.disposed) return;

      const next = parseFollowUps(content, file.path);
      const previous = this.byPath.get(file.path) ?? [];
      if (JSON.stringify(previous) === JSON.stringify(next)) return;

      if (next.length === 0) this.byPath.delete(file.path);
      else this.byPath.set(file.path, next);
      if (notify) this.emit();
    } catch (error) {
      console.error(`[Follow-up Calendar] Could not index ${file.path}.`, error);
    }
  }

  remove(path: string): void {
    const timer = this.pending.get(path);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.pending.delete(path);
    }

    if (this.byPath.delete(path)) this.emit();
  }

  async rename(file: TFile, oldPath: string): Promise<void> {
    const timer = this.pending.get(oldPath);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.pending.delete(oldPath);
    }

    const hadOldItems = this.byPath.delete(oldPath);
    await this.reindexFile(file, false);
    if (hadOldItems || this.byPath.has(file.path)) this.emit();
  }

  getItems(): FollowUpItem[] {
    return [...this.byPath.values()].flat();
  }

  subscribe(listener: IndexListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  refreshViews(): void {
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.pending.values()) window.clearTimeout(timer);
    this.pending.clear();
    this.listeners.clear();
    this.byPath.clear();
  }

  private emit(): void {
    if (this.disposed) return;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error("[Follow-up Calendar] Could not refresh a view.", error);
      }
    }
  }
}
