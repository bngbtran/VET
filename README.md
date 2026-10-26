# Vệt

**Mỗi hành trình để lại một Vệt.** — *Every journey leaves a trace.*

Vệt turns a journey (places + transport + timing) into a cinematic animated route on a map and
exports it as a video, entirely in the browser. It is a private tool for a handful of people:
static hosting, no backend, no accounts, no tracking.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run check      # typecheck + lint + unit tests + build
npm run e2e        # real-browser MVP test (needs `npm run build` first, uses installed Chrome)
```

Requires a desktop browser with WebCodecs (Chrome / Edge 94+, Firefox 130+, Safari 16.4+ for
encoding). Chrome/Edge are the tested targets.

## How it works

```
Search (Photon) ─► Place ─► RouteProvider ─► Route (simplified polyline)
                                               │
                         prepareJourney ◄──────┘  measure distances, camera params
                               │
                 getAnimationState(model, t)  ◄── pure + deterministic
                  ├─ Vệt (route up to distance)   ─► MapLibre GeoJSON sources
                  ├─ camera (center/zoom/bearing/pitch) ─► map.jumpTo
                  └─ vehicle, labels, titles, caption ─► 2D overlay canvas
                               │
     Preview: requestAnimationFrame clock      Export: t = frame / fps
                                               hidden map → wait for `idle`
                                               → map pixels + overlay → VideoFrame
                                               → Worker: WebCodecs + mediabunny → MP4/WebM
```

* **Deterministic.** Everything visual is a function of `(journey, time)`. Preview, seeking and
  export all call `getAnimationState`; the exporter renders frame *n* at `t = n / fps` and waits
  until the map has loaded every tile before capturing, so output never depends on machine speed.
* **Distance-based motion.** Routes are measured once (cumulative metres per vertex); the vehicle
  sits at `totalDistance × eased(progress)` and the Vệt is cut exactly at that point.
* **Resolution-independent framing.** All cameras are computed for a logical 1920×1080 viewport.
  The preview lays the map out at that size and CSS-scales it; the exporter uses
  `pixelRatio = width / 1920`. 720p and 4K are framed identically to what you see.
* **React stays out of the frame loop.** The `Player` owns the clock and pushes states straight
  to the map, overlay and scrubber; React only handles configuration.

### Source layout

| Path | Responsibility |
| --- | --- |
| `src/models/` | Journey / segment / route / video-settings types and factories |
| `src/providers/routing/` | `RouteProvider` interface; OSRM (road), great-circle (air), approximate rail |
| `src/providers/geocoding/` | `GeocodingProvider`; Photon autocomplete |
| `src/providers/maps/` | Keyless basemap styles + attribution |
| `src/engine/route/` | Geodesy, distance measurement, interpolation, simplification |
| `src/engine/animation/` | Timeline, easing, `getAnimationState`, preview `Player` |
| `src/engine/camera/` | Static / follow / cinematic director, fly interpolation, fit-bounds |
| `src/engine/scene/` | MapLibre layers (route-background, glow, progress, markers), vehicle icons |
| `src/engine/overlay/` | 2D overlay renderer shared by preview and export |
| `src/engine/video/` | Deterministic frame renderer, encoder proxy, export job |
| `src/workers/` | Encoder worker (WebCodecs + mediabunny muxing) |
| `src/stores/` | Journey store, IndexedDB projects |
| `src/components/` | UI: journey, map preview, player, export, projects |

## External services

All free and keyless; only coordinates / search text are sent, and only when needed.

| Purpose | Service | Notes |
| --- | --- | --- |
| Place search | [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api) (GeoNames) + [Photon](https://photon.komoot.io) (komoot) | Queried in parallel, results stream in. Open-Meteo: fast, cities/towns. Photon: streets and landmarks; skipped for 60 s after a timeout. Names are romanized (Latin script), Vietnamese keeps diacritics. |
| Road / bike / foot routing | [FOSSGIS OSRM](https://routing.openstreetmap.de) | Separate car, bike, foot graphs. Fair use; no SLA. |
| Basemaps | [CARTO](https://carto.com/basemaps) and [OpenFreeMap](https://openfreemap.org) | Attribution is drawn on every exported frame. |

Airplane routes are computed locally (great circle). **Train routes are an approximation**: there
is no free keyless rail router, so trains follow a gentle arc and the UI labels them
"approximate path". Swapping in a real router means adding one `RouteProvider`.

## Data & privacy

Projects are auto-saved to this browser's IndexedDB; nothing is uploaded. Use
*Projects → Export project (JSON)* to back up or move a journey to another machine, and
*Import project…* to load it. No analytics, ads or telemetry.

## Deployment (Cloudflare Pages)

Build command `npm run build`, output directory `dist`. `public/_headers` sets `noindex` and a
strict referrer policy. For privacy beyond obscurity, put the site behind
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (free for
small teams) with an email allow-list.

## Known limits

* Keep the tab visible while exporting — browsers pause rendering in background tabs (export
  waits rather than producing broken frames).
* 4K and long 60 FPS exports are memory-heavy; the whole file is assembled in memory.
* Routes crossing the antimeridian (e.g. Tokyo → San Francisco) render, but the overview camera
  may frame them loosely.
