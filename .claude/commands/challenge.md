---
description: Create monthly Pantheon challenges (1 to 3 per month)
argument-hint: [AAAA-MM] [1-3] [idea; another idea]
allowed-tools: Read, Write, Bash, WebSearch, WebFetch, Task, Glob, Grep
---

Create Pantheon challenges for: **$ARGUMENTS**

Every argument is optional: a month `AAAA-MM`, how many challenges to create (1 to 3, default 1, or the number of ideas given), and ideas separated by `;`, one per challenge.

1. If no month was given, use next month (or the current one if it has no challenge yet in `challenges/`).
2. A month holds at most 3 challenges, in `challenges/<AAAA-MM>-1.json`, `-2` and `-3`. List the ones the month already has: the free slots are the numbers not taken. If there are fewer free slots than requested, create only what fits and say so; if there are none, stop and tell the user.
3. For each challenge, one after the other (never in parallel: each one must see the ones before it), run the `pantheon-challenger` agent with the month, the slot number and the idea for that slot, if any.
4. Run `node scripts/build-catalog.mjs`. It validates every pool against the catalog and the month's limit; if it fails, fix the challenge file and run it again.
5. Report the agents' summaries to the user, in Portuguese. Do not commit unless asked.
