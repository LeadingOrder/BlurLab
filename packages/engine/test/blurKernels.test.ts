import { describe, expect, it } from "vitest";

import {
    boxBlur3x3Kernel,
    horizontalNeighbourBlurKernel,
    identityKernel,
} from "../src/blurKernels";
import { assertValidKernel } from "../src/kernel";

describe.each([
    ["identity", identityKernel, 1],
    ["horizontal neighbour", horizontalNeighbourBlurKernel, 1],
    ["3 x 3 box blur", boxBlur3x3Kernel, 1],
])("%s kernel", (_name, kernel, expectedSum) => {
    it("is structurally valid", () => {
        expect(() => assertValidKernel(kernel)).not.toThrow();
    });

    it("preserves the average level of a constant image", () => {
        const weightSum = kernel.weights.reduce(
            (sum, weight) => sum + weight,
            0,
        );

        expect(weightSum).toBeCloseTo(expectedSum);
    });
});
