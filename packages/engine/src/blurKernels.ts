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

export function createHorizontalNeighbourBlurKernel(
    radius: number,
): Kernel {
    if (!Number.isSafeInteger(radius) || radius < 1) {
        throw new RangeError(
            "Horizontal neighbour blur radius must be a positive safe integer.",
        );
    }

    const weightCount = radius + 1;

    if (!Number.isSafeInteger(weightCount)) {
        throw new RangeError(
            "Horizontal neighbour blur radius exceeds the supported kernel size.",
        );
    }

    return {
        width: weightCount,
        height: 1,
        anchorX: 0,
        anchorY: 0,
        weights: new Float64Array(weightCount).fill(
            1 / weightCount,
        ),
    };
}

export const horizontalNeighbourBlurKernel =
    createHorizontalNeighbourBlurKernel(1);

export function createBoxBlurKernel(
    radius: number,
): Kernel {
    if (!Number.isSafeInteger(radius) || radius < 1) {
        throw new RangeError(
            "Box blur radius must be a positive safe integer.",
        );
    }

    const sideLength = 2 * radius + 1;
    const weightCount = sideLength * sideLength;

    if (!Number.isSafeInteger(weightCount)) {
        throw new RangeError(
            "Box blur radius exceeds the supported kernel size.",
        );
    }

    return {
        width: sideLength,
        height: sideLength,
        anchorX: radius,
        anchorY: radius,
        weights: new Float64Array(weightCount).fill(
            1 / weightCount,
        ),
    };
}

export const boxBlur3x3Kernel =
    createBoxBlurKernel(1);

export function createGaussianBlurKernel(
    sigma: number,
): Kernel {
    if (!Number.isFinite(sigma) || sigma <= 0) {
        throw new RangeError(
            "Gaussian blur sigma must be a positive finite number.",
        );
    }

    const radius = Math.ceil(3 * sigma);
    const sideLength = 2 * radius + 1;
    const weightCount = sideLength * sideLength;

    if (!Number.isSafeInteger(weightCount)) {
        throw new RangeError(
            "Gaussian blur sigma exceeds the supported kernel size.",
        );
    }

    const axisWeights = new Float64Array(sideLength);
    let axisSum = 0;

    for (let index = 0; index < sideLength; index += 1) {
        const distance = index - radius;
        const weight = Math.exp(
            -(distance * distance) / (2 * sigma * sigma),
        );

        axisWeights[index] = weight;
        axisSum += weight;
    }

    const normalization = axisSum * axisSum;
    const weights = new Float64Array(weightCount);

    for (let y = 0; y < sideLength; y += 1) {
        for (let x = 0; x < sideLength; x += 1) {
            weights[y * sideLength + x] =
                (axisWeights[y]! * axisWeights[x]!) /
                normalization;
        }
    }

    return {
        width: sideLength,
        height: sideLength,
        anchorX: radius,
        anchorY: radius,
        weights,
    };
}
