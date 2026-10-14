/** Shared dashboard home normalization (screens + bootstrap prefetch). */

export function paidRevenueFromAnalytics(analytics) {
  if (!analytics || typeof analytics !== "object") return null;
  const nested = analytics.summary?.total_paid_revenue;
  if (nested != null && nested !== "") return Number(nested);
  if (analytics.total_paid_revenue != null && analytics.total_paid_revenue !== "") {
    return Number(analytics.total_paid_revenue);
  }
  if (analytics.total_revenue != null && analytics.total_revenue !== "") {
    return Number(analytics.total_revenue);
  }
  return null;
}

/**
 * Merge billing home + inbox + analytics into the shape DashboardScreen renders.
 * `rowInvoicePdfUrl` is optional to avoid a circular import during bootstrap.
 */
export function normalizeInboxHome(inbox, analytics = null, homePayload = null, rowInvoicePdfUrl = null) {
  const s = inbox?.summary || {};
  const rows = Array.isArray(inbox?.results) ? inbox.results : [];
  const fromAnalytics = paidRevenueFromAnalytics(analytics);
  const homePaid = homePayload?.paid_this_month != null ? Number(homePayload.paid_this_month) : null;
  const paidRevenue = fromAnalytics != null && !Number.isNaN(fromAnalytics)
    ? fromAnalytics
    : homePaid != null && !Number.isNaN(homePaid)
      ? homePaid
      : Number(s.paidTotal || 0);
  const summary = analytics?.summary || {};
  return {
    outstanding: Number(homePayload?.outstanding ?? s.openTotal ?? 0),
    overdue_amount: 0,
    overdue_count: Number(homePayload?.overdue_count ?? s.openCount ?? 0),
    paid_this_month: paidRevenue,
    paid_count: Number(s.paidCount || summary.total_paid_count || 0),
    open_count: Number(s.openCount || homePayload?.overdue_count || 0),
    total_count: Number(s.total || homePayload?.client_count || 0),
    draft_count: 0,
    client_count: Number(s.total || homePayload?.client_count || 0),
    revenue_trend: Array.isArray(analytics?.revenue_trend) ? analytics.revenue_trend : [],
    method_split: {
      paypal: Number(summary.paypal_revenue || analytics?.paypal_revenue || 0),
      razorpay: Number(summary.razorpay_revenue || analytics?.razorpay_revenue || 0),
      cashfree: Number(summary.cashfree_revenue || analytics?.cashfree_revenue || 0),
      other: Number(summary.other_revenue || analytics?.other_revenue || 0),
      paypal_count: Number(summary.paypal_count || 0),
      razorpay_count: Number(summary.razorpay_count || 0),
      cashfree_count: Number(summary.cashfree_count || 0),
      other_count: Number(summary.other_count || 0),
    },
    recent_documents: (Array.isArray(homePayload?.recent_documents) && homePayload.recent_documents.length
      ? homePayload.recent_documents
      : rows
    ).map((r) => ({
      id: r.id,
      source: r.source,
      number: r.number || r.reference || r.awlId || "—",
      client_name: r.client_name || r.clientName || "—",
      total: Number(r.total ?? r.amount ?? 0),
      currency: r.currency || "USD",
      status: r.status || r.displayStatus || "—",
      method: r.method || r.methodLabel || "",
      invoicePdf: (rowInvoicePdfUrl ? rowInvoicePdfUrl(r) : null) || r.invoicePdf,
      awlId: r.awlId || "",
      clientEmail: r.clientEmail || "",
    })),
  };
}
