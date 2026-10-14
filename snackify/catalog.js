const ELAICHI_TEA_LOCAL = require("./assets/elaichi-tea.png");

const SECTION_LABELS = {
  caffeine: "Caffeine Fix",
  tea: "Tea & Sachets",
  refreshment: "Refreshments",
  food: "Food / Pantry",
};

const CAT_ICONS = {
  caffeine: "cafe-outline",
  tea: "leaf-outline",
  refreshment: "water-outline",
  food: "fast-food-outline",
};

const IMAGES = [
  { re: /elaichi/i, url: ELAICHI_TEA_LOCAL },
  { re: /espresso/i, url: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80" },
  { re: /americano/i, url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80" },
  { re: /cappuccino|cappucino/i, url: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80" },
  { re: /latte/i, url: "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400&q=80" },
  { re: /mocha/i, url: "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80" },
  { re: /hot\s*chocolate/i, url: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&q=80" },
  { re: /badam/i, url: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=400&q=80" },
  { re: /kulhad/i, url: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&q=80" },
  { re: /ginger\s*tea/i, url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80" },
  { re: /green\s*tea/i, url: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80" },
  { re: /lemon\s*tea/i, url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80" },
  { re: /assam/i, url: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80" },
  { re: /masala|chai/i, url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80" },
  { re: /tea/i, url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80" },
  { re: /peanut\s*butter/i, url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80" },
  { re: /jam/i, url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80" },
  { re: /sandwich/i, url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80" },
  { re: /toast|paratha|idli/i, url: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&q=80" },
  { re: /biscuit/i, url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80" },
  { re: /cookie/i, url: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80" },
  { re: /chips|namkeen|muri/i, url: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80" },
  { re: /bread/i, url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80" },
  { re: /buttermilk/i, url: "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400&q=80" },
  { re: /juice/i, url: "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&q=80" },
  { re: /water|mineral/i, url: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80" },
  { re: /milk$/i, url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80" },
  { re: /sugar/i, url: "https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=400&q=80" },
  { re: /omelette|egg/i, url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80" },
  { re: /maggi|noodle/i, url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80" },
  { re: /samosa/i, url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80" },
  { re: /coffee/i, url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80" },
];

const CAT_FALLBACK = {
  caffeine: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80",
  tea: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80",
  refreshment: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80",
  food: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80",
  snack: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80",
};

function matchImage(name) {
  for (const { re, url } of IMAGES) {
    if (re.test(name)) return url;
  }
  return null;
}

function itemImg(name, cat) {
  return matchImage(name) || CAT_FALLBACK[cat] || CAT_FALLBACK.snack;
}

const HIDDEN_RE = /coffee\s*beans|lemon\s*sachets?|delivery\s*charge|sugar\s*sachet|cup\s*lid|sachet/i;
const REMOVED_RE = /regular\s*coffee|filter\s*coffee|\bamericano\b|\bmasala\b|\bkulhad\b/i;
const FINANCE_RE = /napkin|tissue|straw|cleaning|detergent|equipment|rental|charges|accessories|inventory\s*only/i;
const BACKING_RE = /peanut\s*butter|pineapple\s*jam|mix\s*fruit\s*jam|bread|brd\d/i;
const MILK_DEP_RE = /elaichi|ginger|assam|masala|chai|hot chocolate|badam|kulhad/i;

function getName(i) {
  return String(i.frontend_name || i.display_name || i.item_name || i.name || "").trim();
}

function asList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.rows)) return raw.rows;
  if (Array.isArray(raw?.menu)) return raw.menu;
  if (Array.isArray(raw?.cafeteria_items)) return raw.cafeteria_items;
  return [];
}

function findRow(items, nameRe) {
  return items.find((i) => nameRe.test(getName(i)));
}

function itemStock(i) {
  if (!i || typeof i !== "object") return null;
  const keys = [
    "stock_today", "stock_servings", "current_stock", "stock",
    "quantity", "available_qty", "count",
  ];
  let found = null;
  for (const k of keys) {
    const v = i[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isNaN(n)) continue;
    found = found == null ? n : Math.max(found, n);
  }
  return found;
}

function servingStock(i) {
  if (!i || typeof i !== "object") return null;
  if (i.stock_servings != null && i.stock_servings !== "") {
    const n = Number(i.stock_servings);
    if (!Number.isNaN(n)) return n;
  }
  return itemStock(i);
}

function inStock(i) {
  const s = servingStock(i);
  return s == null || s > 0;
}

function isBreadItem(name) {
  const n = String(name || "");
  if (/peanut|jam|sandwich/i.test(n)) return false;
  return /\bbread\b/i.test(n) || /^brd[\d_-]/i.test(n) || /\bbrd[\d_-]/i.test(n);
}

function hasStock(items, nameRe) {
  const found = findRow(items, nameRe);
  if (!found) return false;
  return inStock(found);
}

function guessCategory(name) {
  const n = String(name).toLowerCase();
  if (/coffee|capp|latte|espresso|americano|mocha|brew|hot\s*chocolate|badam/i.test(n)) return "caffeine";
  if (/tea|chai|elaichi|ginger|assam|masala|kulhad/i.test(n)) return "tea";
  if (/water|mineral|lemon|juice|soda|buttermilk|milk$/i.test(n)) return "refreshment";
  return "food";
}

function normName(name) {
  return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function nameKeys(name) {
  const n = normName(name);
  const key = n
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\s*(ml|l|ltr|litre|liter)s?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(new Set([n, key].filter(Boolean)));
}

const LOCAL_TOKEN_FALLBACKS = [
  { sku_code: "ESPRESSO", display_name: "Espresso", tokens: 10, aliases: ["espresso"] },
  { sku_code: "CAPPUCCINO", display_name: "Cappuccino", tokens: 20, aliases: ["cappuccino", "cappucino"] },
  { sku_code: "LATTE", display_name: "Latte", tokens: 20, aliases: ["latte", "cafe latte", "café latte"] },
  { sku_code: "MILK", display_name: "Milk", tokens: 10, aliases: ["milk"] },
  { sku_code: "GINGER_TEA", display_name: "Ginger Tea", tokens: 10, aliases: ["ginger tea", "ginger"] },
  { sku_code: "ASSAM_TEA", display_name: "Assam Tea", tokens: 10, aliases: ["assam tea", "assam"] },
  { sku_code: "LEMON_TEA", display_name: "Lemon Tea", tokens: 10, aliases: ["lemon tea"] },
  { sku_code: "BADAM_MILK", display_name: "Badam Milk", tokens: 20, aliases: ["badam milk", "badam", "badam sachet"] },
  { sku_code: "HOT_CHOCOLATE", display_name: "Hot Chocolate", tokens: 25, aliases: ["hot chocolate"] },
  { sku_code: "GREEN_TEA", display_name: "Green Tea", tokens: 25, aliases: ["green tea", "green tea sachet"] },
  { sku_code: "BREAD_PB", display_name: "Bread + Peanut Butter", tokens: 30, aliases: ["peanut butter sandwich", "bread + peanut butter", "bread + peanut", "peanut butter"] },
  { sku_code: "BREAD_JAM", display_name: "Bread + Jam", tokens: 15, aliases: ["mix fruit jam sandwich", "pineapple jam sandwich", "jam sandwich", "bread + jam", "jam"] },
  { sku_code: "WATER_BOTTLE", display_name: "Water Bottle", tokens: 10, aliases: ["water", "water bottle", "mineral water", "mineral water (1l)", "mineral water 1l", "packaged water", "bisleri", "kinley"] },
];

function catalogWithFallbacks(catalog = []) {
  const list = Array.isArray(catalog) ? catalog.slice() : [];
  for (const local of LOCAL_TOKEN_FALLBACKS) {
    const sku = String(local.sku_code || "").toUpperCase();
    const idx = list.findIndex((i) => String(i.sku_code || "").toUpperCase() === sku);
    if (idx >= 0) {
      list[idx] = { ...list[idx], tokens: local.tokens, aliases: local.aliases || list[idx].aliases };
    } else {
      list.push(local);
    }
  }
  return list;
}

export function matchTokenPrice(name, catalog = []) {
  const names = nameKeys(name);
  if (!names.length) return 0;
  const merged = catalogWithFallbacks(catalog);
  const hit =
    merged.find((i) => names.includes(normName(i.display_name)))
    || merged.find((i) => names.includes(normName(i.sku_code)))
    || merged.find((i) => (i.aliases || []).some((a) => names.includes(normName(a))))
    || merged.find((i) => (i.aliases || []).some((a) => {
      const an = normName(a);
      return an.length >= 4 && names.some((nm) => nm.includes(an) || an.includes(nm));
    }));
  if (hit) return Number(hit.tokens) || 0;
  return 0;
}

export function enrichMenu(raw, catalog = []) {

  const all = asList(raw);
  const visible = all.filter((i) => {
    if (!i || i.available === false || i.visible_to_employees === false) return false;
    const n = getName(i);
    if (FINANCE_RE.test(n)) return false;
    return true;
  });

  const milkOk = hasStock(all, /^milk$/i);
  const waterOk = hasStock(all, /^water$|mineral\s*water/i);
  const hasBeans = visible.some((i) => /coffee\s*beans/i.test(getName(i)));
  const hasLemonSachets = visible.some((i) => /lemon\s*sachets?/i.test(getName(i)));

  const spreads = visible.filter((i) => /peanut\s*butter|pineapple\s*jam|mix\s*fruit\s*jam/i.test(getName(i)));
  const breads = all.filter((i) => isBreadItem(getName(i)));
  const breadsInStock = breads.filter(inStock);

  const orderable = visible.filter((i) => {
    const n = getName(i);
    if (HIDDEN_RE.test(n)) return false;
    if (REMOVED_RE.test(n)) return false;
    if (BACKING_RE.test(n)) return false;
    if (i.orderable === false) return false;
    if (/water/i.test(n) && /\b20\s*l\b|\(20\s*l\)/i.test(n)) return false;
    return true;
  });

  const seen = new Set();
  const items = [];

  for (const i of orderable) {
    const n = getName(i);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const cat = i.category || guessCategory(n);
    const img = i.image_url || i.image || i.photo_url || itemImg(n, cat);

    let available = i.orderable !== false;
    const ownStock = itemStock(i);
    if (ownStock != null && ownStock <= 0) available = false;
    if (MILK_DEP_RE.test(n)) {
      available = available && milkOk && waterOk;
    }

    items.push({
      id: i.id,
      name: n,
      cat,
      img,
      stock: ownStock,
      desc: i.description || i.desc || "",
      available,
      isSandwich: false,
      coinPrice: (() => {
        const fromCatalog = matchTokenPrice(n, catalog);
        if (fromCatalog > 0) return fromCatalog;
        const fromApi = Number(i.token_price ?? i.coin_price ?? i.tokens);
        return fromApi > 0 ? fromApi : 0;
      })(),
      raw: i,
    });
  }

  if (hasBeans && waterOk) {
    const virtuals = [
      { name: "Espresso", needsMilk: false },
      { name: "Cappuccino", needsMilk: true },
      { name: "Latte", needsMilk: true },
    ];
    for (const v of virtuals) {
      if (v.needsMilk && !milkOk) continue;
      const key = v.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `virtual_${key}`,
        name: v.name,
        cat: "caffeine",
        img: matchImage(v.name) || CAT_FALLBACK.caffeine,
        stock: null,
        desc: `Made from coffee beans${v.needsMilk ? ", milk" : ""} and water.`,
        available: true,
        isVirtual: true,
        isSandwich: false,
        coinPrice: matchTokenPrice(v.name, catalog),
      });
    }
  }

  if (hasLemonSachets && waterOk && !seen.has("lemon tea")) {
    seen.add("lemon tea");
    items.push({
      id: "virtual_lemon_tea",
      name: "Lemon Tea",
      cat: "tea",
      img: matchImage("Lemon Tea") || CAT_FALLBACK.tea,
      stock: null,
      desc: "Lemon sachet with hot water.",
      available: true,
      isVirtual: true,
      isSandwich: false,
      coinPrice: matchTokenPrice("Lemon Tea", catalog),
    });
  }

  if (!seen.has("green tea")) {
    seen.add("green tea");
    items.push({
      id: "virtual_green_tea",
      name: "Green Tea",
      cat: "tea",
      img: matchImage("Green Tea") || CAT_FALLBACK.tea,
      stock: null,
      desc: "Green tea — 25 coins.",
      available: true,
      isVirtual: true,
      isSandwich: false,
      coinPrice: matchTokenPrice("Green Tea", catalog) || 25,
    });
  }

  for (const sp of spreads) {
    const spName = getName(sp).toLowerCase();
    let displayName;
    if (/peanut/i.test(spName)) displayName = "Peanut Butter Sandwich";
    else if (/pineapple/i.test(spName)) displayName = "Pineapple Jam Sandwich";
    else displayName = "Mix Fruit Jam Sandwich";

    const key = displayName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const spreadStock = itemStock(sp);
    const breadAvail = breads.length === 0 || breadsInStock.length > 0;
    const spreadAvail = spreadStock == null || spreadStock > 0;

    items.push({
      id: `sandwich_${sp.id}`,
      name: displayName,
      cat: "food",
      img: matchImage(displayName) || CAT_FALLBACK.food,
      stock: spreadStock,
      desc: `${displayName} on your choice of bread.`,
      available: breadAvail && spreadAvail,
      isSandwich: true,
      breadOptions: (breadsInStock.length ? breadsInStock : breads).map((b) => getName(b)),
      spreadItemName: displayName,
      coinPrice: matchTokenPrice(displayName, catalog),
    });
  }

  return items;
}

const CAT_ORDER = ["caffeine", "tea", "refreshment", "food"];

export function categoriesFrom(items) {
  const present = new Set((items || []).map((i) => i.cat));
  return CAT_ORDER.filter((id) => present.has(id)).map((id) => ({
    id,
    label: SECTION_LABELS[id] || id,
    icon: CAT_ICONS[id] || "nutrition-outline",
  }));
}

export function imgSource(img) {
  if (typeof img === "number") return img;
  return { uri: img };
}

export function stockLabel(item) {
  if (!item?.available) return "Unavailable";
  if (item?.stock == null || item?.stock === "") return "In pantry";
  const n = Number(item.stock);
  if (Number.isNaN(n)) return "In pantry";
  if (n <= 0) return "Out of stock";
  return `${n} left`;
}
