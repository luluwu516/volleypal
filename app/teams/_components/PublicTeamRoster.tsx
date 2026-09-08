import type {
  GroupingStrategy,
  Registration,
  Team,
  ElementType,
  MbtiTemperament,
} from "@/lib/db/types";
import { displayName } from "@/lib/format/name";
import { elementFromBirthday, ELEMENT_LABELS_ZH } from "@/lib/zodiac";
import { MBTI_TO_TEMPERAMENT, TEMPERAMENT_LABELS_ZH } from "@/lib/mbti";

const ELEMENT_DOT: Record<ElementType, string> = {
  fire: "bg-red-500",
  earth: "bg-amber-600",
  air: "bg-violet-400",
  water: "bg-cyan-500",
};

const TEMPERAMENT_DOT: Record<MbtiTemperament, string> = {
  NF: "bg-purple-500",
  NT: "bg-sky-500",
  SJ: "bg-emerald-500",
  SP: "bg-amber-500",
};

interface Member {
  team_id: string;
  registration_id: string;
}

// Public-safe view — shows name, setter marker, and the per-strategy attribute
// tag (element for zodiac_*, temperament for mbti_*). Deliberately hides skill,
// gender, birthday, email, phone, and the raw MBTI type — those stay admin-only.
export function PublicTeamRoster({
  teams,
  members,
  registrations,
  strategy,
}: {
  teams: Team[];
  members: Member[];
  registrations: Registration[];
  strategy: GroupingStrategy;
}) {
  const isMbti = strategy.startsWith("mbti_");
  const regById = new Map(registrations.map((r) => [r.id, r]));
  const membersByTeam = new Map<string, Registration[]>();
  for (const m of members) {
    const r = regById.get(m.registration_id);
    if (!r) continue;
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(r);
    membersByTeam.set(m.team_id, list);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {teams.map((t) => {
        const roster = (membersByTeam.get(t.id) ?? []).slice().sort((a, b) =>
          displayName(a).localeCompare(displayName(b), "zh-Hant"),
        );
        return (
          <div
            key={t.id}
            className="rounded-lg border border-border/50 overflow-hidden"
          >
            <div
              className="px-3 py-2 flex items-center justify-between border-b border-border/40"
              style={{
                background: t.color ? `${t.color}22` : undefined,
                borderLeft: t.color ? `3px solid ${t.color}` : undefined,
              }}
            >
              <span className="font-semibold text-sm">{t.name}</span>
              <span className="text-xs text-muted-foreground">
                {roster.length} 人
              </span>
            </div>
            <ul className="divide-y divide-border/30">
              {roster.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  尚無成員
                </li>
              ) : (
                roster.map((r) => {
                  const attrLabel = attributeLabel(r, isMbti);
                  const attrDotClass = attributeDotClass(r, isMbti);
                  return (
                    <li
                      key={r.id}
                      className="px-3 py-2 flex items-center gap-2 text-sm"
                    >
                      <span className="w-4 text-center" title={r.position ?? ""}>
                        {r.position === "setter" ? "🙌🏻" : ""}
                      </span>
                      <span className="flex-1 truncate">{displayName(r)}</span>
                      {attrLabel && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {attrDotClass && (
                            <span
                              className={`size-1.5 rounded-full ${attrDotClass}`}
                              aria-hidden
                            />
                          )}
                          {attrLabel}
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function attributeLabel(r: Registration, isMbti: boolean): string | null {
  if (isMbti) {
    if (!r.mbti) return null;
    const tmp = MBTI_TO_TEMPERAMENT[r.mbti];
    return tmp ? TEMPERAMENT_LABELS_ZH[tmp] : null;
  }
  if (!r.birthday) return null;
  try {
    const el = elementFromBirthday(new Date(r.birthday + "T12:00:00"));
    return ELEMENT_LABELS_ZH[el];
  } catch {
    return null;
  }
}

function attributeDotClass(r: Registration, isMbti: boolean): string | null {
  if (isMbti) {
    if (!r.mbti) return null;
    const tmp = MBTI_TO_TEMPERAMENT[r.mbti];
    return tmp ? TEMPERAMENT_DOT[tmp] : null;
  }
  if (!r.birthday) return null;
  try {
    const el = elementFromBirthday(new Date(r.birthday + "T12:00:00"));
    return ELEMENT_DOT[el];
  } catch {
    return null;
  }
}
