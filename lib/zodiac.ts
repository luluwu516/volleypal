export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type Element = "fire" | "earth" | "air" | "water";

const SIGN_RANGES: Array<{
  sign: ZodiacSign;
  from: [number, number];
  to: [number, number];
}> = [
  { sign: "capricorn", from: [12, 22], to: [1, 19] },
  { sign: "aquarius", from: [1, 20], to: [2, 18] },
  { sign: "pisces", from: [2, 19], to: [3, 20] },
  { sign: "aries", from: [3, 21], to: [4, 19] },
  { sign: "taurus", from: [4, 20], to: [5, 20] },
  { sign: "gemini", from: [5, 21], to: [6, 20] },
  { sign: "cancer", from: [6, 21], to: [7, 22] },
  { sign: "leo", from: [7, 23], to: [8, 22] },
  { sign: "virgo", from: [8, 23], to: [9, 22] },
  { sign: "libra", from: [9, 23], to: [10, 22] },
  { sign: "scorpio", from: [10, 23], to: [11, 21] },
  { sign: "sagittarius", from: [11, 22], to: [12, 21] },
];

export const SIGN_TO_ELEMENT: Record<ZodiacSign, Element> = {
  aries: "fire",
  leo: "fire",
  sagittarius: "fire",
  taurus: "earth",
  virgo: "earth",
  capricorn: "earth",
  gemini: "air",
  libra: "air",
  aquarius: "air",
  cancer: "water",
  scorpio: "water",
  pisces: "water",
};

export const ELEMENT_LABELS_ZH: Record<Element, string> = {
  fire: "火象",
  earth: "土象",
  air: "風象",
  water: "水象",
};

export function signFromBirthday(birthday: Date): ZodiacSign {
  const month = birthday.getMonth() + 1;
  const day = birthday.getDate();

  for (const { sign, from, to } of SIGN_RANGES) {
    const [fromMonth, fromDay] = from;
    const [toMonth, toDay] = to;
    if (fromMonth === toMonth) {
      if (month === fromMonth && day >= fromDay && day <= toDay) return sign;
    } else {
      const afterStart =
        (month === fromMonth && day >= fromDay) || month > fromMonth;
      const beforeEnd =
        (month === toMonth && day <= toDay) || month < toMonth;
      if (fromMonth > toMonth) {
        // Wraps year boundary (capricorn: Dec 22 - Jan 19)
        if (
          (month === fromMonth && day >= fromDay) ||
          (month === toMonth && day <= toDay)
        ) {
          return sign;
        }
      } else if (afterStart && beforeEnd) {
        return sign;
      }
    }
  }
  throw new Error(`Unable to map date ${birthday.toISOString()} to a sign`);
}

export function elementFromBirthday(birthday: Date): Element {
  return SIGN_TO_ELEMENT[signFromBirthday(birthday)];
}
