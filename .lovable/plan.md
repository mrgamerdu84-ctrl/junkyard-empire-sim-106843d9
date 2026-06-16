## Plan: Port Junky City Empire as the homepage

Replace the placeholder content in `src/routes/index.tsx` with a React version of your HTML game, preserving the visuals, animations, and gameplay.

### What gets built

- A `JunkyCityEmpire` component rendered at `/` (the home route).
- Top bar with Argent / Niveau / Ressources stats.
- City map with the road loop, junkyard (with animated swinging crane), and wash station (with bubble effect).
- Two cars (visitor + tow truck) that follow the 4-waypoint route on a `requestAnimationFrame` loop, rotate toward their target, stop at the car wash for 2s, earn 50€, and turn cyan.
- "JOUER" button that grants +500€ and temporarily boosts car speed for 3s.

### Technical approach

- Single file: rewrite `src/routes/index.tsx` (keep `createFileRoute("/")` and `head()` updated with French title/description for the game).
- State: `useState` for `argent`; `useRef` for car objects + DOM refs (cars, bubbles, money) so the rAF loop mutates refs without re-rendering 60×/sec. Money display updates via `useState` only on lavage/boost events.
- Animation loop: `useEffect` starts `requestAnimationFrame`, cleans up on unmount.
- Styling: convert the `<style>` block to a scoped `<style>` tag inside the component (keeps the exact look — dark theme, orange accents — without touching the global design tokens, since this is a self-contained game canvas).
- No new dependencies, no routing changes, no backend.

### Files touched

- `src/routes/index.tsx` — replaced with the game component.

Nothing else changes.