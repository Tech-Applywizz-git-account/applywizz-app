import React, { useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Text } from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  sendBillingIntent,
  cancelBillingIntent,
  deleteBillingIntent,
  markBillingPaid,
  restoreAndMarkPaid,
  rowPayUrl,
  rowMethod,
  isOfflineCollectionMethod,
  isBillingManageable,
} from "../api/billing";
import { canManageBilling, canHardDeleteBilling, isOwnerUser, formatApiError, isGatewayMethod } from "../utils/billing";
import { FONT } from "../typography";
import MarkPaidLoadingOverlay from "./MarkPaidLoadingOverlay";

const VARIANTS = {
  pay: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE", icon: "open-outline" },
  resend: { bg: "#EEF2FF", fg: "#4338CA", border: "#C7D2FE", icon: "paper-plane-outline" },
  markPaid: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0", icon: "checkmark-circle-outline" },
  restore: { bg: "#F0FDFA", fg: "#0F766E", border: "#99F6E4", icon: "refresh-outline" },
  shift: { bg: "#FDF4FF", fg: "#A21CAF", border: "#F5D0FE", icon: "person-add-outline" },
  edit: { bg: "#F5F3FF", fg: "#6D28D9", border: "#DDD6FE", icon: "pencil-outline" },
  cancel: { bg: "#FFF1F2", fg: "#BE123C", border: "#FECDD3", icon: "close-outline" },
  delete: { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA", icon: "trash-outline" },
};

function ActionChip({ label, variant, onPress, disabled, busy }) {
  const v = VARIANTS[variant] || VARIANTS.pay;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      style={[
        styles.chip,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled || busy ? 0.55 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <Ionicons name={v.icon} size={13} color={v.fg} />
      )}
      <Text style={[styles.chipText, { color: v.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Web-parity actions for NAS / Zelle / UPI and gateway (PayPal / Razorpay / Cashfree) billing.
 */
export default function BillingOfflineActions({ row, user, onChanged, onEdit, onShiftOwner }) {
  const [busy, setBusy] = useState("");
  const method = rowMethod(row);
  const offline = isOfflineCollectionMethod(method);
  const gateway = isGatewayMethod(method);
  const manageable = isBillingManageable(row);
  const canManage = canManageBilling(user);
  const canDelete = canHardDeleteBilling(user);
  const owner = isOwnerUser(user);
  const payUrl = rowPayUrl(row);
  const displayStatus = String(row?.displayStatus || row?.status || "").toLowerCase();
  const attemptStatus = String(row?.attemptStatus || row?.attempt?.status || "").toLowerCase();
  const intentStatus = String(row?.raw?.status || "").toLowerCase();
  const isPaid = displayStatus === "paid" || attemptStatus === "paid";
  const isCancelled = intentStatus === "cancelled" || attemptStatus === "cancelled" || displayStatus === "cancelled";
  const sendLabel = attemptStatus === "draft" || displayStatus === "draft" ? "Send" : "Resend";
  const isLiveBilling = row?.source === "billing";
  const isLegacy = row?.source === "payment_order";

  const show = useMemo(() => {
    const staff = {
      pay: false, resend: false, markPaid: false, edit: false, cancel: false, delete: false,
      restore: false, shift: false,
    };
    if (isLiveBilling && offline) {
      staff.pay = Boolean(payUrl) && !isPaid && !isCancelled;
      staff.resend = canManage && manageable;
      staff.markPaid = canManage && manageable;
      staff.edit = canManage && manageable;
      staff.cancel = canManage && manageable;
      staff.delete = canDelete && intentStatus !== "fulfilled";
    }
    if (isLiveBilling && gateway) {
      staff.resend = canManage && manageable;
      staff.edit = canManage && manageable;
      staff.cancel = canManage && manageable;
      staff.delete = canDelete && intentStatus !== "fulfilled";
    }
    if (owner && isLiveBilling && isCancelled) staff.restore = true;
    if (owner && (isLiveBilling || isLegacy) && (isPaid || isCancelled || isLegacy)) staff.shift = true;
    return staff;
  }, [
    isLiveBilling, isLegacy, offline, gateway, payUrl, isPaid, isCancelled,
    canManage, manageable, canDelete, intentStatus, owner,
  ]);

  if (!Object.values(show).some(Boolean)) return null;

  const run = async (key, fn, confirm) => {
    const go = async () => {
      setBusy(key);
      try {
        await fn();
        onChanged?.();
      } catch (e) {
        Alert.alert("Error", formatApiError(e, "Action failed."));
      } finally {
        setBusy("");
      }
    };
    if (confirm) {
      Alert.alert(confirm.title, confirm.message, [
        { text: "Cancel", style: "cancel" },
        { text: confirm.ok || "OK", style: confirm.destructive ? "destructive" : "default", onPress: go },
      ]);
      return;
    }
    await go();
  };

  const onPay = () => {
    if (!payUrl) {
      Alert.alert("Unavailable", "No pay link for this invoice.");
      return;
    }
    Linking.openURL(payUrl).catch(() => Alert.alert("Error", "Could not open pay link."));
  };

  const onMarkPaid = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload the payment screenshot.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    await run("markPaid", async () => {
      await markBillingPaid(row.id, {
        uri: asset.uri,
        name: asset.fileName || "payment.jpg",
        mimeType: asset.mimeType || "image/jpeg",
      });
      Alert.alert("Marked paid", "Payment screenshot uploaded.");
    });
  };

  return (
    <>
      <View style={styles.wrap}>
        {show.pay ? (
          <ActionChip label="Pay" variant="pay" onPress={onPay} busy={busy === "pay"} />
        ) : null}
        {show.resend ? (
          <ActionChip
            label={sendLabel}
            variant="resend"
            busy={busy === "resend"}
            onPress={() => run("resend", async () => {
              await sendBillingIntent(row.id);
              Alert.alert(sendLabel === "Send" ? "Sent" : "Resent", "Invoice email queued.");
            })}
          />
        ) : null}
        {show.markPaid ? (
          <ActionChip label="Mark Paid" variant="markPaid" onPress={onMarkPaid} busy={busy === "markPaid"} />
        ) : null}
        {show.edit ? (
          <ActionChip
            label="Edit"
            variant="edit"
            onPress={() => onEdit?.(row)}
            busy={busy === "edit"}
          />
        ) : null}
        {show.cancel ? (
          <ActionChip
            label="Cancel"
            variant="cancel"
            busy={busy === "cancel"}
            onPress={() => run("cancel", async () => {
              await cancelBillingIntent(row.id);
              Alert.alert("Cancelled", "Invoice cancelled.");
            }, {
              title: "Cancel invoice?",
              message: "The customer will not be able to pay this link.",
              ok: "Cancel invoice",
              destructive: true,
            })}
          />
        ) : null}
        {show.delete ? (
          <ActionChip
            label="Delete"
            variant="delete"
            busy={busy === "delete"}
            onPress={() => run("delete", async () => {
              await deleteBillingIntent(row.id);
              Alert.alert("Deleted", "Invoice removed.");
            }, {
              title: "Delete permanently?",
              message: "This cannot be undone.",
              ok: "Delete",
              destructive: true,
            })}
          />
        ) : null}
        {show.restore ? (
          <ActionChip
            label="Restore & paid"
            variant="restore"
            busy={busy === "restore"}
            onPress={() => run("restore", async () => {
              let shot = null;
              if (offline) {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                  throw new Error("Allow photo access to upload the payment screenshot.");
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  quality: 0.85,
                });
                if (result.canceled || !result.assets?.[0]?.uri) {
                  throw new Error("Screenshot is required for NAS, Zelle, and UPI.");
                }
                const asset = result.assets[0];
                shot = {
                  uri: asset.uri,
                  name: asset.fileName || "payment.jpg",
                  mimeType: asset.mimeType || "image/jpeg",
                };
              }
              await restoreAndMarkPaid(row.id, shot);
              Alert.alert("Restored", "Invoice restored and marked paid.");
            }, {
              title: "Restore and mark paid?",
              message: offline
                ? "This cancelled invoice will be marked paid. Incentive credit will follow the current owner."
                : "This cancelled invoice will be marked paid. Paid at will be taken from the PayPal, Razorpay, or Cashfree webhook.",
              ok: "Restore & mark paid",
            })}
          />
        ) : null}
        {show.shift ? (
          <ActionChip
            label="Shift owner"
            variant="shift"
            onPress={() => onShiftOwner?.(row)}
          />
        ) : null}
      </View>
      <MarkPaidLoadingOverlay
        open={busy === "markPaid"}
        invoiceLabel={row?.number || row?.reference || row?.intent_number || ""}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  chipText: {
    fontFamily: FONT.medium,
    fontSize: 12,
  },
});
