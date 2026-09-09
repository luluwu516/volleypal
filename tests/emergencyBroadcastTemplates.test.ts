import { describe, it, expect } from "vitest";
import {
  composeBody,
  isValidLocationKey,
  locationLabel,
} from "../lib/emergency-broadcast/templates";

describe("isValidLocationKey", () => {
  it("accepts fixed keys", () => {
    expect(isValidLocationKey("sideline", 4)).toBe(true);
    expect(isValidLocationKey("entrance", 4)).toBe(true);
    expect(isValidLocationKey("other", 4)).toBe(true);
  });

  it("accepts court_N within num_courts range", () => {
    expect(isValidLocationKey("court_1", 4)).toBe(true);
    expect(isValidLocationKey("court_4", 4)).toBe(true);
  });

  it("rejects court_N beyond num_courts", () => {
    // 5th court doesn't exist for a 4-court tournament — must not fall
    // through to the composer where it would render "場地5".
    expect(isValidLocationKey("court_5", 4)).toBe(false);
    expect(isValidLocationKey("court_0", 4)).toBe(false);
  });

  it("rejects garbage keys", () => {
    expect(isValidLocationKey("court_abc", 4)).toBe(false);
    expect(isValidLocationKey("random", 4)).toBe(false);
    expect(isValidLocationKey("", 4)).toBe(false);
  });
});

describe("locationLabel", () => {
  it("renders court numbers", () => {
    expect(locationLabel("court_1")).toBe("場地1");
    expect(locationLabel("court_3")).toBe("場地3");
  });

  it("renders fixed keys", () => {
    expect(locationLabel("sideline")).toBe("場邊");
    expect(locationLabel("entrance")).toBe("入口處");
  });

  it("renders 'other' with free-text suffix, trimmed", () => {
    expect(locationLabel("other", "  停車場  ")).toBe("其他: 停車場");
    expect(locationLabel("other", "")).toBe("其他");
    expect(locationLabel("other", null)).toBe("其他");
  });
});

describe("composeBody", () => {
  it("prefixes all messages so the display layer can recognise player source from body alone", () => {
    const body = composeBody({
      issue: "equipment",
      location_key: "court_1",
      item_keys: ["whistle"],
    });
    expect(body.startsWith("🆘 球員廣播:")).toBe(true);
  });

  it("renders equipment issue with multi-item list", () => {
    const body = composeBody({
      issue: "equipment",
      location_key: "court_2",
      item_keys: ["whistle", "scoresheet"],
    });
    expect(body).toContain("缺少比賽器材");
    expect(body).toContain("哨子");
    expect(body).toContain("記錄單");
    expect(body).toContain("場地2");
  });

  it("renders injury issue with ice request at sideline", () => {
    const body = composeBody({
      issue: "injury",
      location_key: "sideline",
      item_keys: ["ice"],
    });
    expect(body).toContain("有人受傷");
    expect(body).toContain("冰塊");
    expect(body).toContain("場邊");
  });

  it("passes 'other' free-text through for both item and location", () => {
    const body = composeBody({
      issue: "injury",
      location_key: "other",
      location_other: "停車場",
      item_keys: ["other"],
      item_other: "止痛藥",
    });
    expect(body).toContain("止痛藥");
    expect(body).toContain("停車場");
  });

  it("gracefully renders 'other' with no free-text (server-side would 400, but the function itself shouldn't crash)", () => {
    // Defensive: composeBody must not throw on empty free-text, even though
    // the API route rejects such payloads. Keeps the fallback safe if a
    // reader ever re-uses the composer for admin-authored broadcasts.
    const body = composeBody({
      issue: "injury",
      location_key: "other",
      location_other: "",
      item_keys: ["other"],
      item_other: null,
    });
    expect(body).toContain("其他");
  });
});
