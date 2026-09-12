import { describe, it, expect } from "vitest";
import { normalizeGender } from "../app/api/form-webhook/route";

describe("normalizeGender", () => {
  it("returns null for empty / null", () => {
    expect(normalizeGender(null)).toBe(null);
    expect(normalizeGender("")).toBe(null);
  });

  it("recognises plain Chinese markers", () => {
    expect(normalizeGender("男")).toBe("male");
    expect(normalizeGender("女")).toBe("female");
  });

  it("recognises plain English markers", () => {
    expect(normalizeGender("Male")).toBe("male");
    expect(normalizeGender("Female")).toBe("female");
    expect(normalizeGender("male")).toBe("male");
    expect(normalizeGender("female")).toBe("female");
  });

  it("classifies 生理女 (Female) as female — the substring-match regression", () => {
    // The bug: earlier version iterated GENDERS = ["male","female","other"]
    // and returned the first .includes match. "生理女 (Female)".includes("male")
    // is true (because "female" contains "male"), so every female answer
    // was silently classified male. This test locks the fix.
    expect(normalizeGender("生理女 (Female)")).toBe("female");
    expect(normalizeGender("生理男 (Male)")).toBe("male");
    expect(normalizeGender("生理女")).toBe("female");
    expect(normalizeGender("生理男")).toBe("male");
  });

  it("handles mixed-case English labels", () => {
    expect(normalizeGender("FEMALE")).toBe("female");
    expect(normalizeGender("MALE")).toBe("male");
  });

  it("returns 'other' for anything not recognised", () => {
    expect(normalizeGender("prefer not to say")).toBe("other");
    expect(normalizeGender("非二元")).toBe("other");
    expect(normalizeGender("Other")).toBe("other");
  });
});
