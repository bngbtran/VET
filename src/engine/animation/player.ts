import { createAnimationModel, getAnimationState, type AnimationModel, type AnimationState } from './state';
import type { PreparedJourney } from './prepare';

type FrameListener = (state: AnimationState) => void;

/**
 * Real-time preview playback. Owns the clock and a requestAnimationFrame loop; every tick is a
 * pure `getAnimationState` call pushed to listeners (map, overlay, timeline). React only hears
 * about play/pause changes, never about individual frames.
 */
export class Player {
  private model: AnimationModel | null = null;
  private time = 0;
  private playing = false;
  private raf = 0;
  private lastNow = 0;
  private frameListeners = new Set<FrameListener>();
  private statusListeners = new Set<() => void>();
  private lastState: AnimationState | null = null;

  setJourney(journey: PreparedJourney): void {
    this.model = createAnimationModel(journey);
    this.time = Math.min(this.time, this.model.timeline.duration);
    this.render();
  }

  get duration(): number {
    return this.model?.timeline.duration ?? 0;
  }

  get currentTime(): number {
    return this.time;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get state(): AnimationState | null {
    return this.lastState;
  }

  play(): void {
    if (this.playing || !this.model) return;
    if (this.time >= this.duration) this.time = 0;
    this.playing = true;
    this.lastNow = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.emitStatus();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emitStatus();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  restart(): void {
    this.seek(0);
    this.play();
  }

  /** Jump anywhere; route, vehicle, camera and overlays update immediately. */
  seek(time: number): void {
    this.time = Math.max(0, Math.min(this.duration, time));
    this.lastNow = performance.now();
    this.render();
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    if (this.lastState) listener(this.lastState);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Re-emit the current frame (e.g. after the map style reloads). */
  refresh(): void {
    this.render();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.frameListeners.clear();
    this.statusListeners.clear();
  }

  private tick = (now: number) => {
    if (!this.playing) return;
    // Cap the step so a backgrounded tab doesn't jump to the end on return.
    const dt = Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;
    this.time = Math.min(this.duration, this.time + dt);
    this.render();
    if (this.time >= this.duration) {
      this.playing = false;
      this.emitStatus();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private render() {
    if (!this.model) return;
    const state = getAnimationState(this.model, this.time);
    this.lastState = state;
    for (const l of this.frameListeners) l(state);
  }

  private emitStatus() {
    for (const l of this.statusListeners) l();
  }
}

/** The single preview player instance. */
export const player = new Player();
