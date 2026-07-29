/**
 * Image-boundary policies.
 *
 * Begin with clamp-to-edge coordinate handling. Keeping boundary behavior
 * separate makes it explicit that edge sampling is part of a transform's
 * mathematical definition rather than part of PixelBuffer storage.
 */
export function clamp(
    value: number,
    min: number,
    max: number,
): number {
    return Math.min(
        Math.max(value, min),
        max,
    );
};
