#!/usr/bin/env node
/**
 * Pantheon — deterministic validator
 *
 * Checks everything that can be decided without judgment: structure, IDs,
 * tiers, distribution, provenance, required fields. Anything requiring an
 * opinion about the game is the auditor's job, not this script's.
 *
 * Usage:
 *   node scripts/validate.mjs games/<slug>/trophies.json
 *   node scripts/validate.mjs --all
 *
 * Exit codes: 0 = passed (warnings allowed), 1 = errors found.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const TIERS = ["bronze", "silver", "gold", "platinum"];
const TYPES = [
  "story", "exploration", "challenge", "collection", "sidequest",
  "boss", "mechanic", "minigame", "postgame", "multiplayer",
];
const ORIGINS = [
  "original", "native-steam", "native-playstation", "native-xbox", "native-other",
];

// Rule 5 targets, as shares of the non-platinum list.
const DISTRIBUTION = { bronze: 0.5, silver: 0.3, gold: 0.15 };
const DISTRIBUTION_TOLERANCE = 0.15;

// Rule 4 reference range.
const COUNT_MIN = 15;
const COUNT_MAX = 40;

const errors = [];
const warnings = [];

const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function validate(data, label) {
  const game = data.game;
  const trophies = data.trophies;

  if (!game || typeof game !== "object") {
    err("`game` object is missing");
    return;
  }
  if (!Array.isArray(trophies) || trophies.length === 0) {
    err("`trophies` must be a non-empty array");
    return;
  }

  // ---- game metadata -------------------------------------------------
  for (const field of ["title", "slug", "code", "targetPlatform", "mode", "listVersion", "rulesetVersion"]) {
    if (!game[field]) err(`game.${field} is required`);
  }
  if (game.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game.slug)) {
    err(`game.slug "${game.slug}" must be lowercase and hyphen separated`);
  }
  if (game.code && !/^[A-Z0-9]{2,8}$/.test(game.code)) {
    err(`game.code "${game.code}" must be 2-8 uppercase alphanumeric characters`);
  }
  if (game.mode && !["genesis", "port"].includes(game.mode)) {
    err(`game.mode "${game.mode}" must be "genesis" or "port"`);
  }
  if (game.mode === "port" && !game.sourcePlatform) {
    err("game.sourcePlatform is required in port mode (Rule 22)");
  }
  if (game.mode === "genesis" && game.sourcePlatform) {
    err("game.sourcePlatform must not be set in genesis mode");
  }

  // ---- per-trophy checks ---------------------------------------------
  // Shared across the base list and every DLC list, since Rule 17's mandatory
  // structure applies to every trophy regardless of which list it lives in.
  // IDs and names are deduplicated globally (seenIds/seenNames span all lists)
  // so a DLC trophy can never silently collide with a base one.
  const seenIds = new Set();
  const seenNames = new Set();
  const counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

  function checkTrophy(t, i, contextLabel, idPattern) {
    const at = `${contextLabel}${t.id || `index ${i}`}`;

    for (const field of ["id", "name", "description", "tier", "type", "verification", "origin"]) {
      if (!t[field] || String(t[field]).trim() === "") {
        err(`${at}: "${field}" is required and must not be empty`);
      }
    }
    // Booleans must be present and actually boolean — undefined silently
    // reads as "not missable", which is exactly the Rule 15 failure mode.
    for (const field of ["missable", "secret"]) {
      if (typeof t[field] !== "boolean") {
        err(`${at}: "${field}" must be true or false (Rule 15/16)`);
      }
    }

    if (t.id) {
      if (!idPattern.test(t.id)) {
        err(`${at}: ID must match ${idPattern.source}`);
      }
      if (seenIds.has(t.id)) err(`${at}: duplicate ID`);
      seenIds.add(t.id);
    }

    if (t.name) {
      const key = t.name.trim().toLowerCase();
      if (seenNames.has(key)) err(`${at}: duplicate trophy name "${t.name}"`);
      seenNames.add(key);
    }

    if (t.tier) {
      if (!TIERS.includes(t.tier)) err(`${at}: invalid tier "${t.tier}"`);
      else counts[t.tier]++;
    }
    if (t.type && !TYPES.includes(t.type)) {
      err(`${at}: invalid type "${t.type}" (allowed: ${TYPES.join(", ")})`);
    }
    if (t.origin) {
      if (!ORIGINS.includes(t.origin)) err(`${at}: invalid origin "${t.origin}"`);
      if (t.origin !== "original" && !t.originId) {
        err(`${at}: originId is required when origin is "${t.origin}" (Rule 23)`);
      }
      if (t.origin === "original" && t.originId) {
        err(`${at}: originId must not be set when origin is "original"`);
      }
      if (game.mode === "genesis" && t.origin !== "original") {
        err(`${at}: genesis mode allows only origin "original" (Rule 23)`);
      }
    }

    // Rule 1/2 heuristic: a bare number in the description usually implies a
    // counter. Not always wrong, but the verification field has to explain
    // where that number is readable in-game.
    if (t.description && /\b\d{2,}\b/.test(t.description) && t.verification) {
      const v = t.verification.toLowerCase();
      const mentionsSource = /counter|stat|menu|screen|log|record|list|tracker|progress|percentage|journal|index|dex|collection|profile|tab/.test(v);
      if (!mentionsSource) {
        warn(`${at}: cumulative-looking objective but verification does not name an in-game counter (Rules 1-2)`);
      }
    }
  }

  const baseIdPattern = new RegExp(`^${game.code}-\\d{3}$`);
  trophies.forEach((t, i) => checkTrophy(t, i, "", baseIdPattern));

  // ---- IDs sequential ------------------------------------------------
  // Report the actual gaps and strays, not every index after the first
  // break — one missing ID should not produce twenty errors.
  const pad = (n) => `${game.code}-${String(n).padStart(3, "0")}`;
  const nums = new Set([...seenIds].map((id) => parseInt(id.split("-")[1], 10)));
  const missing = [];
  for (let i = 1; i <= nums.size; i++) if (!nums.has(i)) missing.push(pad(i));
  const stray = [...nums].filter((n) => n > nums.size).sort((a, b) => a - b).map(pad);
  if (missing.length) err(`missing ID(s) in sequence: ${missing.join(", ")}`);
  if (stray.length) err(`ID(s) outside the 001-${String(nums.size).padStart(3, "0")} range: ${stray.join(", ")}`);

  // ---- platinum ------------------------------------------------------
  const platinums = trophies.filter((t) => t.tier === "platinum");
  if (platinums.length !== 1) {
    err(`expected exactly 1 platinum, found ${platinums.length}`);
  } else {
    const p = platinums[0];
    if (trophies[trophies.length - 1].id !== p.id) {
      err(`platinum ${p.id} must be the last entry in the list`);
    }
    if (/^platinum$/i.test((p.name || "").trim())) {
      err(`platinum name must be thematic, not the generic word "Platinum" (Rule 18)`);
    }
    if (p.origin !== "original") {
      err(`platinum must have origin "original" — it is a Pantheon construct (Rule 23)`);
    }
    if (p.missable === true) err("platinum cannot be missable");
  }

  // ---- Rule 4: count -------------------------------------------------
  const total = trophies.length;
  const base = total - platinums.length;
  if (total < COUNT_MIN || total > COUNT_MAX) {
    warn(`${total} trophies, outside the ${COUNT_MIN}-${COUNT_MAX} reference range (Rule 4). Justify in game.notes if intentional.`);
  }

  // ---- Rule 5: distribution ------------------------------------------
  if (base > 0) {
    for (const [tier, target] of Object.entries(DISTRIBUTION)) {
      const share = counts[tier] / base;
      if (Math.abs(share - target) > DISTRIBUTION_TOLERANCE) {
        warn(
          `${tier}: ${counts[tier]}/${base} = ${(share * 100).toFixed(0)}%, ` +
          `target ~${(target * 100).toFixed(0)}% (Rule 5)`
        );
      }
    }
  }

  // Snapshot before DLC trophies (checked below, sharing the same `counts`
  // accumulator for global tier bookkeeping) would otherwise inflate the
  // base-list summary printed at the end of this function.
  const baseCounts = { ...counts };

  // ---- Rule 14: DLC lists ---------------------------------------------
  const dlcSummaries = [];
  if (data.dlc !== undefined) {
    if (!Array.isArray(data.dlc)) {
      err("`dlc` must be an array");
    } else {
      data.dlc.forEach((pack, pi) => {
        const label = `dlc[${pi}]`;
        if (!pack.name || String(pack.name).trim() === "") {
          err(`${label}: "name" is required and must not be empty`);
        }
        if (!Array.isArray(pack.trophies) || pack.trophies.length === 0) {
          err(`${label} (${pack.name || "unnamed"}): "trophies" must be a non-empty array`);
          return;
        }
        // DLC trophies use a caller-chosen ID prefix (e.g. CODE-SUFFIX-NNN is
        // not allowed by the single-hyphen schema pattern, so packs use their
        // own short code such as CODEXX-NNN) — accept any schema-valid ID,
        // just require internal consistency within the pack.
        const dlcCode = pack.trophies[0]?.id?.split("-")[0];
        const dlcIdPattern = dlcCode ? new RegExp(`^${dlcCode}-\\d{3}$`) : /^[A-Z0-9]{2,8}-\d{3}$/;
        const beforeCounts = { ...counts };
        pack.trophies.forEach((t, ti) => checkTrophy(t, ti, `${label} "${pack.name}" `, dlcIdPattern));
        const dlcCounts = {
          bronze: counts.bronze - beforeCounts.bronze,
          silver: counts.silver - beforeCounts.silver,
          gold: counts.gold - beforeCounts.gold,
          platinum: counts.platinum - beforeCounts.platinum,
        };

        const dlcPlatinums = pack.trophies.filter((t) => t.tier === "platinum");
        if (dlcPlatinums.length) {
          err(`${label} (${pack.name}): DLC lists must not contain a platinum trophy — the base game's Platinum is the only Platinum (Rule 14)`);
        }

        const dlcTotal = pack.trophies.length;
        if (dlcTotal < 5) {
          warn(`${label} (${pack.name}): only ${dlcTotal} trophies — thin for a standalone DLC list, consider folding into base game notes instead`);
        }

        dlcSummaries.push(
          `  dlc: "${pack.name}" | ${dlcTotal} trophies — ${dlcCounts.bronze}B / ${dlcCounts.silver}S / ${dlcCounts.gold}G`
        );
      });
    }
  }

  // ---- Rule 22/23: port mode sanity ----------------------------------
  if (game.mode === "port") {
    const native = trophies.filter((t) => t.origin !== "original").length;
    const original = trophies.filter((t) => t.origin === "original").length;
    if (native === 0) {
      err("port mode but no trophy carries native provenance — the source list was ignored (Rule 22)");
    }
    if (original <= 1) {
      warn("port mode produced no original trophies beyond the platinum — was the Complete pass run? (Rule 22)");
    }
    if (!Array.isArray(data.excluded) || data.excluded.length === 0) {
      warn("port mode with an empty `excluded` list — the Filter and Prune passes leave an audit trail (Rule 22)");
    }
    if (typeof game.nativeCount === "number" && game.nativeCount > 0) {
      const dropped = Array.isArray(data.excluded) ? data.excluded.length : 0;
      if (native + dropped > game.nativeCount) {
        err(`accounted native entries (${native} kept + ${dropped} excluded) exceed game.nativeCount (${game.nativeCount})`);
      }
    }
  }

  // ---- report --------------------------------------------------------
  const summary = `${total} trophies — ${baseCounts.bronze}B / ${baseCounts.silver}S / ${baseCounts.gold}G / ${baseCounts.platinum}P`;
  console.log(`\n${label}`);
  console.log(`  mode: ${game.mode}${game.sourcePlatform ? ` (from ${game.sourcePlatform})` : ""} | ${summary}`);
  for (const s of dlcSummaries) console.log(s);
}

function run(file) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    err(`${file}: could not parse JSON — ${e.message}`);
    return;
  }
  validate(data, file);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/validate.mjs <path/to/trophies.json> | --all");
  process.exit(1);
}

if (args[0] === "--all") {
  const dir = "games";
  if (!existsSync(dir)) {
    console.error("no games/ directory found — run from the repo root");
    process.exit(1);
  }
  const slugs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (slugs.length === 0) console.log("games/ is empty, nothing to validate");
  for (const slug of slugs) {
    const file = join(dir, slug, "trophies.json");
    if (existsSync(file)) run(file);
    else warn(`${slug}/: no trophies.json`);
  }
} else {
  run(args[0]);
}

console.log("");
for (const w of warnings) console.log(`  ⚠️  ${w}`);
for (const e of errors) console.log(`  ❌ ${e}`);

if (errors.length) {
  console.log(`\n❌ FAILED — ${errors.length} error(s), ${warnings.length} warning(s)\n`);
  process.exit(1);
}
console.log(`\n✅ PASSED — ${warnings.length} warning(s)\n`);
