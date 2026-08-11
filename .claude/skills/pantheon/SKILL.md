---
name: pantheon
description: Build a custom trophy/achievement list for a video game that has no native achievements on the player's platform. Use this skill whenever the user names a game and asks for a trophy list, achievement list, platinum list, or custom achievements — and also whenever they mention Pantheon, ask to port achievements from one platform to another, ask to audit or revise an existing list in games/, or say something like "make a list for X on Switch". Trigger even if they do not use the word "trophy".
---

# Pantheon

Build trophy lists for games that lack native achievements on the player's platform.

The rules live in `rules/pantheon_rules_v2.md`. **Read that file before designing any list** — this skill is the pipeline, that file is the law. When they disagree, the ruleset wins.

## What actually goes wrong

Two failure modes account for nearly every bad list:

1. **Fabricated facts.** Inventing a boss, a collectible count, or a region that does not exist in this game. A beautifully formatted list full of wrong facts is worse than no list, because the player only discovers the error hours in.
2. **Self-approval.** Designing a list and then auditing it yourself, which reliably produces "looks good to me." The auditor subagent exists precisely so the audit happens in a context that never saw the design reasoning.

The pipeline below is built around avoiding those two things. Do not collapse the steps.

## Pipeline

### Step 0 — Entry gate

Before anything else, determine whether the **target platform's** version of the game already has native achievements. Ask which platform the player owns if it was not stated.

- Native achievements exist on the target platform → **stop**. Tell the user the native list already covers it. Do not build a list.
- The gate is per game + platform. Hollow Knight has Steam achievements and none on Switch — valid on Switch, invalid on Steam.

### Step 1 — Mode selection

Check whether any *other* platform has a native list for this game.

| Finding | Mode |
|---|---|
| Native list exists elsewhere | 🔁 **Port** |
| No native list anywhere | 🌱 **Genesis** |

Prefer Port whenever available. A native list is verified ground truth and removes the biggest source of error. Rule 22 governs it.

### Step 2 — Scout (parallel subagents)

Launch **three `pantheon-scout` subagents in a single turn**, each with a different beat. Parallel matters here: one agent trying to cover everything produces thin coverage everywhere.

| Scout | Covers |
|---|---|
| A | Campaign structure, mandatory and optional bosses, story milestones, endings |
| B | Collectibles, side quests, secret areas, minigames, post-game, DLC |
| C | Progression systems, trackable in-game statistics, missable content, RNG systems, **version differences between the target platform and others** |

In Port Mode, add a fourth scout to retrieve the complete native list from the source platform, with names and descriptions.

Merge the results into `games/<slug>/dossier.json`. Where scouts disagree on a fact, keep both claims and flag the conflict — do not silently pick one.

### Step 3 — Checkpoint (default on)

Present a compact summary of the dossier to the user: content covered, trackable statistics found, missables, version differences, conflicts between scouts. Ask them to confirm or correct.

This costs the user thirty seconds and prevents a wrong fact from propagating through the entire list. Skip it only when the user passes `--auto`.

### Step 4 — Design

Write `games/<slug>/trophies.json` against `schema/trophy_list.schema.json`.

Genesis Mode: design from the dossier, applying Rules 3–21.

Port Mode: run the four passes of Rule 22 in order — Import, Filter, Prune, Complete. The Prune pass is the one people skip and it is the one that creates impossible trophies. Record every dropped native entry in `excluded` with its reason.

While designing, hold on to these:

- **Every trophy needs a `verification` field that names where in the game the player confirms it.** If you cannot write that sentence honestly, the trophy violates Rule 1 and should not exist.
- Trophy names and descriptions are always in **English**, including ported ones.
- The Platinum gets a thematic name (Rule 18), sits last, and is always `origin: original`.
- IDs run `CODE-001` upward with no gaps. Pick a short uppercase `code` from the title.

### Step 5 — Mechanical validation

```bash
node scripts/validate.mjs games/<slug>/trophies.json
```

Fix every ❌ before continuing. Warnings are judgment calls: either fix them or justify them in `game.notes`. Do not proceed to audit with errors outstanding — you would be spending an auditor's attention on things a script already caught.

### Step 6 — Audit

Launch one `pantheon-auditor` subagent. Give it the path to `trophies.json`, the dossier, and the ruleset — and **nothing about your design reasoning**. Its verdict is only worth something if it is reading the list cold.

It returns `approve`, `revise` with specific findings, or `reject`.

### Step 7 — Revision loop

Address the findings and re-audit. **Maximum two revision rounds.** If the list is still not approved after the second, stop and bring the disagreement to the user — a third automated round usually means the problem is a judgment call that needs a human, not another pass.

### Step 8 — Render and finish

```bash
node scripts/render.mjs games/<slug>/trophies.json
```

Set `game.status` to `approved`, then commit:

```
pantheon(<slug>): add trophy list — <N> trophies, <mode> mode
```

Note that `render.mjs` never overwrites an existing `progress.md`. That file is the player's own record.

## Directory layout

```
games/<slug>/
├── trophies.json    ← source of truth, the only file you edit by hand
├── dossier.json     ← scout research, kept for future revisions
├── trophies.md      ← generated
└── progress.md      ← generated once, then owned by the player
```

## Other jobs

**Auditing an existing list** — skip to Step 6. Run the validator first anyway; it is nearly free.

**Revising a list** — edit `trophies.json`, bump `game.listVersion`, validate, audit, render. Never renumber existing IDs; retired trophy IDs are not reused.

**Adding DLC (Rule 14)** — a separate list under `dlc`. It never affects the base Platinum.
