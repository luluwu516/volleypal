import { describe, it, expect } from "vitest";
import { displayName, hasDistinctPreferred } from "../lib/format/name";

describe("displayName", () => {
  it("returns legal name when preferred is null", () => {
    expect(displayName({ name: "Wang Xiaoming", preferred_name: null })).toBe(
      "Wang Xiaoming",
    );
  });

  it("returns legal name when preferred is empty / whitespace", () => {
    expect(displayName({ name: "Wang Xiaoming", preferred_name: "" })).toBe(
      "Wang Xiaoming",
    );
    expect(displayName({ name: "Wang Xiaoming", preferred_name: "   " })).toBe(
      "Wang Xiaoming",
    );
  });

  it("returns preferred name when set", () => {
    expect(displayName({ name: "Wang Xiaoming", preferred_name: "Alex" })).toBe(
      "Alex",
    );
  });

  it("trims surrounding whitespace on preferred", () => {
    // Google Forms answers routinely carry a trailing space; rendering it
    // verbatim leaves the label looking misaligned next to its neighbours.
    expect(
      displayName({ name: "Wang Xiaoming", preferred_name: "  Alex  " }),
    ).toBe("Alex");
  });
});

describe("hasDistinctPreferred", () => {
  it("false when preferred is null / blank / same as legal", () => {
    expect(
      hasDistinctPreferred({ name: "Alex", preferred_name: null }),
    ).toBe(false);
    expect(hasDistinctPreferred({ name: "Alex", preferred_name: "" })).toBe(
      false,
    );
    expect(
      hasDistinctPreferred({ name: "Alex", preferred_name: "Alex" }),
    ).toBe(false);
  });

  it("true when preferred differs from legal", () => {
    expect(
      hasDistinctPreferred({
        name: "Wang Xiaoming",
        preferred_name: "Alex",
      }),
    ).toBe(true);
  });
});
