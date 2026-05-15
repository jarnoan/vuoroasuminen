---
slug: translate-ui-to-finnish
created: 2026-04-21
status: in-progress
---

# Translate UI to Finnish

Translate all user-visible English strings in the Next.js UI to Finnish.

## Files to Change

1. `src/app/layout.tsx` — lang attribute + metadata description
2. `src/app/page.tsx` — tagline
3. `src/components/sign-in-button.tsx` — button label
4. `src/components/layout/header.tsx` — sign-out button, image alt
5. `src/components/schedule/schedule-table.tsx` — column headers, toast errors
6. `src/components/schedule/notes-cell.tsx` — placeholder
7. `src/components/schedule/schedule-cell.tsx` — title tooltip
8. `src/components/schedule/stats-panel.tsx` — labels
9. `src/components/schedule/publish-button.tsx` — all dialog/button/toast strings
10. `src/components/schedule/today-button.tsx` — button label

## Translation Map

| English | Finnish |
|---------|---------|
| Shared custody schedule for co-parents | Yhteinen vuoroasumisaikataulu vanhemmille |
| Sign in with Google | Kirjaudu sisään Googlella |
| Sign out | Kirjaudu ulos |
| User (alt text) | Käyttäjä |
| Date (column header) | Päivä |
| Notes (column header) | Muistiinpanot |
| Failed to save change. Please try again. | Tallennus epäonnistui. Yritä uudelleen. |
| Failed to save note. | Muistiinpanon tallennus epäonnistui. |
| Add note... | Lisää muistiinpano... |
| click to toggle (tooltip) | klikkaa vaihtaaksesi |
| Free: | Vapaa: |
| solo: | yksin: |
| wknd / wknds | vkl |
| Publish Schedule | Julkaise aikataulu |
| Publish {n} draft entries | Julkaise {n} luonnosta |
| This will lock the schedule and sync to Google Calendar. | Tämä lukitsee aikataulun ja synkronoi Google Kalenteriin. |
| Syncing {n} events to Google Calendar… | Synkronoidaan {n} tapahtumaa Google Kalenteriin… |
| Cancel | Peruuta |
| Publishing... | Julkaistaan... |
| Confirm | Vahvista |
| Publish (button) | Julkaise |
| Published {n} entries | Julkaistu {n} merkintää |
| Failed to publish. Please try again. | Julkaisu epäonnistui. Yritä uudelleen. |
| Calendar sync failed: | Kalenterin synkronointi epäonnistui: |
| Today | Tänään |
