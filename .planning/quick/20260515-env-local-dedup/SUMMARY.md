---
slug: env-local-dedup
status: complete
date: 2026-05-15
---

Removed 9 unused APP_* vars from .env.local (APP_FATHER_NAME/EMAIL/CALENDAR_ID, APP_MOTHER_NAME/EMAIL/CALENDAR_ID, APP_CHILDREN, APP_START_DATE, APP_FIRST_PARENT). These duplicated PARENT_* vars and were never read by any code. Kept APP_CALENDAR_OWNER_EMAIL (used by src/config/app.ts). Merged the two comment blocks into one.
