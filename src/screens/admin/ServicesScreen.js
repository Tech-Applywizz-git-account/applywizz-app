import React, { useCallback } from "react";
import AdminListShell from "./AdminListShell";
import { createService, deleteService, fetchServices, updateService } from "../../api/admin";

export default function ServicesScreen() {
  const load = useCallback(async () => fetchServices(), []);
  return (
    <AdminListShell
      title="Services"
      load={load}
      rowTitle={(r) => r.name || "Service"}
      rowSub={(r) => `$${Number(r.amount || 0).toFixed(2)} · ${r.is_active === false ? "Inactive" : "Active"}`}
      createLabel="Add service"
      fields={[
        { key: "name", label: "Name" },
        { key: "description", label: "Description", multiline: true },
        { key: "amount", label: "Amount", keyboardType: "decimal-pad" },
        { key: "min_amount", label: "Min amount", keyboardType: "decimal-pad" },
      ]}
      initialDraft={{ name: "", description: "", amount: "", min_amount: "" }}
      onSave={async (editing, draft) => {
        const payload = {
          name: draft.name,
          description: draft.description,
          amount: Number(draft.amount || 0),
          min_amount: Number(draft.min_amount || 0),
        };
        if (editing?.id) await updateService(editing.id, payload);
        else await createService(payload);
      }}
      onDelete={async (row) => deleteService(row.id)}
    />
  );
}
