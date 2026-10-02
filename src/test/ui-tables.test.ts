import { describe, it, expect } from "vitest";
import { focusGroupRows } from "@/components/tables/standingsGroups";
import type { Standing } from "@/lib/providers/types";

const row = (teamId: number, groupLabel: string | null, position = 1) =>
  ({ teamId, groupLabel, position, form: [] }) as unknown as Standing;

const groups = [row(1, "Group A"), row(2, "Group A", 2), row(3, "Group B"), row(4, "Group B", 2), row(5, "Group C")];

describe("focusGroupRows (B15)", () => {
  it("narrows a grouped table to the group holding the teams", () => {
    expect(focusGroupRows(groups, [3, 4])?.map((r) => r.teamId)).toEqual([3, 4]);
  });

  it("keeps every group a cross-group fixture touches", () => {
    expect(focusGroupRows(groups, [1, 5])?.map((r) => r.teamId)).toEqual([1, 2, 5]);
  });

  it("returns null when there's nothing to narrow", () => {
    expect(focusGroupRows([row(1, null), row(2, null, 2)], [1])).toBeNull(); // plain league
    expect(focusGroupRows(groups, [])).toBeNull();
    expect(focusGroupRows(groups, [99])).toBeNull(); // team not in the table
    expect(focusGroupRows(groups, [1, 3, 5])).toBeNull(); // already every group
  });
});
