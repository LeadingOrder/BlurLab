/**
 * Reusable spatial blur kernels.
 *
 * This module should contain only concrete Kernel values or functions that
 * construct them. Pixel access, boundary handling, convolution, and UI state
 * belong elsewhere.
 */
import type { Kernel } from "./kernel";

export const identityKernel: Kernel = {
    width: 1,
    height: 1,
    anchorX: 0,
    anchorY: 0,
    weights: new Float64Array([1]),
};

export const horizontalNeighbourBlurKernel: Kernel = {
    width: 2,
    height: 1,
    anchorX: 0,
    anchorY: 0,
    weights: new Float64Array([0.5, 0.5]),
};

export const boxBlur3x3Kernel: Kernel = {
    width: 3,
    height: 3,
    anchorX: 1,
    anchorY: 1,
    weights: new Float64Array(9).fill(1 / 9),
};
