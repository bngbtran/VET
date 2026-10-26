export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Map x from [a, b] onto [0, 1], clamped. */
export const remap01 = (x: number, a: number, b: number) => (b > a ? clamp01((x - a) / (b - a)) : x >= b ? 1 : 0);

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInCubic = (t: number) => t * t * t;
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Travel easing: mostly linear (constant cruising speed) with a gentle departure and a
 * gentle arrival. At the ends the vehicle moves at ~40% of cruising speed rather than
 * stopping dead, which reads as "slowing into the destination".
 */
export const travelEase = (t: number) => lerp(t, easeInOutSine(t), 0.6);
