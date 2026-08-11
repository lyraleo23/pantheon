---
description: Build a Pantheon trophy list for a game
argument-hint: <game title> [platform] [--auto]
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Task, Glob, Grep
---

Build a Pantheon trophy list for: **$ARGUMENTS**

Use the `pantheon` skill and follow its pipeline in full — entry gate, mode selection, parallel scouts, dossier checkpoint, design, `validate.mjs`, auditor subagent, revision loop, `render.mjs`, commit.

If no platform was given, ask which one the player owns before starting. The entry gate depends on it.

If `--auto` appears in the arguments, skip the dossier checkpoint and run straight through. Still report the dossier summary in your final message so the user can spot a bad fact after the fact.
