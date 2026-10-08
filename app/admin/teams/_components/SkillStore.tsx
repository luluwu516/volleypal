"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Registration } from "@/lib/db/types";

/**
 * Shared client-side record of skill-rating edits made on /admin/teams.
 *
 * Ratings are edited in the roster list but read back in the teams board —
 * two sibling subtrees under a server component with no shared state between
 * them. Routing the edit through `router.refresh()` was supposed to carry it
 * across, but that re-fetches the whole 64-row page to move one number and
 * disables the pickers while it flies, which is a lot of ceremony for a tap.
 * So the edit is recorded here and every consumer reads its registrations
 * through `withSkill`, which means the roster row, the board's per-player Lv
 * and the team average all move on the same frame as the tap.
 */
interface SkillStore {
  /** `reg` with this session's pending rating applied, if it has one. */
  withSkill: (reg: Registration) => Registration;
  /** Record an edit. Call when the PATCH is sent, not when it lands. */
  setSkill: (id: string, skill: number | null) => void;
}

interface Edit {
  /** What the admin picked. */
  skill: number | null;
  /** The server's rating at the time the pick was made. */
  base: number | null;
}

const SkillStoreContext = createContext<SkillStore | null>(null);

export function useSkillStore(): SkillStore {
  const store = useContext(SkillStoreContext);
  if (!store) {
    throw new Error("useSkillStore must be used inside <SkillStoreProvider>");
  }
  return store;
}

export function SkillStoreProvider({
  registrations,
  children,
}: {
  registrations: Pick<Registration, "id" | "skill_level">[];
  children: React.ReactNode;
}) {
  const [edits, setEdits] = useState<ReadonlyMap<string, Edit>>(
    () => new Map(),
  );
  const serverSkill = useMemo(
    () => new Map(registrations.map((r) => [r.id, r.skill_level])),
    [registrations],
  );

  const withSkill = useCallback(
    (reg: Registration): Registration => {
      const edit = edits.get(reg.id);
      // An edit only speaks for a player while the server still reports the
      // rating it was made against. Once the server catches up — or a backup
      // import moves the rating out from under us — the edit is spent and the
      // server's number wins again. That's what keeps this an overlay on the
      // truth instead of a second copy of it, with no effect needed to prune.
      if (!edit || edit.base !== reg.skill_level) return reg;
      return { ...reg, skill_level: edit.skill };
    },
    [edits],
  );

  const setSkill = useCallback(
    (id: string, skill: number | null) => {
      const base = serverSkill.get(id) ?? null;
      setEdits((prev) => new Map(prev).set(id, { skill, base }));
    },
    [serverSkill],
  );

  const value = useMemo<SkillStore>(
    () => ({ withSkill, setSkill }),
    [withSkill, setSkill],
  );

  return (
    <SkillStoreContext.Provider value={value}>
      {children}
    </SkillStoreContext.Provider>
  );
}
