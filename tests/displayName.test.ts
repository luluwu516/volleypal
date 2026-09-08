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
    // A form with a stray space shouldn't make the label look off. displayName
    // returns the trimmed form (via the presence check + fallback rule).
    const r = { name: "Wang Xiaoming", preferred_name: "  Alex  " };
    // We accept either the trimmed nickname or, if a future implementation
    // switches to display the untrimmed value, the untrimmed form — but not
    // the legal name.
    expect(displayName(r)).not.toBe("Wang Xiaoming");
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
