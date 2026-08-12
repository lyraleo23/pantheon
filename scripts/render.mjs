#!/usr/bin/env node
/**
 * Pantheon — renderer
 *
 * JSON is the source of truth. This turns it into the two Markdown files.
 *
 * trophies.md is always regenerated.
 * progress.md is only created if missing — it holds the player's actual
 * journey and is never overwritten by a rebuild.
 *
 * Usage:
 *   node scripts/render.mjs games/<slug>/trophies.json
 *   node scripts/render.mjs --all
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const TIER_LABEL = {
  bronze: "🥉 Bronze",
  silver: "🥈 Silver",
  gold: "🥇 Gold",
  platinum: "💎 Platinum",
};

const TYPE_LABEL = {
  story: "Story", exploration: "Exploration", challenge: "Challenge",
  collection: "Collection", sidequest: "Side Quest", boss: "Boss",
  mechanic: "Mechanic", minigame: "Minigame", postgame: "Post-Game",
  multiplayer: "Multiplayer",
};

const ORIGIN_LABEL = {
  original: "Original",
  "native-steam": "Steam",
  "native-playstation": "PlayStation",
  "native-xbox": "Xbox",
  "native-other": "Native",
};

function flags(t) {
  const out = [];
  if (t.missable) out.push("⚠️ **MISSABLE**");
  if (t.secret) out.push("🔒 **SECRET**");
  return out.join(" · ");
}

function renderTrophies(data) {
  const { game, trophies } = data;
  const counts = trophies.reduce((a, t) => ((a[t.tier] = (a[t.tier] || 0) + 1), a), {});
  const missable = trophies.filter((t) => t.missable);

  const L = [];
  L.push(`# ${game.title} — Official Trophy List`);
  L.push("");
  L.push(`> **Platform:** ${game.targetPlatform}  `);
  L.push(`> **List version:** ${game.listVersion} · **Ruleset:** Pantheon v${game.rulesetVersion}  `);
  L.push(`> **Build mode:** ${game.mode === "port" ? `🔁 Port — adapted from ${game.sourcePlatform}` : "🌱 Genesis — no native list exists"}  `);
  L.push(`> **Status:** ${game.status || "draft"}`);
  L.push("");

  L.push("## Game Info");
  L.push("");
  const info = [
    ["Developer", game.developer],
    ["Publisher", game.publisher],
    ["Genre", game.genre],
    ["Release", game.releaseYear],
    ["Estimated difficulty", game.estimatedDifficulty ? `${game.estimatedDifficulty}/10` : null],
    ["Estimated time to Platinum", game.estimatedHours],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  L.push("| | |");
  L.push("|---|---|");
  for (const [k, v] of info) L.push(`| **${k}** | ${v} |`);
  L.push(`| **Total** | ${trophies.length} |`);
  L.push(`| **Breakdown** | 🥉 ${counts.bronze || 0} · 🥈 ${counts.silver || 0} · 🥇 ${counts.gold || 0} · 💎 ${counts.platinum || 0} |`);
  L.push("");

  if (missable.length) {
    L.push("## ⚠️ Missable Trophies");
    L.push("");
    L.push("Plan around these before they become unreachable.");
    L.push("");
    for (const t of missable) L.push(`- \`${t.id}\` **${t.name}** — ${t.description}`);
    L.push("");
  }

  L.push("## Summary");
  L.push("");
  L.push("| ID | Trophy | Tier | Type | Flags |");
  L.push("|---|---|---|---|---|");
  for (const t of trophies) {
    L.push(`| \`${t.id}\` | ${t.secret ? "🔒 *Hidden*" : t.name} | ${TIER_LABEL[t.tier]} | ${TYPE_LABEL[t.type]} | ${flags(t) || "—"} |`);
  }
  L.push("");

  L.push("## Trophies");
  L.push("");
  for (const t of trophies) {
    L.push(`### \`${t.id}\` ${TIER_LABEL[t.tier].split(" ")[0]} ${t.name}`);
    L.push("");
    L.push(t.description);
    L.push("");
    const meta = [`**Tier:** ${TIER_LABEL[t.tier]}`, `**Type:** ${TYPE_LABEL[t.type]}`];
    if (t.origin !== "original") meta.push(`**Origin:** ${ORIGIN_LABEL[t.origin]} — *${t.originId}*`);
    L.push(meta.join(" · "));
    L.push("");
    L.push(`**How to verify:** ${t.verification}`);
    if (flags(t)) { L.push(""); L.push(flags(t)); }
    if (t.notes) { L.push(""); L.push(`> ${t.notes}`); }
    L.push("");
    L.push("---");
    L.push("");
  }

  if (Array.isArray(data.dlc) && data.dlc.length) {
    L.push("## DLC (Rule 14 — separate from the base Platinum)");
    L.push("");
    for (const pack of data.dlc) {
      const dCounts = pack.trophies.reduce((a, t) => ((a[t.tier] = (a[t.tier] || 0) + 1), a), {});
      L.push(`### ${pack.name}`);
      L.push("");
      L.push(`| | |`);
      L.push(`|---|---|`);
      L.push(`| **Total** | ${pack.trophies.length} |`);
      L.push(`| **Breakdown** | 🥉 ${dCounts.bronze || 0} · 🥈 ${dCounts.silver || 0} · 🥇 ${dCounts.gold || 0} |`);
      L.push("");
      L.push("| ID | Trophy | Tier | Type | Flags |");
      L.push("|---|---|---|---|---|");
      for (const t of pack.trophies) {
        L.push(`| \`${t.id}\` | ${t.secret ? "🔒 *Hidden*" : t.name} | ${TIER_LABEL[t.tier]} | ${TYPE_LABEL[t.type]} | ${flags(t) || "—"} |`);
      }
      L.push("");
      for (const t of pack.trophies) {
        L.push(`#### \`${t.id}\` ${TIER_LABEL[t.tier].split(" ")[0]} ${t.name}`);
        L.push("");
        L.push(t.description);
        L.push("");
        L.push(`**Tier:** ${TIER_LABEL[t.tier]} · **Type:** ${TYPE_LABEL[t.type]}`);
        L.push("");
        L.push(`**How to verify:** ${t.verification}`);
        if (flags(t)) { L.push(""); L.push(flags(t)); }
        if (t.notes) { L.push(""); L.push(`> ${t.notes}`); }
        L.push("");
        L.push("---");
        L.push("");
      }
    }
  }

  if (Array.isArray(data.excluded) && data.excluded.length) {
    L.push("## Excluded from the Native List");
    L.push("");
    L.push(`${data.excluded.length} native entries were deliberately dropped (Rule 22).`);
    L.push("");
    L.push("| Native achievement | Reason | Rule |");
    L.push("|---|---|---|");
    for (const e of data.excluded) L.push(`| ${e.originId} | ${e.reason} | ${e.rule ? `Rule ${e.rule}` : "—"} |`);
    L.push("");
  }

  if (game.notes) {
    L.push("## Notes");
    L.push("");
    L.push(game.notes);
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push("*Generated by Pantheon. Edit `trophies.json`, then run `node scripts/render.mjs`.*");
  return L.join("\n") + "\n";
}

function renderProgress(data) {
  const { game, trophies } = data;
  const counts = trophies.reduce((a, t) => ((a[t.tier] = (a[t.tier] || 0) + 1), a), {});

  const L = [];
  L.push(`# ${game.title} — Player Progress`);
  L.push("");
  L.push(`> **Platform:** ${game.targetPlatform} · **List version:** ${game.listVersion}`);
  L.push("");
  L.push("## Summary");
  L.push("");
  L.push("- **Started:**");
  L.push("- **Completed:**");
  L.push(`- **Progress:** 0/${trophies.length} (0%)`);
  L.push("- **Platinum:** ⬜");
  L.push("");
  L.push("## Trophies");
  L.push("");
  L.push("| ✔ | ID | Trophy | Tier | Date | Notes |");
  L.push("|---|---|---|---|---|---|");
  for (const t of trophies) {
    L.push(`| ⬜ | \`${t.id}\` | ${t.name} | ${TIER_LABEL[t.tier]} | | |`);
  }
  L.push("");
  L.push("⬜ not earned · ✅ earned");
  L.push("");

  if (Array.isArray(data.dlc) && data.dlc.length) {
    for (const pack of data.dlc) {
      L.push(`## DLC — ${pack.name}`);
      L.push("");
      L.push("| ✔ | ID | Trophy | Tier | Date | Notes |");
      L.push("|---|---|---|---|---|---|");
      for (const t of pack.trophies) {
        L.push(`| ⬜ | \`${t.id}\` | ${t.name} | ${TIER_LABEL[t.tier]} | | |`);
      }
      L.push("");
    }
  }

  L.push("## Stats");
  L.push("");
  L.push(`- 🥉 Bronze: 0/${counts.bronze || 0}`);
  L.push(`- 🥈 Silver: 0/${counts.silver || 0}`);
  L.push(`- 🥇 Gold: 0/${counts.gold || 0}`);
  L.push(`- 💎 Platinum: 0/${counts.platinum || 0}`);
  L.push(`- **Total: 0/${trophies.length}**`);
  L.push("");
  L.push("## Current Objective");
  L.push("");
  L.push("_What you're chasing next._");
  L.push("");
  L.push("## Journey Log");
  L.push("");
  L.push("### Session 1");
  L.push("");
  L.push("**Date:**");
  L.push("");
  L.push("**Trophies earned:**");
  L.push("");
  L.push("**Highlights:**");
  L.push("");
  return L.join("\n") + "\n";
}

function run(file) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const dir = dirname(file);

  const trophiesPath = join(dir, "trophies.md");
  writeFileSync(trophiesPath, renderTrophies(data));
  console.log(`  ✅ ${trophiesPath}`);

  const progressPath = join(dir, "progress.md");
  if (existsSync(progressPath)) {
    console.log(`  ⏭️  ${progressPath} exists — left untouched (player data)`);
  } else {
    writeFileSync(progressPath, renderProgress(data));
    console.log(`  ✅ ${progressPath}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/render.mjs <path/to/trophies.json> | --all");
  process.exit(1);
}

if (args[0] === "--all") {
  for (const d of readdirSync("games", { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const file = join("games", d.name, "trophies.json");
    if (existsSync(file)) run(file);
  }
} else {
  run(args[0]);
}
