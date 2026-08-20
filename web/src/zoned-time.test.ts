import { describe, expect, test } from "vitest";
import {
  formatOffset,
  formatRecordedTime,
  offsetMinutesAt,
  resolveWallClock,
  toDatetimeLocal,
} from "./zoned-time";

const SYDNEY = "Australia/Sydney";

describe("daylight saving safe entry times", () => {
  test("resolves an ordinary wall clock to the offset the zone was observing", () => {
    expect(resolveWallClock("2026-08-16T11:00", SYDNEY)).toEqual({
      instant: "2026-08-16T01:00:00.000Z",
      offsetMinutes: 600,
    });
    expect(resolveWallClock("2026-01-16T11:00", SYDNEY)).toEqual({
      instant: "2026-01-16T00:00:00.000Z",
      offsetMinutes: 660,
    });
  });

  test("resolves a wall clock that daylight saving makes happen twice to the earlier instant", () => {
    // 2026-04-05T02:30 is reached in Sydney at +11:00 and again an hour later at +10:00.
    const resolved = resolveWallClock("2026-04-05T02:30", SYDNEY);

    expect(resolved).toEqual({ instant: "2026-04-04T15:30:00.000Z", offsetMinutes: 660 });
    expect(toDatetimeLocal(new Date(resolved.instant), SYDNEY)).toBe("2026-04-05T02:30");
  });

  test("moves a wall clock that daylight saving skips forward by the length of the gap", () => {
    // 2026-10-04T02:30 never occurs in Sydney; the clock jumps from 02:00 to 03:00.
    const resolved = resolveWallClock("2026-10-04T02:30", SYDNEY);

    expect(resolved).toEqual({ instant: "2026-10-03T16:30:00.000Z", offsetMinutes: 660 });
    expect(toDatetimeLocal(new Date(resolved.instant), SYDNEY)).toBe("2026-10-04T03:30");
  });

  test("never drifts by an hour across a transition, unlike a bare wall clock parse", () => {
    for (const local of ["2026-04-05T01:30", "2026-04-05T02:30", "2026-04-05T03:30", "2026-10-04T03:30"]) {
      const resolved = resolveWallClock(local, SYDNEY);
      const roundTripped = toDatetimeLocal(new Date(resolved.instant), SYDNEY);
      const drift = Math.abs(Date.parse(`${roundTripped}:00Z`) - Date.parse(`${local}:00Z`));

      expect(offsetMinutesAt(Date.parse(resolved.instant), SYDNEY)).toBe(resolved.offsetMinutes);
      expect(drift).toBe(0);
    }
  });

  test("reads the zone offset either side of a transition", () => {
    expect(offsetMinutesAt(Date.parse("2026-04-04T15:00:00Z"), SYDNEY)).toBe(660);
    expect(offsetMinutesAt(Date.parse("2026-04-04T16:30:00Z"), SYDNEY)).toBe(600);
  });

  test("shows a recorded time in the offset it was recorded under, not the reader's", () => {
    expect(formatRecordedTime("2026-04-04T15:30:00.000Z", 660)).toBe("5 Apr 2026, 2:30 am (UTC+11:00)");
    expect(formatRecordedTime("2026-08-16T01:00:00.000Z", 600)).toBe("16 Aug 2026, 11:00 am (UTC+10:00)");
    expect(formatRecordedTime("2026-08-16T01:00:00.000Z", -330)).toBe("15 Aug 2026, 7:30 pm (UTC-05:30)");
  });

  test("labels entries recorded before offsets were captured as viewer-local", () => {
    expect(formatRecordedTime("2026-08-16T01:00:00.000Z", null)).toContain("your time zone");
  });

  test("formats offsets that are not whole hours", () => {
    expect(formatOffset(570)).toBe("UTC+09:30");
    expect(formatOffset(0)).toBe("UTC+00:00");
    expect(formatOffset(-210)).toBe("UTC-03:30");
  });
});
