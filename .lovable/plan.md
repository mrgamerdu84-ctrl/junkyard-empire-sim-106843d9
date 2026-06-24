
## 1. Rival taxis — fix bugs + real behavior

Rewrite `src/game/CityRivalTaxis.tsx` so rivals stop disappearing and act like real taxis.

**Bug fix — no more vanishing**
- Remove the day/night `activeCount` filter that sets `opacity = 0` on rivals. Density should change traffic count, not blink the existing rivals off the map.
- Keep all spawned rival sprites mounted; only fade them when the operator goes bankrupt.
- Guard against `lens` returning 0 (paths not measured yet) by retrying on next frame instead of bailing the whole effect — fixes the "all rivals freeze / disappear" case after a hot reload.

**Behavior — roam → mission → return to HQ**
Give each rival a small state machine driven by RAF:
- `ROAM` — pick a random road, drive it end-to-end at a varied speed. When the road ends, pick another. This makes them visit every street, not just a fixed pair.
- `TO_MISSION` — when a mission is published on `window.__jceMissions` (see §2), the nearest non-busy rival from a still-solvent operator switches to this state and drives from its current point to the mission pickup point.
- `ON_MISSION` — sit on the pickup for ~1.5 s (mission "stolen" visual), then drive to the mission dropoff.
- `RETURN_HQ` — after dropoff (or after N completed roams), drive back to its operator's HQ coordinates (read from `window.__jceCompetitors[i].hq` published by `CityCompetitors`), park for 2–4 s, then re-enter `ROAM`.

Path-finding stays simple: we don't do real A*. Each transition picks the road segment whose nearest point is closest to the target and drives toward that target's projection along the segment; once within ~20 px we snap to the target and advance state. This is enough on this map and avoids the dead-stops the user keeps reporting.

**Anti-disappear watchdog**
Per-rival `lastMoveAt`. If a rival hasn't moved >0.5 px for 2 s outside `RETURN_HQ` parking, force a new road pick. This kills the "stuck mid-roundabout" case without bringing back the parking script.

## 2. Missions visible on the map

- In `src/game/InterventionDispatcher.tsx` (or wherever missions are created today), additionally publish active missions on `window.__jceMissions = [{ id, pickup:{x,y}, dropoff:{x,y}, createdAt }]` and dispatch a `jce:missions-changed` CustomEvent on create/resolve. No business-logic change — just exposing the data the rivals need to react to.
- `CityRivalTaxis` listens to that event and assigns the nearest free rival (one rival per mission). When the rival reaches the pickup, fire `jce:mission-taken` with `{ missionId, compId }` so the existing mission UI can mark it as "raflée par <concurrent>".

## 3. Apply the mockup HUD over the live map

Rebuild `src/game/CityHud.tsx` (and lightly touch `src/routes/index.tsx`) so the in-game HUD matches the screenshot:

Top row (fixed, foreground, above the map, never affected by zoom/rotation):
- Left: round avatar pill with "?" placeholder (no photo, anonymous director) — pure CSS, no image asset.
- Center-left of top: météo + 0$ pill (existing values, restyled into a dark capsule with the clock icon + coin icon).
- Right: settings cog button that opens the existing `GameMenu`.
- Second line left: dark rounded card showing date "Mercredi 24 juin · 16:16", period dot ("Journée"), city + density (this is the existing `CityHud` content, restyled).
- Center: small "MY TAXI WORLD" crown logo (pure CSS/SVG crown + text, no new asset).
- Right: wood-style "Missions" button with red badge count (reads `window.__jceMissions.length`). Click → opens the existing missions panel.

Rules respected:
- HUD stays fixed in the foreground, outside `.tt-world`, so device rotation only rotates the map underneath.
- No talkie, no black radio band, no second mini-map, no director photo — confirmed already gone, we just don't reintroduce them.
- Bottom 4 wood buttons (Gérer flotte / Améliorations QG / Radio & Missions / Rivalité), bandeau profil directeur, trophée, tuto-livre, stylo pseudo stay on `HomeScreen` only (per your answer: HUD = in-game).

All styling done with inline `<style>` + semantic tokens already in the project — no new assets, no new packages.

## Technical notes (skip if not needed)

- Files touched: `src/game/CityRivalTaxis.tsx` (rewrite RAF loop + state machine), `src/game/InterventionDispatcher.tsx` (publish window.__jceMissions + events), `src/game/CityCompetitors.tsx` (publish `hq:{x,y}` on each competitor object — small addition), `src/game/CityHud.tsx` (restyle into the mockup top bar), `src/routes/index.tsx` (mount new HUD bits in the fixed overlay zone, not inside `.tt-world`).
- No backend changes, no schema changes, no new dependencies.
- Verified via `tsgo` after the edit.
