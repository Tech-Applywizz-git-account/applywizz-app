#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const mobileRoot = path.resolve(__dirname, "..");
const modulesRoot = path.join(mobileRoot, "node_modules");

function walk(directory, manifests) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, manifests);
    else if (entry.isFile() && entry.name === "PrivacyInfo.xcprivacy") manifests.push(fullPath);
  }
}

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stringsInArray(xml, key) {
  const match = xml.match(new RegExp(`<key>\\s*${key}\\s*</key>\\s*<array>([\\s\\S]*?)</array>`));
  if (!match) return [];
  return [...match[1].matchAll(/<string>\s*([\s\S]*?)\s*<\/string>/g)].map((item) =>
    decode(item[1].trim())
  );
}

function accessedApis(xml) {
  const result = [];
  const blocks = xml.match(
    /<key>\s*NSPrivacyAccessedAPIType\s*<\/key>\s*<string>[\s\S]*?<\/string>[\s\S]*?<key>\s*NSPrivacyAccessedAPITypeReasons\s*<\/key>\s*<array>[\s\S]*?<\/array>/g
  ) || [];
  for (const block of blocks) {
    const category = block.match(
      /<key>\s*NSPrivacyAccessedAPIType\s*<\/key>\s*<string>\s*([\s\S]*?)\s*<\/string>/
    )?.[1];
    if (category) {
      result.push({
        category: decode(category.trim()),
        reasons: stringsInArray(block, "NSPrivacyAccessedAPITypeReasons"),
      });
    }
  }
  return result;
}

if (!fs.existsSync(modulesRoot)) {
  console.error("node_modules is missing; run npm install before this audit.");
  process.exitCode = 1;
} else {
  const manifests = [];
  walk(modulesRoot, manifests);
  manifests.sort();

  const categoryReasons = new Map();
  console.log(`Privacy manifests found: ${manifests.length}`);
  for (const manifestPath of manifests) {
    const relativePath = path.relative(mobileRoot, manifestPath).split(path.sep).join("/");
    const xml = fs.readFileSync(manifestPath, "utf8");
    const apis = accessedApis(xml);
    console.log(`- ${relativePath}`);
    for (const { category, reasons } of apis) {
      if (!categoryReasons.has(category)) categoryReasons.set(category, new Set());
      reasons.forEach((reason) => categoryReasons.get(category).add(reason));
      console.log(`  ${category}: ${reasons.length ? reasons.join(", ") : "(no reasons)"}`);
    }
  }

  console.log("Required Reason API union:");
  if (!categoryReasons.size) console.log("- (none declared by discovered manifests)");
  for (const category of [...categoryReasons.keys()].sort()) {
    console.log(`- ${category}: ${[...categoryReasons.get(category)].sort().join(", ")}`);
  }
}
