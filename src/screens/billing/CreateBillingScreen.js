import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity, Switch, Linking, Share, Platform, Modal, FlatList, Pressable } from "react-native";
import { Text, TextInput } from "../../components/AppText";

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import api, { API_ORIGIN } from "../../api/client";
import { getCached, setCached } from "../../api/queryCache";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { Button, Card, Field, Screen, useTheme } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import {
  PAYMENT_KINDS, METHOD_LABELS, fmtUsd, fmtInr, toList, formatApiError,
  canUseZelleUpi, canSendOnBehalfOf, requiresOnBehalf, allowedMethods, canCreateInvoice,
  canBypassMinAmount,
  normalizeUpiAccounts, normalizeZelleAccounts,
  parseQuantityInput, parsePriceInput,
  couponProviderForMethod, rewritePublicFrontendUrl,
} from "../../utils/billing";
import { useScreenQuery } from "../../navigation/useScreenQuery";

function ChipRow({ items, value, onChange, t }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onChange(item.id)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: active ? t.accent : t.card,
              borderWidth: 1, borderColor: active ? t.accent : t.border,
            }}
          >
            <Text style={{ color: active ? "#fff" : t.subtext, fontWeight: "500", fontSize: 13 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Native-feeling dropdown (matches web `<select>` for on-behalf). */
function SelectDropdown({ label, placeholder, value, options, onChange, t, required }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.id) === String(value));
  const display = selected?.label || placeholder || "Select…";

  return (
    <View style={{ marginBottom: 8 }}>
      {label ? (
        <Text style={{ color: t.subtext, fontWeight: "500", fontSize: 13, marginBottom: 6 }}>
          {label}{required ? " *" : ""}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: t.bg,
        }}
      >
        <Text
          style={{ flex: 1, color: selected ? t.text : t.muted, fontSize: 15, fontWeight: "300"}}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{
              backgroundColor: t.card,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: "70%",
              paddingBottom: 24,
            }}
          >
            <View style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.border,
            }}
            >
              <Text style={{ fontWeight: "500", fontSize: 16, color: t.text }}>{label || "Select"}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ color: t.accent, fontWeight: "500" }}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = String(item.id) === String(value);
                return (
                  <TouchableOpacity
                    onPress={() => { onChange(item.id); setOpen(false); }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 14,
                      backgroundColor: active ? `${t.accent}14` : "transparent",
                      borderBottomWidth: 1, borderBottomColor: t.border,
                    }}
                  >
                    <Text style={{ color: t.text, fontWeight: active ? "800" : "600", fontSize: 15 }}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300"}}>{item.sublabel}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: t.muted, textAlign: "center", padding: 24, fontWeight: "300"}}>No options available</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function buildPayUrl(success) {
  const attempt = success?.active_attempt || success?.attempts?.[0];
  if (attempt?.payment_url && /^https?:\/\//i.test(attempt.payment_url)) {
    return rewritePublicFrontendUrl(attempt.payment_url);
  }
  const path = attempt?.public_pay_path;
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return rewritePublicFrontendUrl(path);
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function CreateBillingScreen({ navigation }) {
  const t = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const zelleUpi = canUseZelleUpi(user);
  const onBehalfAllowed = canSendOnBehalfOf(user);
  const needsOnBehalf = requiresOnBehalf(user);
  const methods = useMemo(() => allowedMethods(user), [user]);
  const allowCreate = canCreateInvoice(user);
  const { query, setQuery } = useScreenQuery({ mode: "invoice" });
  const mode = query.mode || "invoice";

  const [client, setClient] = useState({
    awl_id: "AWL-", client_name: "", client_email: "", client_phone: "",
  });
  const [cart, setCart] = useState([]);
  const [method, setMethod] = useState("razorpay");
  const [paymentKind, setPaymentKind] = useState("first");
  const [nasUrl, setNasUrl] = useState("");
  const [zelleEmail, setZelleEmail] = useState("");
  const [zellePhone, setZellePhone] = useState("");
  const [upiKey, setUpiKey] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState("paypal");
  const [onBehalfOfId, setOnBehalfOfId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponRequestLoading, setCouponRequestLoading] = useState(false);
  const [classification, setClassification] = useState(null);

  const [services, setServices] = useState([]);
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [zelleAccounts, setZelleAccounts] = useState({ emails: [], phones: [] });
  const [subordinates, setSubordinates] = useState([]);
  const [usdInrRate, setUsdInrRate] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [requestSuccess, setRequestSuccess] = useState(null);
  const [requestNotes, setRequestNotes] = useState("");

  const cartTotal = useMemo(
    () => cart.reduce((s, c) => s + c.unit_price * c.quantity, 0),
    [cart],
  );
  const displayTotal = couponPreview?.discounted_total ?? cartTotal;
  const bypassMin = canBypassMinAmount(user);
  const belowMinLines = useMemo(
    () => cart.filter((item) => item.min_amount > 0 && Number(item.unit_price) < Number(item.min_amount)),
    [cart],
  );
  const needsMinApproval = mode === "invoice" && belowMinLines.length > 0 && !bypassMin;
  const qtyMap = useMemo(
    () => Object.fromEntries(cart.map((c) => [c.service_id, c.quantity])),
    [cart],
  );

  const CATALOG_TTL_MS = 15 * 60_000; // TTL-only on mobile — Redis invalidation does not reach the device.

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const cachedSvc = getCached("catalog:services", CATALOG_TTL_MS);
      if (cachedSvc && !cachedSvc.stale) {
        setServices(toList(cachedSvc.data).filter((s) => s.is_active !== false));
      } else {
        const { data } = await api.get("/services/");
        const list = toList(data).filter((s) => s.is_active !== false);
        setServices(list);
        setCached("catalog:services", list);
      }
    } catch (e) {
      toast.error(formatApiError(e, "Could not load services."));
    }

    if (onBehalfAllowed) {
      try {
        const cachedSub = getCached("catalog:subordinates", CATALOG_TTL_MS);
        if (cachedSub && !cachedSub.stale) {
          setSubordinates(toList(cachedSub.data));
        } else {
          const { data } = await api.get("/users/subordinates/");
          const list = toList(data);
          setSubordinates(list);
          setCached("catalog:subordinates", list);
        }
      } catch (e) {
        toast.error(formatApiError(e, "Could not load associates."));
      }
    }

    if (zelleUpi) {
      try {
        const cachedUpi = getCached("catalog:upi-accounts", CATALOG_TTL_MS);
        const cachedZelle = getCached("catalog:zelle-accounts", CATALOG_TTL_MS);
        if (cachedUpi && !cachedUpi.stale && cachedZelle && !cachedZelle.stale) {
          setUpiAccounts(normalizeUpiAccounts(cachedUpi.data));
          setZelleAccounts(normalizeZelleAccounts(cachedZelle.data));
        } else {
          const [upi, zelle] = await Promise.all([
            api.get("/billing/upi-accounts/"),
            api.get("/billing/zelle-accounts/"),
          ]);
          setUpiAccounts(normalizeUpiAccounts(upi.data));
          setZelleAccounts(normalizeZelleAccounts(zelle.data));
          setCached("catalog:upi-accounts", upi.data);
          setCached("catalog:zelle-accounts", zelle.data);
        }
      } catch (e) {
        toast.error(formatApiError(e, "Could not load payment accounts."));
      }
    }
    setMetaLoading(false);
  }, [zelleUpi, onBehalfAllowed, toast]);

  const associateOptions = useMemo(() => {
    const rows = subordinates
      .filter((sub) => String(sub.id) !== String(user?.id))
      .map((sub) => ({
        id: String(sub.id),
        label: sub.name || sub.email || String(sub.id),
        sublabel: sub.role_name || sub.hierarchy_level_name || sub.email || "",
      }));
    if (!needsOnBehalf) {
      return [{ id: "", label: "Myself", sublabel: "Bill as yourself" }, ...rows];
    }
    return rows;
  }, [subordinates, user?.id, needsOnBehalf]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  useEffect(() => {
    if (method !== "zelle") return;
    if (!zelleEmail && zelleAccounts.emails?.length) {
      setZelleEmail(zelleAccounts.emails[0].value);
    }
  }, [zelleAccounts, method, zelleEmail]);

  useEffect(() => {
    if (method !== "upi") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        if (!cancelled) setUsdInrRate(data?.rates?.INR || null);
      } catch {
        if (!cancelled) setUsdInrRate(null);
      }
    })();
    return () => { cancelled = true; };
  }, [method]);

  useEffect(() => {
    setCouponPreview(null);
    setCouponError(null);
  }, [cart, method]);

  useEffect(() => {
    if (!methods.find((m) => m.id === method)) {
      setMethod(methods[0]?.id || "razorpay");
    }
  }, [methods, method]);

  // Experience → suggest UPI (same as web)
  useEffect(() => {
    if (!zelleUpi || !services.length || cart.length === 0) return;
    const hasExperience = cart.some((c) => {
      const svc = services.find((s) => s.id === c.service_id);
      const name = (svc?.name || "").toLowerCase();
      return name.includes("experience") || (svc?.preferred_collection_methods || []).includes("upi");
    });
    if (hasExperience && method === "zelle") setMethod("upi");
  }, [zelleUpi, cart, services, method]);

  useEffect(() => {
    if (cart.length === 0) { setClassification(null); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post("/billing/classification-preview/", {
          items: cart.map((c) => ({
            service_id: c.service_id, quantity: c.quantity, unit_price: c.unit_price,
          })),
        });
        setClassification(data);
      } catch {
        setClassification(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [cart]);

  const lastCrmAwl = useRef("");

  useEffect(() => {
    const awl = client.awl_id?.trim();
    if (!awl || awl.length < 5 || awl.toUpperCase() === "AWL-") {
      lastCrmAwl.current = "";
      return undefined;
    }
    // Only lookup once per distinct AWL — avoid continuous CRM sync loops
    if (awl === lastCrmAwl.current) return undefined;

    const timer = setTimeout(async () => {
      lastCrmAwl.current = awl;
      setCrmLoading(true);
      try {
        const { data } = await api.get("/crm/leads/", { params: { awl_id: awl } });
        const lead = data.data || data.lead;
        if (data.found && lead) {
          setClient((p) => ({
            ...p,
            client_name: lead.name || p.client_name,
            client_email: lead.email || p.client_email,
            client_phone: lead.phone || p.client_phone,
          }));
          toast.success("Client loaded from CRM");
        }
      } catch (e) {
        // Soft fail — user can still type manually
      } finally {
        setCrmLoading(false);
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast must not retrigger CRM
  }, [client.awl_id]);

  const addService = (svc) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.service_id === svc.id);
      if (ex) return prev.map((c) => (c.service_id === svc.id ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, {
        service_id: svc.id,
        service_name: svc.name,
        quantity: 1,
        unit_price: parseFloat(svc.amount),
        min_amount: parseFloat(svc.min_amount || 0),
      }];
    });
  };

  const updateCart = (serviceId, patch) => {
    setCart((prev) => prev.map((c) => (c.service_id === serviceId ? { ...c, ...patch } : c)));
  };

  const applyCoupon = async () => {
    setCouponError(null);
    setCouponPreview(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponError("Enter a coupon code."); return; }
    if (!cart.length) { setCouponError("Add services before applying a coupon."); return; }
    setCouponCode(code);
    setCouponLoading(true);
    try {
      const { data } = await api.post("/payments/coupons/validate/", {
        coupon_code: code,
        provider: couponProviderForMethod(method),
        service_items: cart.map((item) => ({
          service_id: item.service_id,
          name: item.service_name,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
        })),
      });
      // Proxy may nest payload; accept either shape
      const preview = data?.valid != null ? data : data?.details;
      if (preview?.valid) {
        setCouponPreview(preview);
        toast.success(
          preview.total_savings != null
            ? `Coupon applied · saved ${fmtUsd(preview.total_savings)}`
            : "Coupon applied",
        );
      } else {
        setCouponError(preview?.message || data?.message || "Invalid coupon.");
      }
    } catch (e) {
      const data = e.response?.data;
      const details = data?.details;
      setCouponError(
        (data?.valid === false && data?.message)
        || details?.message
        || details?.detail
        || formatApiError(e, "Could not apply coupon."),
      );
    } finally {
      setCouponLoading(false);
    }
  };

  const clearCoupon = () => {
    setCouponCode("");
    setCouponPreview(null);
    setCouponError(null);
  };

  const requestCoupon = async () => {
    if (!client.awl_id?.trim() || !client.client_name?.trim()) {
      toast.error("Enter AWL ID and client name before requesting a coupon.");
      return;
    }
    if (!cart.length) {
      toast.error("Add services before requesting a coupon.");
      return;
    }
    setCouponRequestLoading(true);
    try {
      const { createCouponRequest } = await import("../../api/admin");
      const data = await createCouponRequest({
        awl_id: client.awl_id,
        client_name: client.client_name,
        client_email: client.client_email,
        client_phone: client.client_phone,
        service_ids: cart.map((c) => c.service_id),
      });
      toast.success(
        `Request sent to ${data.manager_name || "your manager"}. Approve unlocks after 10 minutes.`,
      );
    } catch (e) {
      toast.error(formatApiError(e, "Could not send coupon request."));
    } finally {
      setCouponRequestLoading(false);
    }
  };

  const submit = async () => {
    if (!client.client_name || !client.client_email) {
      toast.error("Client name and email are required.");
      return;
    }
    if (!cart.length) { toast.error("Add at least one service."); return; }

    if (mode === "invoice") {
      if (!paymentKind) { toast.error("Select a payment type (First, Renewal, or Add-on)."); return; }
      if (needsMinApproval) {
        const awl = (client.awl_id || "").trim().toUpperCase();
        if (!awl || awl === "AWL-" || awl.length < 6) {
          toast.error("A valid AWL-ID is required to request a below-minimum invoice.");
          return;
        }
      } else {
        for (const item of cart) {
          if (item.min_amount > 0 && item.unit_price < item.min_amount && !bypassMin) {
            toast.error(`Price for ${item.service_name} cannot be below $${item.min_amount}.`);
            return;
          }
        }
      }
      if (method === "nas" && !nasUrl.trim()) { toast.error("NAS payment URL is required."); return; }
      if (method === "zelle" && !zelleEmail.trim() && !zellePhone.trim()) {
        toast.error("Zelle email or phone required.");
        return;
      }
      if (method === "upi" && !upiKey) { toast.error("Select a UPI account."); return; }
      if (needsOnBehalf && !onBehalfOfId) {
        toast.error("Select an associate — managers must bill on behalf of a team member.");
        return;
      }
    } else if (!client.client_email) {
      toast.error("Client email is required.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "invoice") {
        const payload = {
          awl_id: client.awl_id,
          client_name: client.client_name,
          client_email: client.client_email,
          client_phone: client.client_phone,
          collection_method: method,
          payment_kind: paymentKind,
          notes,
          send_email: sendEmail,
          created_by_id: onBehalfOfId || undefined,
          items: cart.map((c) => ({
            service_id: c.service_id, quantity: c.quantity, unit_price: c.unit_price,
          })),
          nas_payment_url: nasUrl,
          zelle_recipient_email: zelleEmail,
          zelle_recipient_phone: zellePhone,
          upi_account_key: upiKey,
          ...(couponCode.trim() && !needsMinApproval ? { coupon_code: couponCode.trim().toUpperCase() } : {}),
        };
        if (needsMinApproval) {
          const { createInvoiceRequest } = await import("../../api/invoiceRequests");
          const data = await createInvoiceRequest({ ...payload, request_notes: requestNotes.trim() });
          setRequestSuccess(data);
          toast.success(`Request ${data.request_number} sent to admins`);
        } else {
          const { data } = await api.post("/billing/intents/", payload);
          setSuccess(data);
          toast.success(`Invoice ${data.intent_number} created`);
        }
      } else {
        const { data } = await api.post("/paylinks/", {
          awl_id: client.awl_id,
          client_name: client.client_name,
          client_email: client.client_email,
          client_phone: client.client_phone,
          notes,
          provider,
          payment_kind: paymentKind,
          items: cart.map((c) => ({ service_id: c.service_id, quantity: c.quantity })),
        });
        setSuccess({ ...data, isPaylink: true });
        toast.success("Pay link created");
      }
    } catch (e) {
      toast.error(formatApiError(e, "Could not create. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const copyPayUrl = async (url) => {
    try {
      await Clipboard.setStringAsync(url);
      toast.success("Payment link copied");
    } catch {
      await Share.share({ message: url });
    }
  };

  if (!allowCreate) {
    return (
      <Screen>
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, fontSize: 18, marginBottom: 8 }}>
            No permission
          </Text>
          <Text style={{ color: t.subtext, marginBottom: 16, fontWeight: "300"}}>
            Your role cannot create invoices. Ask an admin if you need access.
          </Text>
          <Button title="Go back" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  if (metaLoading && !services.length) {
    return (
      <Screen>
        <ListSkeleton rows={10} />
      </Screen>
    );
  }

  if (requestSuccess) {
    return (
      <Screen scroll>
        <Card style={{ alignItems: "center", padding: 28 }}>
          <Text style={{ fontSize: 20, fontWeight: "500", color: t.text }}>Request sent</Text>
          <Text style={{ color: t.subtext, marginTop: 6, fontWeight: "300" }}>
            {requestSuccess.request_number} · {requestSuccess.awl_id}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 12, textAlign: "center", fontWeight: "300" }}>
            Admins were notified. The invoice is created and sent to the client only after approval.
          </Text>
          <Button
            title="View requests"
            onPress={() => navigation.replace("InvoiceRequests")}
            style={{ marginTop: 20, alignSelf: "stretch" }}
          />
          <Button title="Done" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 10, alignSelf: "stretch" }} />
        </Card>
      </Screen>
    );
  }

  if (success) {
    const attempt = success.active_attempt || success.attempts?.[0];
    const payUrl = rewritePublicFrontendUrl(
      success.isPaylink
        ? (success.payment_url || success.url || success.link)
        : buildPayUrl(success)
    );
    const methodLabel = METHOD_LABELS[attempt?.collection_method] || attempt?.collection_method;

    return (
      <Screen scroll>
        <Card style={{ alignItems: "center", padding: 28 }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>✓</Text>
          <Text style={{ fontSize: 20, fontWeight: "500", color: t.text }}>
            {success.isPaylink ? "Pay link ready" : "Invoice created"}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 6, fontWeight: "300"}}>
            {success.intent_number || success.reference_number}
          </Text>
          {!success.isPaylink && (
            <Text style={{ fontSize: 24, fontWeight: "500", color: t.text, marginTop: 16 }}>
              {fmtUsd(success.amount)}
            </Text>
          )}
          {methodLabel ? (
            <View style={{
              marginTop: 10, paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: 8, backgroundColor: t.bg,
            }}
            >
              <Text style={{ color: t.subtext, fontWeight: "500", fontSize: 12 }}>{methodLabel}</Text>
            </View>
          ) : null}
          {success.payment_kind_display || success.payment_kind ? (
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 8, fontWeight: "300"}}>
              {success.payment_kind_display || success.payment_kind}
            </Text>
          ) : null}
          {payUrl ? (
            <View style={{ width: "100%", marginTop: 16 }}>
              <Text style={{ color: t.subtext, fontSize: 11, fontWeight: "500", marginBottom: 6 }}>
                PAYMENT LINK
              </Text>
              <Text
                selectable
                style={{
                  fontSize: 12, color: t.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  backgroundColor: t.bg, padding: 10, borderRadius: 8, marginBottom: 10,
                }}
              >
                {payUrl}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Copy" variant="outline" onPress={() => copyPayUrl(payUrl)} style={{ flex: 1 }} />
                <Button title="Open" onPress={() => Linking.openURL(payUrl)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
          <Button title="Done" onPress={() => navigation.goBack()} style={{ marginTop: 20, width: "100%" }} />
          <Button
            title="Create another"
            variant="outline"
            onPress={() => { setSuccess(null); setCart([]); clearCoupon(); }}
            style={{ marginTop: 10, width: "100%" }}
          />
        </Card>
      </Screen>
    );
  }

  const submitLabel = mode === "invoice"
    ? `${needsMinApproval ? "Request approval" : "Create"} · ${fmtUsd(displayTotal)}${
      method === "upi" && usdInrRate ? ` (≈ ${fmtInr(displayTotal * usdInrRate)})` : ""
    }`
    : "Generate pay link";

  return (
    <Screen scroll>
      <Text style={{ fontSize: 26, fontWeight: "500", color: t.text, marginBottom: 4 }}>New invoice</Text>
      <Text style={{ color: t.subtext, marginBottom: 16, fontWeight: "300"}}>Bill a client via your preferred payment method</Text>

      <ChipRow
        items={[{ id: "invoice", label: "Invoice" }, { id: "paylink", label: "Pay link" }]}
        value={mode}
        onChange={(m) => setQuery({ mode: m })}
        t={t}
      />

      {onBehalfAllowed && mode === "invoice" && (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>
            Associate assignment (on behalf of)
          </Text>
          <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 10, fontWeight: "300"}}>
            {needsOnBehalf
              ? "Required for managers — revenue is credited to the selected associate."
              : "Optional — bill as a team member."}
          </Text>
          <SelectDropdown
            label="Associate"
            placeholder="Select associate…"
            value={onBehalfOfId}
            options={associateOptions}
            onChange={setOnBehalfOfId}
            t={t}
            required={needsOnBehalf}
          />
        </Card>
      )}

      <Card>
        <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Client</Text>
        <Field
          label={crmLoading ? "AWL ID (syncing…)" : "AWL ID"}
          value={client.awl_id}
          onChangeText={(v) => {
            if (!v.startsWith("AWL-")) v = `AWL-${v.replace(/^AWL-?/, "")}`;
            setClient({ ...client, awl_id: v });
          }}
          autoCapitalize="characters"
        />
        <Field label="Name" value={client.client_name} onChangeText={(v) => setClient({ ...client, client_name: v })} />
        <Field
          label="Email"
          value={client.client_email}
          onChangeText={(v) => setClient({ ...client, client_email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Phone"
          value={client.client_phone}
          onChangeText={(v) => setClient({ ...client, client_phone: v })}
          keyboardType="phone-pad"
        />
      </Card>

      {mode === "invoice" ? (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Payment</Text>
          <ChipRow items={methods} value={method} onChange={setMethod} t={t} />
          <Text style={{ color: t.subtext, fontWeight: "500", fontSize: 13, marginBottom: 6 }}>Payment type</Text>
          <ChipRow items={PAYMENT_KINDS} value={paymentKind} onChange={setPaymentKind} t={t} />
          {method === "nas" && (
            <Field label="NAS payment URL" value={nasUrl} onChangeText={setNasUrl} placeholder="https://…" autoCapitalize="none" />
          )}
          {method === "zelle" && (
            <View>
              <Text style={{ color: t.subtext, fontWeight: "500", fontSize: 13, marginBottom: 6 }}>Zelle email</Text>
              <ChipRow
                items={[
                  { id: "", label: "None" },
                  ...zelleAccounts.emails.map((a) => ({
                    id: a.value,
                    label: a.label ? `${a.label}` : a.value,
                  })),
                ]}
                value={zelleEmail}
                onChange={setZelleEmail}
                t={t}
              />
              {!zelleAccounts.emails.length && (
                <Field label="Zelle email (manual)" value={zelleEmail} onChangeText={setZelleEmail} autoCapitalize="none" keyboardType="email-address" />
              )}
              <Text style={{ color: t.subtext, fontWeight: "500", fontSize: 13, marginBottom: 6 }}>Zelle mobile</Text>
              <ChipRow
                items={[
                  { id: "", label: "None" },
                  ...zelleAccounts.phones.map((a) => ({
                    id: a.value,
                    label: a.label ? `${a.label}` : a.value,
                  })),
                ]}
                value={zellePhone}
                onChange={setZellePhone}
                t={t}
              />
              {!zelleAccounts.phones.length && (
                <Field label="Zelle phone (manual)" value={zellePhone} onChangeText={setZellePhone} keyboardType="phone-pad" />
              )}
            </View>
          )}
          {method === "upi" && (
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ color: t.subtext, fontWeight: "500", fontSize: 13 }}>UPI account</Text>
                {usdInrRate && displayTotal > 0 ? (
                  <Text style={{ color: t.success || "#059669", fontWeight: "500", fontSize: 12 }}>
                    ≈ {fmtInr(displayTotal * usdInrRate)}
                  </Text>
                ) : null}
              </View>
              {upiAccounts.length > 0 ? (
                <ChipRow
                  items={upiAccounts.map((a) => ({
                    id: a.key,
                    label: a.label || a.vpa_masked || a.key,
                  }))}
                  value={upiKey}
                  onChange={setUpiKey}
                  t={t}
                />
              ) : (
                <Text style={{ color: t.muted, fontSize: 13, fontWeight: "300"}}>No UPI accounts configured</Text>
              )}
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Gateway</Text>
          <ChipRow
            items={[{ id: "paypal", label: "PayPal" }, { id: "razorpay", label: "Razorpay" }]}
            value={provider}
            onChange={setProvider}
            t={t}
          />
          <ChipRow items={PAYMENT_KINDS} value={paymentKind} onChange={setPaymentKind} t={t} />
        </Card>
      )}

      <Card>
        <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Services</Text>
        {services.map((svc) => (
          <TouchableOpacity
            key={svc.id}
            onPress={() => addService(svc)}
            style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: t.border,
            }}
          >
            <Text style={{ flex: 1, color: t.text }} numberOfLines={1}>{svc.name}</Text>
            <Text style={{ fontWeight: "500", color: t.text, marginRight: 10 }}>{fmtUsd(svc.amount)}</Text>
            {qtyMap[svc.id] ? (
              <View style={{
                backgroundColor: t.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8,
              }}
              >
                <Text style={{ fontSize: 11, fontWeight: "500", color: t.subtext }}>{qtyMap[svc.id]}</Text>
              </View>
            ) : null}
            <Text style={{ color: t.accent, fontWeight: "500" }}>+</Text>
          </TouchableOpacity>
        ))}
        {!services.length && (
          <Text style={{ color: t.muted, textAlign: "center", padding: 16, fontWeight: "300"}}>No services loaded</Text>
        )}
      </Card>

      {cart.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>
            Cart · {fmtUsd(displayTotal)}
            {couponPreview ? (
              <Text style={{ color: t.subtext, fontWeight: "500" }}>
                {" "}(was {fmtUsd(cartTotal)})
              </Text>
            ) : null}
          </Text>
          {classification?.payment_kind ? (
            <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 10, fontWeight: "300"}}>
              Suggested type: {classification.payment_kind}
              {Array.isArray(classification.lines) && classification.lines.length
                ? ` · ${classification.lines.map((l) => l.billing_role || l.service_name).filter(Boolean).join(", ")}`
                : ""}
            </Text>
          ) : null}
          {cart.map((item) => (
            <View key={item.service_id} style={{ marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: t.text, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                  {item.service_name}
                </Text>
                <TouchableOpacity onPress={() => setCart((p) => p.filter((c) => c.service_id !== item.service_id))}>
                  <Text style={{ color: t.danger }}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.muted, fontSize: 11, marginBottom: 4, fontWeight: "300"}}>Unit price ($)</Text>
                  <TextInput
                    value={String(item.unit_price)}
                    onChangeText={(v) => updateCart(item.service_id, { unit_price: parsePriceInput(v) })}
                    keyboardType="decimal-pad"
                    placeholderTextColor={t.muted}
                    style={{
                      borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 10,
                      paddingVertical: 8, color: t.text, backgroundColor: t.bg,
                    }}
                  />
                  {item.min_amount > 0 ? (
                    <Text style={{ color: t.muted, fontSize: 10, marginTop: 2, fontWeight: "300"}}>Min ${item.min_amount}</Text>
                  ) : null}
                </View>
                <View style={{ width: 80 }}>
                  <Text style={{ color: t.muted, fontSize: 11, marginBottom: 4, fontWeight: "300"}}>Qty</Text>
                  <TextInput
                    value={String(item.quantity)}
                    onChangeText={(v) => updateCart(item.service_id, { quantity: parseQuantityInput(v) })}
                    keyboardType="number-pad"
                    placeholderTextColor={t.muted}
                    style={{
                      borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 10,
                      paddingVertical: 8, color: t.text, backgroundColor: t.bg, textAlign: "center",
                    }}
                  />
                </View>
                <Text style={{ fontWeight: "500", color: t.text, marginTop: 14 }}>
                  {fmtUsd(item.unit_price * item.quantity)}
                </Text>
              </View>
            </View>
          ))}

          {mode === "invoice" && (
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontWeight: "500", color: t.text, marginBottom: 8 }}>Discount</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput
                  value={couponCode}
                  onChangeText={(v) => setCouponCode(String(v || "").toUpperCase())}
                  placeholder="Coupon code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholderTextColor={t.muted}
                  style={{
                    flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 10, color: t.text, backgroundColor: t.bg,
                  }}
                />
                <Button
                  title={couponLoading ? "…" : "Apply"}
                  onPress={applyCoupon}
                  loading={couponLoading}
                  disabled={couponLoading || !couponCode.trim() || !cart.length}
                  style={{ paddingHorizontal: 16, minWidth: 88 }}
                />
                {couponPreview ? (
                  <Button title="Clear" variant="outline" onPress={clearCoupon} style={{ paddingHorizontal: 12 }} />
                ) : null}
              </View>
              {couponError ? <Text style={{ color: t.danger, fontSize: 12, marginTop: 6 }}>{couponError}</Text> : null}
              {couponPreview ? (
                <Text style={{ color: t.success, fontSize: 13, fontWeight: "500", marginTop: 8 }}>
                  Applied · total {fmtUsd(couponPreview.discounted_total ?? displayTotal)}
                  {couponPreview.total_savings != null
                    ? ` (saved ${fmtUsd(couponPreview.total_savings)})`
                    : ""}
                </Text>
              ) : null}
              <Button
                title="Request coupon"
                variant="outline"
                loading={couponRequestLoading}
                onPress={requestCoupon}
                style={{ marginTop: 10 }}
              />
            </View>
          )}
        </Card>
      )}

      <Card>
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        {mode === "invoice" && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: "500", color: t.text }}>Send email to client</Text>
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2, fontWeight: "300"}}>
                Email the payment link when the invoice is created
              </Text>
            </View>
            <Switch value={sendEmail} onValueChange={setSendEmail} trackColor={{ true: t.accent }} />
          </View>
        )}
      </Card>

      {needsMinApproval ? (
        <Card>
          <Text style={{ fontWeight: "500", color: t.text, marginBottom: 6 }}>Below-minimum request</Text>
          <Text style={{ color: t.subtext, fontSize: 12, marginBottom: 10, fontWeight: "300" }}>
            This price is below the service minimum. Admins must approve before the invoice is created and sent.
            A coupon on a price that meets the minimum still creates immediately.
          </Text>
          <Field
            label="Notes for admins (optional)"
            value={requestNotes}
            onChangeText={setRequestNotes}
            multiline
          />
        </Card>
      ) : null}

      <Button
        title={loading ? (needsMinApproval ? "Sending…" : "Creating…") : submitLabel}
        onPress={submit}
        loading={loading}
        disabled={!cart.length}
        style={{ marginBottom: 40 }}
      />
    </Screen>
  );
}
