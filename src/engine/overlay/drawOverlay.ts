import type { LngLat } from '../../models/journey';
import type { TransportMode } from '../../models/transport';
import { TRANSPORT } from '../../models/transport';
import { REFERENCE_VIEWPORT } from '../../models/video';
import type { AnimationState, CaptionState, TitleCard } from '../animation/state';
import type { SceneStyle } from '../scene/mapScene';

export const FONT_SANS = '"Be Vietnam Pro", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Fonts the overlay draws with; must be loaded before the first export frame. */
export const OVERLAY_FONTS = [`600 84px ${FONT_SANS}`, `500 24px ${FONT_SANS}`, `500 22px ${FONT_MONO}`];

export interface OverlayEnv {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  /** Canvas pixels per logical (reference viewport) pixel. */
  scale: number;
  /** Geographic → logical pixel coordinates, using the camera that was just rendered. */
  project: (p: LngLat) => { x: number; y: number };
  vehicles: Map<TransportMode, HTMLImageElement>;
  style: SceneStyle;
  /** Map data credit, drawn small in the corner of every frame. */
  attribution: string;
}

const W = REFERENCE_VIEWPORT.width;
const H = REFERENCE_VIEWPORT.height;

interface Palette {
  text: string;
  muted: string;
  shadow: string;
  scrim: string;
}

const palette = (tone: SceneStyle['tone']): Palette =>
  tone === 'dark'
    ? { text: '#f4f1ea', muted: 'rgba(244,241,234,0.62)', shadow: 'rgba(0,0,0,0.65)', scrim: '0,0,0' }
    : { text: '#121316', muted: 'rgba(18,19,22,0.62)', shadow: 'rgba(255,255,255,0.85)', scrim: '255,255,255' };

type Ctx = OverlayEnv['ctx'];

function setSpacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function text(ctx: Ctx, value: string, x: number, y: number, font: string, color: string, spacing = 0) {
  ctx.font = font;
  ctx.fillStyle = color;
  setSpacing(ctx, spacing);
  ctx.fillText(value, x, y);
}

/**
 * Draw every 2D element of a frame — vehicle, labels, titles, caption — in reference-viewport
 * coordinates. Used for the live preview and, unchanged, for every exported frame. Draws on top
 * of whatever is already on the canvas (the exporter draws the map frame first).
 */
export function drawOverlay(env: OverlayEnv, state: AnimationState): void {
  const { ctx, scale, style } = env;
  const pal = palette(style.tone);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'alphabetic';

  if (style.tone === 'dark') {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.overlay.labels) drawLabels(env, state, pal);
  if (state.vehicle) drawVehicle(env, state);
  if (state.overlay.title) drawTitle(ctx, state.overlay.title, style, pal);
  if (state.overlay.caption) drawCaption(ctx, state.overlay.caption, style, pal);

  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.55;
  text(ctx, env.attribution, W - 24, H - 18, `400 13px ${FONT_SANS}`, pal.muted, 0.3);
  ctx.restore();
}

function drawLabels(env: OverlayEnv, state: AnimationState, pal: Palette) {
  const { ctx } = env;
  // Hide a label while the title card is announcing that same place.
  const announced = state.overlay.title;
  for (const m of state.markers) {
    const p = env.project(m.position);
    if (p.x < -200 || p.x > W + 200 || p.y < -100 || p.y > H + 100) continue;
    const fade = announced && announced.name === m.name.toLocaleUpperCase('vi') ? 1 - announced.opacity : 1;
    if (fade <= 0.01) continue;
    ctx.globalAlpha = fade * (m.reached ? 1 : 0.75);
    ctx.shadowColor = pal.shadow;
    ctx.shadowBlur = 10;
    text(ctx, m.name, p.x + 18, p.y + 8, `600 24px ${FONT_SANS}`, pal.text, 0.5);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function drawVehicle(env: OverlayEnv, state: AnimationState) {
  const { ctx, style } = env;
  const v = state.vehicle!;
  const img = env.vehicles.get(v.transport);
  const p = env.project(v.position);
  const pitch = (state.camera.pitch * Math.PI) / 180;
  const rotation = TRANSPORT[v.transport].rotates ? ((v.bearing - state.camera.bearing) * Math.PI) / 180 : 0;
  const size = v.transport === 'airplane' ? 58 : v.transport === 'walking' ? 34 : 46;

  ctx.save();
  ctx.translate(p.x, p.y);
  // Lie flat on the pitched ground plane: foreshorten vertically, then rotate within the plane.
  ctx.scale(1, Math.max(0.45, Math.cos(pitch)));

  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.95);
  halo.addColorStop(0, hexToRgba(style.routeColor, 0.55));
  halo.addColorStop(1, hexToRgba(style.routeColor, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.95, 0, Math.PI * 2);
  ctx.fill();

  if (img) {
    ctx.rotate(rotation);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

function drawTitle(ctx: Ctx, title: TitleCard, style: SceneStyle, pal: Palette) {
  const a = title.opacity;
  const large = title.size === 'large';
  const x = 120;
  const base = H - (large ? 132 : 120) + (1 - a) * 16; // drift up as it fades in

  // Soft scrim from the bottom so the type reads on any map.
  const scrim = ctx.createLinearGradient(0, H * 0.5, 0, H);
  scrim.addColorStop(0, `rgba(${pal.scrim},0)`);
  scrim.addColorStop(1, `rgba(${pal.scrim},${0.6 * a})`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.5, W, H * 0.5);

  ctx.globalAlpha = a;
  const nameSize = large ? 84 : 56;
  if (title.kicker) text(ctx, title.kicker, x, base - nameSize - 34, `500 20px ${FONT_MONO}`, style.routeColor, 6);
  ctx.shadowColor = pal.shadow;
  ctx.shadowBlur = 18;
  text(ctx, title.name, x - 4, base - 20, `600 ${nameSize}px ${FONT_SANS}`, pal.text, large ? 10 : 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = style.routeColor;
  ctx.fillRect(x, base, 72 * a, 3);
  text(ctx, title.coordinates, x, base + 44, `500 22px ${FONT_MONO}`, pal.muted, 2);
  ctx.globalAlpha = 1;
}

function drawCaption(ctx: Ctx, caption: CaptionState, style: SceneStyle, pal: Palette) {
  const a = caption.opacity;
  if (a <= 0.001) return;
  ctx.globalAlpha = a;
  ctx.shadowColor = pal.shadow;
  ctx.shadowBlur = 12;
  text(ctx, caption.route, 72, 92, `600 24px ${FONT_SANS}`, pal.text, 4);
  text(ctx, caption.detail, 72, 128, `500 17px ${FONT_MONO}`, pal.muted, 2.5);
  if (caption.clock) {
    ctx.textAlign = 'right';
    text(ctx, caption.clock, W - 72, 110, `500 44px ${FONT_MONO}`, pal.text, 1);
    ctx.textAlign = 'left';
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = hexToRgba(style.routeColor, 0.75);
  ctx.fillRect(0, H - 3, W * caption.progress, 3);
  ctx.globalAlpha = 1;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(242,180,90,${alpha})`;
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${alpha})`;
}
