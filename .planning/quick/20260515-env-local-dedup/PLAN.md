---
slug: env-local-dedup
date: 2026-05-15
---

# Quick Task: Clean up .env.local redundancy

Remove APP_FATHER_* / APP_MOTHER_* / APP_CHILDREN / APP_START_DATE / APP_FIRST_PARENT from .env.local.
These duplicate PARENT_* vars and are not read by any code.
Keep: APP_CALENDAR_OWNER_EMAIL (used by src/config/app.ts).

## Steps
1. Rewrite .env.local — remove lines 12-20 (# App block through APP_FIRST_PARENT)
2. Commit: chore: remove unused APP_* vars from .env.local
3. Update STATE.md Quick Tasks table
