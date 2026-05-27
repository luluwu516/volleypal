import { describe, it, expect } from "vitest";
import {
  signFromBirthday,
  elementFromBirthday,
  SIGN_TO_ELEMENT,
} from "../lib/zodiac";

describe("signFromBirthday", () => {
  const cases: Array<[string, ReturnType<typeof signFromBirthday>]> = [
    ["1990-01-19", "capricorn"],
    ["1990-01-20", "aquarius"],
    ["1990-12-21", "sagittarius"],
    ["1990-12-22", "capricorn"],
    ["1990-12-31", "capricorn"],
    ["1990-04-19", "aries"],
    ["1990-04-20", "taurus"],
    ["1990-07-22", "cancer"],
    ["1990-07-23", "leo"],
    ["1990-11-22", "sagittarius"],
    ["1990-02-29", "pisces"],
  ];
  it.each(cases)("maps %s -> %s", (date, expected) => {
    expect(signFromBirthday(new Date(date + "T12:00:00"))).toBe(expected);
  });
});

describe("elementFromBirthday", () => {
  it("returns the correct element for each sign group", () => {
    expect(elementFromBirthday(new Date("1990-03-21T12:00:00"))).toBe("fire");
    expect(elementFromBirthday(new Date("1990-05-15T12:00:00"))).toBe("earth");
    expect(elementFromBirthday(new Date("1990-06-15T12:00:00"))).toBe("air");
    expect(elementFromBirthday(new Date("1990-07-01T12:00:00"))).toBe("water");
  });
});

describe("SIGN_TO_ELEMENT", () => {
  it("covers every sign exactly once", () => {
    expect(Object.keys(SIGN_TO_ELEMENT)).toHaveLength(12);
  });
  it("has 3 signs per element", () => {
    const counts: Record<string, number> = {};
    for (const el of Object.values(SIGN_TO_ELEMENT)) {
      counts[el] = (counts[el] ?? 0) + 1;
    }
    expect(counts).toEqual({ fire: 3, earth: 3, air: 3, water: 3 });
  });
});
