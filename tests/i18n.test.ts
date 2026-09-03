import { describe, expect, it } from "vitest";
import { formatMonth, resolveLanguage, translate, weekdayLabels } from "../src/i18n";

describe("localization", () => {
  it("detects Korean and defaults other locales to English", () => {
    expect(resolveLanguage("auto", "ko-KR")).toBe("ko");
    expect(resolveLanguage("auto", "en-US")).toBe("en");
    expect(resolveLanguage("auto", "ja-JP")).toBe("en");
  });

  it("honors an explicit language preference", () => {
    expect(resolveLanguage("en", "ko-KR")).toBe("en");
    expect(resolveLanguage("ko", "en-US")).toBe("ko");
  });

  it("provides localized calendar labels", () => {
    expect(translate("ko", "today")).toBe("오늘");
    expect(translate("en", "today")).toBe("Today");
    expect(weekdayLabels("ko", "monday")).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
    expect(weekdayLabels("en", "sunday")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(formatMonth("en", new Date(2026, 8, 1))).toContain("2026");
    expect(formatMonth("ko", new Date(2026, 8, 1))).toContain("9월");
  });
});
