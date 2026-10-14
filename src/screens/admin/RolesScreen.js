import React, { useCallback } from "react";
import AdminListShell from "./AdminListShell";
import { fetchRoles, updateRole } from "../../api/admin";

export default function RolesScreen() {
  const load = useCallback(async () => fetchRoles(), []);
  return (
    <AdminListShell
      title="Roles"
      load={load}
      headerNote="Roles are managed here for review. Permission IDs can be edited as a comma-separated list when supported by the API."
      rowTitle={(r) => r.name || "Role"}
      rowSub={(r) => {
        const perms = r.permissions || r.permission_ids || [];
        const n = Array.isArray(perms) ? perms.length : 0;
        return `${n} permissions · ${r.description || ""}`;
      }}
      allowCreate={false}
      fields={[
        { key: "name", label: "Name" },
        { key: "description", label: "Description", multiline: true },
        { key: "permission_ids", label: "Permission IDs (comma-separated)" },
      ]}
      initialDraft={{ name: "", description: "", permission_ids: "" }}
      onSave={async (editing, draft) => {
        if (!editing?.id) throw new Error("Select a role to edit");
        const ids = String(draft.permission_ids || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n));
        const payload = { name: draft.name, description: draft.description };
        if (ids.length) payload.permission_ids = ids;
        await updateRole(editing.id, payload);
      }}
    />
  );
}
