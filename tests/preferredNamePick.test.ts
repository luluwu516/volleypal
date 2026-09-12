import { describe, it, expect } from "vitest";
import { pick } from "../app/api/form-webhook/route";

// Alias list mirrors form-webhook `handleRegistration`. Keep it in sync
// with the production list so this test actually locks the field.
const PREFERRED_NAME_ALIASES = [
  "preferred_name",
  "preferred name",
  "nickname",
  "暱稱",
  "常用稱呼",
  "英文名",
];

describe("pick(preferred_name aliases)", () => {
  it("returns nickname when set on the intended field", () => {
    const responses = {
      "姓名 / Legal Name": ["Wang Xiaoming"],
      "暱稱 / Preferred Name": ["Alex"],
      "場上偏好位置 (Preferred Position)": ["可以舉球 (I can set)"],
    };
    expect(pick(responses, PREFERRED_NAME_ALIASES)).toBe("Alex");
  });

  it("returns null when nickname is blank, even if position field contains 'Preferred'", () => {
    // The bug: bare "preferred" alias substring-matched
    // 「場上偏好位置 (Preferred Position)」 and imported the position
    // answer as the player's nickname. Locking the fix.
    const responses = {
      "姓名 / Legal Name": ["Wang Xiaoming"],
      "暱稱 / Preferred Name": [""],
      "場上偏好位置 (Preferred Position)": ["千萬不要讓我舉球 (I am not setting)"],
    };
    expect(pick(responses, PREFERRED_NAME_ALIASES)).toBe(null);
  });

  it("returns null when the nickname field is entirely absent from the form", () => {
    const responses = {
      "姓名 / Legal Name": ["Wang Xiaoming"],
      "場上偏好位置 (Preferred Position)": ["可以舉球 (I can set)"],
    };
    expect(pick(responses, PREFERRED_NAME_ALIASES)).toBe(null);
  });

  it("matches nickname titles that don't include the English label", () => {
    const responses = {
      "姓名": ["王小明"],
      "暱稱": ["小明"],
    };
    expect(pick(responses, PREFERRED_NAME_ALIASES)).toBe("小明");
  });
});
