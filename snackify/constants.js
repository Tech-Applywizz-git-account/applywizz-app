export const LOCATIONS = [
  "Balaji Cabin",
  "RK Cabin",
  "Manisha Cabin",
  "Resume Cabin",
  "Tech Team",
  "Marketing Team",
  "Conference Room",
];

export const CABIN_MAP = {
  "Balaji Cabin": "Balaji Cabin",
  "RK Cabin": "Rama Krishna Cabin",
  "Manisha Cabin": "Manisha Cabin",
  "Resume Cabin": "Resume Cabin",
  "Tech Team": "Tech Cabin",
  "Marketing Team": "Marketing Cabin",
};

export const SHIFTS = [
  { id: "morning", label: "Morning (9 AM – 5 PM)" },
  { id: "night", label: "Night (8 PM – 5:30 AM)" },
];

export const TONES = [
  { id: "Professional", label: "Professional" },
  { id: "Friendly", label: "Friendly" },
  { id: "Funny", label: "Funny" },
  { id: "Mom Mode", label: "Mom Mode" },
  { id: "Minimal", label: "Minimal" },
  { id: "gen_z", label: "Gen Z" },
  { id: "boyfriend", label: "Boyfriend", gender: "female" },
  { id: "girlfriend", label: "Girlfriend", gender: "male" },
];

export const ONBOARDING_DRINKS = [
  "Espresso", "Latte", "Cappuccino", "Hot Chocolate", "Badam Mix",
  "Assam Tea", "Elaichi Tea", "Ginger Tea", "Green Tea", "Lemon Tea",
  "Water", "None for me",
];

export const ONBOARDING_SNACKS = [
  "Bread + Peanut Butter", "Bread + Jam", "Biscuits",
];

export const TASTE_PREFS = {
  Coffee: ["Strong Coffee", "Light Coffee", "Less Sugar", "No Sugar", "With Milk", "Without Milk"],
  Tea: ["Strong Tea", "Light Tea", "Less Sugar", "No Sugar"],
  Lemon: ["Normal", "Less Sugar", "Strong Lemon", "Mild Lemon", "With Honey 🍯", "Without Honey"],
  "Green tea": ["Plain Green Tea", "With Honey 🍯", "With Lemon", "Light Brew", "Strong Brew"],
};

export const WEEKDAY_MEALS = {
  1: ["veg"],
  2: ["veg", "egg"],
  3: ["veg", "non_veg"],
  4: ["veg", "egg"],
  5: ["veg", "non_veg"],
};

export function onionAllowed(dayOfWeek, choice) {
  return (dayOfWeek === 3 || dayOfWeek === 5) && choice === "non_veg";
}

export const ONION_OPTIONS = ["no onion", "1 slice", "2 slices", "3 slices"];

export const LIVE_STEPS_DELIVERY = ["confirming", "placed", "accepted", "preparing", "on_the_way", "done"];
export const LIVE_STEPS_PICKUP = ["confirming", "placed", "accepted", "preparing", "ready_for_pickup", "done"];

export const QUEUE_NEXT = {
  pending: { status: "in_progress", live_status: "accepted" },
  placed: { status: "in_progress", live_status: "accepted" },
  accepted: { status: "in_progress", live_status: "preparing" },
  preparing_delivery: { status: "in_progress", live_status: "on_the_way" },
  preparing_pickup: { status: "in_progress", live_status: "ready_for_pickup" },
  on_the_way: { status: "done", live_status: "done" },
  ready_for_pickup: { status: "done", live_status: "done" },
};

/** Lunch counter digital ticket — enabled 11:00–14:00 Asia/Kolkata. */
export const MEAL_TICKET_WINDOW_LABEL = "Available 11:00 AM – 2:00 PM";

/** YYYY-MM-DD in Asia/Kolkata. */
export function istDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

