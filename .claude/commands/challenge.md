---
description: Create a monthly Pantheon challenge
argument-hint: [AAAA-MM] [idea]
allowed-tools: Read, Write, Bash, WebSearch, WebFetch, Task, Glob, Grep
---

Create a Pantheon challenge for: **$ARGUMENTS**

1. If no month was given, use next month (or the current one if it has no challenge yet in `challenges/`).
2. Run the `pantheon-challenger` agent with the month and the idea, if any.
3. Run `node scripts/build-catalog.mjs`. It validates the pool against the catalog; if it fails, fix the challenge file and run it again.
4. Report the agent's summary to the user, in Portuguese. Do not commit unless asked.
