import { describe, it, expect } from "vitest";
import { normalizeNationality } from "../app/api/form-webhook/route";

describe("normalizeNationality", () => {
  it("returns true for empty / null (default to TW to protect 10 non-TW slots)", () => {
    expect(normalizeNationality(null)).toBe(true);
    expect(normalizeNationality("")).toBe(true);
    expect(normalizeNationality("   ")).toBe(true);
  });

  it("returns true for various Taiwan-positive labels", () => {
    expect(normalizeNationality("台灣")).toBe(true);
    expect(normalizeNationality("臺灣")).toBe(true);
    expect(normalizeNationality("Taiwan")).toBe(true);
    expect(normalizeNationality("taiwan")).toBe(true);
    expect(normalizeNationality("TW")).toBe(true);
    expect(normalizeNationality("ROC")).toBe(true);
  });

  it("returns false for Chinese non-TW markers", () => {
    expect(normalizeNationality("非台灣")).toBe(false);
    expect(normalizeNationality("非臺灣")).toBe(false);
    expect(normalizeNationality("外籍")).toBe(false);
    expect(normalizeNationality("外國")).toBe(false);
    expect(normalizeNationality("其他")).toBe(false);
    expect(normalizeNationality("海外")).toBe(false);
  });

  it("returns false for English non-TW markers", () => {
    expect(normalizeNationality("Non-Taiwan")).toBe(false);
    expect(normalizeNationality("non taiwan")).toBe(false);
    expect(normalizeNationality("foreign")).toBe(false);
    expect(normalizeNationality("Overseas")).toBe(false);
    expect(normalizeNationality("Other")).toBe(false);
    expect(normalizeNationality("international")).toBe(false);
  });

  it("checks negation BEFORE positive taiwan match", () => {
    // "非台灣" contains "台灣" — must not fall through to the positive branch.
    expect(normalizeNationality("非台灣")).toBe(false);
    expect(normalizeNationality("Non-Taiwan resident")).toBe(false);
  });

  it("defaults unknown labels to true (fail safe toward local)", () => {
    // A misfiled answer or a country name we don't specifically list should
    // count as TW so a non-TW registrant is never silently promoted into a
    // reserved foreign-player slot.
    expect(normalizeNationality("中華民國")).toBe(true);
    expect(normalizeNationality("Republic of China")).toBe(true);
    // But if the label carries an explicit non-TW marker, it wins.
    expect(normalizeNationality("Republic of China — non-TW resident")).toBe(false);
  });
});
