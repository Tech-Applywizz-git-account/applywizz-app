/** Client-side mirror of backend 8 PM – 8 PM IST business-day windows. */

export const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const businessDayLabel = (date) => {
  const d = new Date(date);
  if (d.getHours() >= 20) d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
};

const businessDayBounds = (labelStr) => {
  const label = new Date(`${labelStr}T12:00:00`);
  const prev = new Date(label);
  prev.setDate(prev.getDate() - 1);
  return {
    start: new Date(`${getLocalDateString(prev)}T20:00:00`),
    end: new Date(`${labelStr}T19:59:59`),
  };
};

const currentBusinessDayBounds = (now = new Date()) => {
  const label = businessDayLabel(now);
  const { start, end } = businessDayBounds(label);
  return { start, end: now < end ? now : end };
};

const hasClockTime = (value, timePart = "") => {
  const raw = String(value || "").trim();
  if (!raw && !timePart) return false;
  if (timePart) return true;
  return raw.includes("T") || raw.includes(" ") || raw.length > 10;
};

/**
 * Mirror backend resolve_date_range.
 * Date-only custom expands via business-day labels.
 * Explicit clock times are literal bounds (no off-by-one day).
 */
export const computeBusinessDayRangeMs = (
  dateRange,
  startDate = "",
  endDate = "",
  monthYear = "",
  startTime = "",
  endTime = "",
) => {
  if (!dateRange || dateRange === "all") return { startMs: null, endMs: null };

  const now = new Date();
  const currentLabel = businessDayLabel(now);
  const { end: currentEnd } = currentBusinessDayBounds(now);

  if (dateRange === "custom" && startDate && endDate) {
    const startHasClock = hasClockTime(startDate, startTime);
    const endHasClock = hasClockTime(endDate, endTime);
    const startIso = startDate.includes("T")
      ? startDate
      : (startHasClock && startTime ? `${startDate}T${startTime}` : startDate);
    const endIso = endDate.includes("T")
      ? endDate
      : (endHasClock && endTime ? `${endDate}T${endTime}` : endDate);
    const startLabel = new Date(startIso.length === 10 ? `${startIso}T12:00:00` : startIso);
    const endLabel = new Date(endIso.length === 10 ? `${endIso}T12:00:00` : endIso);
    if (Number.isNaN(startLabel.getTime()) || Number.isNaN(endLabel.getTime())) {
      return { startMs: null, endMs: null };
    }
    const rangeStart = startHasClock
      ? startLabel
      : businessDayBounds(getLocalDateString(startLabel)).start;
    let rangeEnd;
    if (endHasClock) {
      rangeEnd = endLabel.getTime() <= now.getTime() ? endLabel : now;
    } else {
      const endStr = getLocalDateString(endLabel);
      rangeEnd = endStr >= currentLabel ? currentEnd : businessDayBounds(endStr).end;
    }
    return { startMs: rangeStart.getTime(), endMs: rangeEnd.getTime() };
  }

  if (dateRange === "today") {
    const { start } = currentBusinessDayBounds(now);
    return { startMs: start.getTime(), endMs: currentEnd.getTime() };
  }

  if (dateRange === "yesterday") {
    const yLabel = new Date(`${currentLabel}T12:00:00`);
    yLabel.setDate(yLabel.getDate() - 1);
    const { start, end } = businessDayBounds(getLocalDateString(yLabel));
    return { startMs: start.getTime(), endMs: end.getTime() };
  }

  if (dateRange === "month" && monthYear) {
    const [year, month] = monthYear.split("-").map(Number);
    if (year && month) {
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      const start = businessDayBounds(getLocalDateString(first)).start;
      const lastStr = getLocalDateString(last);
      const end = lastStr >= currentLabel ? currentEnd : businessDayBounds(lastStr).end;
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
  }

  let rangeStart;
  if (dateRange === "this_week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    rangeStart = businessDayBounds(getLocalDateString(monday)).start;
  } else if (dateRange === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeStart = businessDayBounds(getLocalDateString(first)).start;
  } else if (dateRange === "last_30_days") {
    const label = new Date(`${currentLabel}T12:00:00`);
    label.setDate(label.getDate() - 29);
    rangeStart = businessDayBounds(getLocalDateString(label)).start;
  } else if (dateRange === "this_year") {
    const first = new Date(now.getFullYear(), 0, 1);
    rangeStart = businessDayBounds(getLocalDateString(first)).start;
  } else {
    return { startMs: null, endMs: null };
  }

  return { startMs: rangeStart.getTime(), endMs: currentEnd.getTime() };
};

const formatRangePoint = (ms) =>
  new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

/** Human-readable label for the active 8 PM – 8 PM filter window. */
export const businessDayFilterLabel = (
  dateRange,
  startDate = "",
  endDate = "",
  monthYear = "",
  startTime = "",
  endTime = "",
) => {
  if (!dateRange || dateRange === "all") return null;
  if (dateRange === "custom" && !(startDate && endDate)) return null;
  const { startMs, endMs } = computeBusinessDayRangeMs(
    dateRange,
    startDate,
    endDate,
    monthYear,
    startTime,
    endTime,
  );
  if (startMs == null || endMs == null || Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (dateRange === "custom") {
    return `Custom window: ${formatRangePoint(startMs)} → ${formatRangePoint(endMs)}`;
  }
  return `8 PM – 8 PM window: ${formatRangePoint(startMs)} → ${formatRangePoint(endMs)}`;
};
