import { describe, it, expect } from "vitest";
import { addDays, todayISO } from "./date";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-07-15", 0)).toBe("2026-07-15");
    expect(addDays("2026-07-15", 4)).toBe("2026-07-19");
  });
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-07-30", 3)).toBe("2026-08-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("handles leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("todayISO", () => {
  it("formats a fixed date", () => {
    expect(todayISO(new Date(2026, 6, 15))).toBe("2026-07-15");
  });
});
