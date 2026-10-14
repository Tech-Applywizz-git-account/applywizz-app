import React, { useCallback } from "react";
import AdminListShell from "./AdminListShell";
import { fetchDepartments, updateDepartment } from "../../api/admin";

export default function DepartmentsScreen() {
  const load = useCallback(async () => fetchDepartments(), []);
  return (
    <AdminListShell
      title="Departments"
      load={load}
      rowTitle={(r) => r.name || "Department"}
      rowSub={(r) => r.description || r.head_name || "—"}
      allowCreate={false}
      fields={[
        { key: "name", label: "Name" },
        { key: "description", label: "Description", multiline: true },
      ]}
      initialDraft={{ name: "", description: "" }}
      onSave={async (editing, draft) => {
        if (!editing?.id) throw new Error("Select a department to edit");
        await updateDepartment(editing.id, {
          name: draft.name,
          description: draft.description,
        });
      }}
    />
  );
}
