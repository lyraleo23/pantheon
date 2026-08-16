# 🏛️ Pantheon

Custom trophy lists for games that have no native achievements on the platform you play them on.

Nintendo Switch has no global achievement system. Neither do most retro and emulated titles, plenty of DRM-free releases, or older console generations. Pantheon fills that gap — for any game, on any platform, as long as the platform you own doesn't already provide achievements.

Every list is built from the game's own structure, mechanics and identity, and validated against a written ruleset before it ships.

---

## 💎 Relevant Completion

Earning the Platinum does not mean completing 100% of everything that exists.

It means having lived, explored and mastered **everything that actually matters** in that game. No grinding, no redundant collectibles, no untrackable statistics, no arbitrary challenges.

> **"Did a player who earned all of these trophies live everything worth living in this game?"**

If yes, the list is complete.

---

## 🚪 Who gets a list

The entry gate is checked per **game + platform pair**, not per game.

| Situation | Result |
|---|---|
| Target platform has native achievements | ❌ No list — the native one already covers it |
| No platform has achievements | ✅ 🌱 **Genesis Mode** — built from research |
| Another platform has them, yours doesn't | ✅ 🔁 **Port Mode** — adapted from the native list |

Hollow Knight has Steam achievements and none on Switch. That makes it a valid Pantheon candidate on Switch and an invalid one on Steam.

**Port Mode** doesn't copy the source list. It imports it, filters out everything that violates the ruleset, prunes anything referencing content the target version lacks, and adds trophies for content exclusive to the target version. A 63-achievement Steam list routinely becomes a 38-trophy Pantheon list. The filtering is the point.

---

## 🎖️ Tiers

| Tier | Meaning |
|---|---|
| 🥉 Bronze | Progress, discoveries, simple challenges |
| 🥈 Silver | Deeper exploration, intermediate challenges |
| 🥇 Gold | Major challenges, significant mastery |
| 💎 Platinum | Earned when every other trophy is |

---

## 🚀 Usage

Requires [Claude Code](https://claude.com/claude-code) and Node.js 18+.

```bash
/pantheon Hollow Knight, Nintendo Switch
```

That runs the whole pipeline: entry gate → mode selection → parallel research → your approval of the findings → design → validation → independent audit → generated files → commit.

You'll be asked to confirm the research findings once, before the list is designed. That checkpoint costs thirty seconds and stops a single wrong fact from propagating into every trophy. Pass `--auto` to skip it.

Manual operations:

```bash
node scripts/validate.mjs games/<slug>/trophies.json   # mechanical rule checks
node scripts/validate.mjs --all
node scripts/render.mjs games/<slug>/trophies.json     # JSON → Markdown
node scripts/build-catalog.mjs                         # JSON → app/public/data
```

---

## 📱 The app

`app/` is a small PWA that turns the lists into something you can actually tick off — on a phone, offline, installable from the browser.

```bash
cd app
npm install
npm run dev
```

Open a game, tap a trophy to mark it earned, and watch the tier counts move. Secret trophies stay masked until you reveal them, missable ones are flagged, and DLC packs are counted apart — the Platinum lights up on its own once every other trophy in the base list is earned, and never before.

The app never reads `games/` at runtime. `scripts/build-catalog.mjs` runs before every build and copies the lists into `app/public/data/`, which the service worker precaches. Generating a list with `/pantheon` and pushing is all it takes for the game to show up on your phone.

Progress lives in the browser's own storage, on that device. There is no account and no server. **Settings → Backup** exports it as a `.json` and imports it back, which is how you move a save between your phone and your desktop.

A push to `main` builds and publishes it to GitHub Pages.

---

## 📁 Structure

```text
pantheon/
├── rules/pantheon_rules_v2.md        # the ruleset — 23 rules
├── schema/trophy_list.schema.json    # list structure
├── scripts/
│   ├── validate.mjs                  # deterministic checks
│   ├── render.mjs                    # JSON → Markdown
│   └── build-catalog.mjs             # JSON → app/public/data
├── templates/
├── games/<slug>/
│   ├── trophies.json                 # source of truth
│   ├── dossier.json                  # research findings
│   ├── trophies.md                   # generated
│   └── progress.md                   # yours — never overwritten
├── app/                              # the PWA
└── .claude/
    ├── skills/pantheon/              # the pipeline
    ├── agents/                       # scout + auditor
    └── commands/pantheon.md          # /pantheon
```

`trophies.json` is the only file edited by hand. Markdown is generated from it, which keeps the two in sync and leaves the door open for a dashboard, trophy cards or an API later.

`progress.md` is generated once and then belongs to you. Rebuilds never touch it.

---

## 🆔 Trophy IDs

Each game gets a short uppercase code used as its ID prefix: `HK-001`, `PLGP-014`, `XC2-022`. No central registry, no collisions. IDs are never reused within a game, even for retired trophies.

---

## 🧪 How lists are validated

**Mechanically** — a script checks structure, ID sequence, tier distribution, Platinum placement and naming, required fields, and provenance consistency. Deterministic and free, so it never gets skipped.

**By judgment** — an independent auditor checks factual accuracy against the game, whether verification claims are real, whether the list represents the game, whether anything is tedious, and whether the Platinum respects Relevant Completion.

The auditor runs in a separate context that never saw the design reasoning. An author reviewing their own list approves it; that's the failure mode this structure exists to prevent.

---

## 🤝 Contributing

Suggestions and corrections are welcome as long as they respect the ruleset.

> Does this trophy improve the player's experience, or does it just add another task?

---

## 👤 Author

**Leonardo Lyra** — creator and maintainer.

Lists are researched, structured and validated with AI assistance following the Pantheon ruleset. Final say on what ships belongs to the maintainer.

---

> **A good trophy list does not exist to force the player to do everything.**
>
> **It exists to encourage the player to experience everything that makes that game worth playing.**

**Pantheon 🏛️** — *Turning games into journeys worth remembering.*