/** Minutes since midnight in Asia/Kolkata for `date` (default now). */
export function istMinutesSinceMidnight(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

/** True when IST local time is ≥ 11:00 and < 14:00. */
export function isMealTicketWindow(now = new Date()) {
  const m = istMinutesSinceMidnight(now);
  return m >= 11 * 60 && m < 14 * 60;
}

export function mealTicketWindowLabel() {
  return MEAL_TICKET_WINDOW_LABEL;
}

/** Next Mon–Fri date after `from` (YYYY-MM-DD, IST calendar). */
export function nextWorkingIstDate(from = istDateString()) {
  const [y, mo, da] = String(from).split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da));
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatIstDateLabel(iso) {
  const [y, mo, da] = String(iso || "").split("-").map(Number);
  if (!y || !mo || !da) return iso || "";
  const d = new Date(Date.UTC(y, mo - 1, da));
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function isBeforeMealTicketWindow(now = new Date()) {
  return istMinutesSinceMidnight(now) < 11 * 60;
}

export function isAfterMealTicketWindow(now = new Date()) {
  return istMinutesSinceMidnight(now) >= 14 * 60;
}

/** Normalize snackApi.myToken / booking payloads. */
export function unwrapMealTokenPayload(data) {
  if (!data || typeof data !== "object") return null;
  if (data.token && typeof data.token === "object") return data.token;
  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) return data.data;
  if (data.booking && typeof data.booking === "object") return data.booking;
  return data;
}

function bookingDateOf(row) {
  return String(row?.date || row?.booking_date || row?.meal_date || "").slice(0, 10);
}

function bookingChoiceOf(row) {
  return String(row?.choice || row?.meal_type || row?.status || "").toLowerCase().trim();
}

/** Today's or next-day non-skip lunch booking (bookings are usually for tomorrow). */
export function findRelevantMealBooking(bookings, today = istDateString()) {
  const list = Array.isArray(bookings)
    ? bookings
    : (bookings?.bookings || bookings?.results || []);
  if (!Array.isArray(list)) return null;

  const tomorrow = (() => {
    const [y, mo, da] = today.split("-").map(Number);
    const d = new Date(Date.UTC(y, mo - 1, da));
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const usable = (row) => {
    const choice = bookingChoiceOf(row);
    return choice && choice !== "skip";
  };

  const todayHit = list.find((row) => bookingDateOf(row) === today && usable(row));
  if (todayHit) return todayHit;
  return list.find((row) => bookingDateOf(row) === tomorrow && usable(row)) || null;
}

/** @deprecated use findRelevantMealBooking */
export function findTodayMealBooking(bookings, today = istDateString()) {
  return findRelevantMealBooking(bookings, today);
}

/**
 * True when user has a usable today meal for the ticket icon.
 * Accepts printed token OR today booking row (token may still be pending print).
 */
export function hasMealTicketToken(token) {
  if (!token || typeof token !== "object") return false;
  const choice = bookingChoiceOf(token);
  if (choice === "skip") return false;
  const code = token.token_number || token.token || token.code || token.id;
  if (code) return true;
  // Booking without printed token yet — still show icon so lunchers can open receipt.
  if (choice && ["veg", "egg", "non_veg", "non-veg", "nonveg"].includes(choice.replace(/-/g, "_").replace("nonveg", "non_veg"))) {
    return true;
  }
  if (choice && choice !== "skip") return true;
  return false;
}

function firstPresent(...vals) {
  for (const v of vals) {
    if (v == null || v === "") continue;
    if (typeof v === "object") continue;
    return v;
  }
  return undefined;
}

/** Merge print token + today booking into one display object. */
export function mergeMealTicketData(token, booking) {
  const t = unwrapMealTokenPayload(token) || {};
  const b = booking || {};
  const merged = { ...b, ...t };
  merged.choice = firstPresent(t.choice, t.meal_type, b.choice, b.meal_type, merged.choice, merged.meal_type);
  merged.meal_type = firstPresent(t.meal_type, b.meal_type, merged.meal_type);
  merged.date = firstPresent(t.date, t.meal_date, t.booking_date, b.date, b.meal_date, b.booking_date, merged.date);
  merged.cabin_name = firstPresent(t.cabin_name, t.cabin, b.cabin_name, b.cabin, merged.cabin_name, merged.cabin);
  merged.preferred_name = firstPresent(
    t.preferred_name, t.name, t.user_name, t.employee_name, t.cardholder, t.display_name,
    b.preferred_name, b.name, b.user_name, b.employee_name, b.cardholder, b.display_name,
    merged.preferred_name, merged.name,
  );
  merged.token_number = firstPresent(
    t.token_number, typeof t.token === "string" ? t.token : undefined, t.code,
    b.token_number, typeof b.token === "string" ? b.token : undefined, b.code,
    merged.token_number,
  );
  return Object.keys(merged).length ? merged : null;
}
