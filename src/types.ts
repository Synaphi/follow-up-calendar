export type WeekStart = "monday" | "sunday";
export type LanguagePreference = "auto" | "en" | "ko";

export interface FollowUpItem {
  id: string;
  filePath: string;
  line: number;
  rawLine: string;
  title: string;
  projectTag?: string;
  date: string;
  completed: boolean;
}

export interface FollowUpCalendarSettings {
  hubPath: string;
  weekStart: WeekStart;
  showCompleted: boolean;
  language: LanguagePreference;
}

export interface FollowUpBlockOptions {
  weekStart?: WeekStart;
  showCompleted?: boolean;
}

export function sortNearestFirst(
  items: readonly FollowUpItem[],
  today: string
): FollowUpItem[] {
  return [...items].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    const leftUpcoming = left.date >= today;
    const rightUpcoming = right.date >= today;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;

    const dateOrder = leftUpcoming
      ? left.date.localeCompare(right.date)
      : right.date.localeCompare(left.date);
    if (dateOrder !== 0) return dateOrder;

    const titleOrder = left.title.localeCompare(right.title, "ko");
    if (titleOrder !== 0) return titleOrder;

    const pathOrder = left.filePath.localeCompare(right.filePath, "ko");
    if (pathOrder !== 0) return pathOrder;

    return left.line - right.line;
  });
}
