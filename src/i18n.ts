import type { LanguagePreference } from "./types";

export type UiLanguage = "en" | "ko";

const EN = {
  calendarTitle: "Follow-up Calendar",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  today: "Today",
  showCompleted: "Show completed",
  hideCompleted: "Hide completed",
  copy: "Copy",
  copyCalendar: "Copy live calendar block",
  completedVisibility: "Toggle completed follow-ups",
  more: "more",
  scheduleList: "Follow-up list",
  nearestFirst: "Nearest upcoming first",
  noItems: "No follow-ups to show.",
  taskStatus: "completion status",
  copyFallbackTitle: "Copy live calendar block",
  copySuccess: "Live calendar block copied.",
  sourceMissing: "The source note could not be found.",
  sourceChanged: "The source changed and was reloaded. Please try again.",
  sourceUpdateFailed: "The source follow-up could not be updated.",
  hubOpenFailed: "The Follow-up Calendar note could not be opened.",
  hubFolderConflict: "The hub path points to a folder. Choose a Markdown file path in settings.",
  hubPath: "Hub note path",
  hubPathDesc: "The Markdown note opened from the ribbon icon.",
  weekStart: "First day of week",
  weekStartDesc: "Choose the first weekday in the calendar.",
  monday: "Monday",
  sunday: "Sunday",
  showCompletedDefault: "Show completed by default",
  showCompletedDefaultDesc: "Include completed follow-ups when a view first opens.",
  language: "Language",
  languageDesc: "Follow Obsidian automatically or choose a display language.",
  automatic: "Automatic",
  korean: "한국어",
  english: "English",
  openCommand: "Open Follow-up Calendar",
  itemCount: "follow-ups"
} as const;

export type MessageKey = keyof typeof EN;

const KO: Record<MessageKey, string> = {
  calendarTitle: "후속 일정",
  previousMonth: "이전 달",
  nextMonth: "다음 달",
  today: "오늘",
  showCompleted: "완료 표시",
  hideCompleted: "완료 숨기기",
  copy: "복사",
  copyCalendar: "실시간 달력 블록 복사",
  completedVisibility: "완료한 후속 일정 표시 전환",
  more: "개 더보기",
  scheduleList: "후속 일정 목록",
  nearestFirst: "가까운 예정일순",
  noItems: "표시할 후속 일정이 없습니다.",
  taskStatus: "완료 상태",
  copyFallbackTitle: "실시간 달력 블록 복사",
  copySuccess: "실시간 달력 블록을 복사했습니다.",
  sourceMissing: "원본 노트를 찾을 수 없습니다.",
  sourceChanged: "원본이 변경되어 다시 불러왔습니다. 한 번 더 눌러 주세요.",
  sourceUpdateFailed: "원본 후속 일정을 수정하지 못했습니다.",
  hubOpenFailed: "Follow-up Calendar 노트를 열지 못했습니다.",
  hubFolderConflict: "허브 경로가 폴더와 겹칩니다. 설정에서 Markdown 파일 경로를 선택해 주세요.",
  hubPath: "허브 노트 경로",
  hubPathDesc: "리본 아이콘으로 여는 Markdown 노트입니다.",
  weekStart: "한 주의 시작",
  weekStartDesc: "달력의 첫 번째 요일을 선택합니다.",
  monday: "월요일",
  sunday: "일요일",
  showCompletedDefault: "완료 일정 기본 표시",
  showCompletedDefaultDesc: "화면을 처음 열 때 완료한 후속 일정도 함께 표시합니다.",
  language: "언어",
  languageDesc: "Obsidian 언어를 따르거나 표시 언어를 직접 선택합니다.",
  automatic: "자동",
  korean: "한국어",
  english: "English",
  openCommand: "후속 일정 열기",
  itemCount: "개의 후속 일정"
};

export function resolveLanguage(
  preference: LanguagePreference,
  detectedLocale?: string
): UiLanguage {
  if (preference !== "auto") return preference;

  const locale =
    detectedLocale ??
    (typeof document !== "undefined" ? document.documentElement.lang : undefined) ??
    (typeof navigator !== "undefined" ? navigator.language : "en");
  return locale.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function translate(language: UiLanguage, key: MessageKey): string {
  return language === "ko" ? KO[key] : EN[key];
}

export function formatMonth(language: UiLanguage, date: Date): string {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long"
  }).format(date);
}

export function formatLongDate(language: UiLanguage, date: Date): string {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

export function weekdayLabels(language: UiLanguage, weekStart: "monday" | "sunday"): string[] {
  const sundayFirst = language === "ko"
    ? ["일", "월", "화", "수", "목", "금", "토"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekStart === "sunday" ? sundayFirst : [...sundayFirst.slice(1), sundayFirst[0]];
}
