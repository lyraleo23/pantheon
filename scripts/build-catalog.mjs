#!/usr/bin/env node
/**
 * Pantheon — catalog builder
 *
 * The PWA in app/ never reads games/ at runtime: it is a static site. This
 * copies every list into app/public/data/, where Vite publishes it and the
 * service worker precaches it for offline use.
 *
 * Emits:
 *   app/public/data/catalog.json        light index, loaded on startup
 *   app/public/data/games/<slug>.json   the full list, loaded on demand
 *
 * Usage:
 *   node scripts/build-catalog.mjs
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Runs from the repo root and from inside app/ (as a prebuild hook), so the
// paths hang off this file's own location instead of the working directory.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GAMES_DIR = join(ROOT, "games");
const OUT_DIR = join(ROOT, "app", "public", "data");
const OUT_GAMES_DIR = join(OUT_DIR, "games");

const TIERS = ["bronze", "silver", "gold", "platinum"];

function countTiers(trophies) {
  const counts = Object.fromEntries(TIERS.map((t) => [t, 0]));
  for (const t of trophies) counts[t.tier] = (counts[t.tier] || 0) + 1;
  return counts;
}

/** The card on the home screen. Everything else stays in the per-game file. */
function summarise(data) {
  const { game, trophies } = data;
  const dlc = Array.isArray(data.dlc) ? data.dlc : [];

  // The home screen counts progress without downloading the lists, so it needs
  // the base IDs. Platinum is derived from the others and travels apart.
  const platinum = trophies.find((t) => t.tier === "platinum");
  const trophyIds = trophies.filter((t) => t.tier !== "platinum").map((t) => t.id);

  return {
    trophyIds,
    platinumId: platinum ? platinum.id : null,
    slug: game.slug,
    title: game.title,
    code: game.code,
    targetPlatform: game.targetPlatform,
    mode: game.mode,
    status: game.status || "draft",
    developer: game.developer,
    genre: game.genre,
    releaseYear: game.releaseYear,
    estimatedDifficulty: game.estimatedDifficulty,
    estimatedHours: game.estimatedHours,
    listVersion: game.listVersion,
    total: trophies.length,
    counts: countTiers(trophies),
    dlcPacks: dlc.length,
    dlcTotal: dlc.reduce((sum, pack) => sum + pack.trophies.length, 0),
  };
}

function run() {
  if (!existsSync(GAMES_DIR)) {
    console.error(`games/ not found at ${GAMES_DIR}`);
    process.exit(1);
  }

  const catalog = [];
  const seen = new Map();

  mkdirSync(OUT_GAMES_DIR, { recursive: true });

  for (const entry of readdirSync(GAMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const file = join(GAMES_DIR, entry.name, "trophies.json");
    if (!existsSync(file)) continue;

    const data = JSON.parse(readFileSync(file, "utf8"));

    // Directories carry a `_trophies` suffix that the slug does not, so the
    // slug inside the JSON is the only key the app ever uses.
    const slug = data.game?.slug;
    if (!slug) {
      console.error(`  ❌ ${entry.name}: game.slug is missing`);
      process.exit(1);
    }
    if (seen.has(slug)) {
      console.error(`  ❌ ${entry.name}: slug "${slug}" already used by ${seen.get(slug)}`);
      process.exit(1);
    }
    seen.set(slug, entry.name);

    writeFileSync(join(OUT_GAMES_DIR, `${slug}.json`), JSON.stringify(data));
    catalog.push(summarise(data));
    console.log(`  ✅ ${slug} — ${data.trophies.length} trophies`);
  }

  // A renamed or deleted list would otherwise linger in the build and keep
  // being served from the precache.
  for (const stale of readdirSync(OUT_GAMES_DIR)) {
    if (!seen.has(stale.replace(/\.json$/, ""))) {
      rmSync(join(OUT_GAMES_DIR, stale));
      console.log(`  🗑️  removed stale ${stale}`);
    }
  }

  catalog.sort((a, b) => a.title.localeCompare(b.title));

  writeFileSync(
    join(OUT_DIR, "catalog.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), games: catalog }),
  );

  const trophies = catalog.reduce((sum, g) => sum + g.total, 0);
  const dlc = catalog.reduce((sum, g) => sum + g.dlcTotal, 0);
  console.log(`\n  📦 catalog.json — ${catalog.length} games, ${trophies} trophies (+${dlc} DLC)`);
}

run();
