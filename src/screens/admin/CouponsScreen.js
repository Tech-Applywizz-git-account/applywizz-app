import React, { useCallback } from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../../components/AppText";
import { useNavigation } from "@react-navigation/native";
import AdminListShell from "./AdminListShell";
import { createCoupon, deleteCoupon, fetchCoupons, updateCoupon } from "../../api/admin";
import { FONT } from "../../typography";
import { BRAND } from "../../theme";

export default function CouponsScreen() {
  const navigation = useNavigation();
  const load = useCallback(async (q) => fetchCoupons(q ? { search: q } : {}), []);

  return (
    <AdminListShell
      title="Coupons"
      load={load}
      headerNote="Manage discount codes. Open requests for approvals."
      extraHeader={(
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              backgroundColor: BRAND.teal,
            }}
          >
            <Text style={{ color: "#fff", fontFamily: FONT.medium, fontSize: 12 }}>Codes</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("CouponRequests")}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0",
            }}
          >
            <Text style={{ color: BRAND.tealDark, fontFamily: FONT.medium, fontSize: 12 }}>Requests</Text>
          </TouchableOpacity>
        </View>
      )}
      rowTitle={(r) => r.code || "Coupon"}
      rowSub={(r) => `$${Number(r.discount_amount || r.amount || 0).toFixed(2)} · ${r.status || "—"}`}
      createLabel="Add coupon"
      fields={[
        { key: "code", label: "Code" },
        { key: "discount_amount", label: "Discount amount", keyboardType: "decimal-pad" },
        { key: "description", label: "Description", multiline: true },
        { key: "status", label: "Status (active/inactive)" },
        { key: "max_redemptions", label: "Max redemptions", keyboardType: "number-pad" },
      ]}
      initialDraft={{ code: "", discount_amount: "", description: "", status: "active", max_redemptions: "" }}
      onSave={async (editing, draft) => {
        const payload = {
          code: String(draft.code || "").trim().toUpperCase(),
          discount_amount: Number(draft.discount_amount || 0),
          description: draft.description || "",
          status: draft.status || "active",
          max_redemptions: draft.max_redemptions === "" ? null : Number(draft.max_redemptions),
        };
        if (editing?.id) await updateCoupon(editing.id, payload);
        else await createCoupon(payload);
      }}
      onDelete={async (row) => deleteCoupon(row.id)}
    />
  );
}
