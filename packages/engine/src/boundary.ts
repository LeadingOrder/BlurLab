/**
 * Image-boundary policies.
 *
 * Keeping boundary behavior separate makes it explicit that edge sampling is
 * part of a transform's mathematical definition rather than part of
 * PixelBuffer storage.
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

/**
 * Maps a value into a periodic interval, including negative values.
 *
 * For pixel coordinates the interval is [0, length - 1], so crossing one edge
 * re-enters at the opposite edge. This is the boundary model assumed by the
 * discrete Fourier convolution theorem.
 */
export function wrap(
    value: number,
    min: number,
    max: number,
): number {
    const period = max - min + 1;

    return (
        ((value - min) % period + period) %
        period
    ) + min;
}
