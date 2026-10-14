import React, { useCallback } from "react";
import AdminListShell from "./AdminListShell";
import {
  createHierarchyLevel,
  deleteHierarchyLevel,
  fetchHierarchy,
  updateHierarchyLevel,
} from "../../api/admin";

export default function HierarchyScreen() {
  const load = useCallback(async () => fetchHierarchy(), []);
  return (
    <AdminListShell
      title="Hierarchy"
      load={load}
      rowTitle={(r) => r.name || r.hierarchy_name || "Level"}
      rowSub={(r) => `Rank ${r.rank ?? "—"} · ${r.visibility_type || ""}`}
      createLabel="Add level"
      fields={[
        { key: "hierarchy_name", label: "Hierarchy name" },
        { key: "name", label: "Level name" },
        { key: "rank", label: "Rank", keyboardType: "number-pad" },
        { key: "visibility_type", label: "Visibility type" },
      ]}
      initialDraft={{ hierarchy_name: "", name: "", rank: "1", visibility_type: "team" }}
      onSave={async (editing, draft) => {
        const payload = {
          hierarchy_name: draft.hierarchy_name,
          name: draft.name,
          rank: Number(draft.rank || 0),
          visibility_type: draft.visibility_type || "team",
        };
        if (editing?.id) await updateHierarchyLevel(editing.id, payload);
        else await createHierarchyLevel(payload);
      }}
      onDelete={async (row) => deleteHierarchyLevel(row.id)}
    />
  );
}
