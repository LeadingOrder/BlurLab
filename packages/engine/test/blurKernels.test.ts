import { describe, expect, it } from "vitest";

import {
    boxBlur3x3Kernel,
    createBoxBlurKernel,
    createHorizontalNeighbourBlurKernel,
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

describe("createBoxBlurKernel", () => {
    it("creates a centered, normalized kernel from its radius", () => {
        const kernel = createBoxBlurKernel(2);

        expect(kernel.width).toBe(5);
        expect(kernel.height).toBe(5);
        expect(kernel.anchorX).toBe(2);
        expect(kernel.anchorY).toBe(2);
        expect(kernel.weights).toHaveLength(25);

        for (const weight of kernel.weights) {
            expect(weight).toBeCloseTo(1 / 25);
        }
    });

    it.each([
        ["zero", 0],
        ["negative", -1],
        ["fractional", 1.5],
        ["NaN", Number.NaN],
        ["positive infinity", Number.POSITIVE_INFINITY],
        ["negative infinity", Number.NEGATIVE_INFINITY],
    ])("rejects a %s radius", (_case, radius) => {
        expect(() => createBoxBlurKernel(radius)).toThrow(
            RangeError,
        );
    });

    it("returns independent weight storage", () => {
        const first = createBoxBlurKernel(2);
        const second = createBoxBlurKernel(2);

        expect(first.weights).not.toBe(second.weights);
    });
});

describe("createHorizontalNeighbourBlurKernel", () => {
    it("extends the forward horizontal neighbourhood from its radius", () => {
        const kernel = createHorizontalNeighbourBlurKernel(3);

        expect(kernel.width).toBe(4);
        expect(kernel.height).toBe(1);
        expect(kernel.anchorX).toBe(0);
        expect(kernel.anchorY).toBe(0);
        expect(kernel.weights).toHaveLength(4);

        for (const weight of kernel.weights) {
            expect(weight).toBeCloseTo(1 / 4);
        }
    });

    it("reproduces the original two-pixel kernel at radius one", () => {
        const kernel = createHorizontalNeighbourBlurKernel(1);

        expect([...kernel.weights]).toEqual(
            [...horizontalNeighbourBlurKernel.weights],
        );
        expect(kernel).toMatchObject({
            width: horizontalNeighbourBlurKernel.width,
            height: horizontalNeighbourBlurKernel.height,
            anchorX: horizontalNeighbourBlurKernel.anchorX,
            anchorY: horizontalNeighbourBlurKernel.anchorY,
        });
    });

    it.each([
        ["zero", 0],
        ["negative", -1],
        ["fractional", 1.5],
        ["NaN", Number.NaN],
        ["positive infinity", Number.POSITIVE_INFINITY],
        ["negative infinity", Number.NEGATIVE_INFINITY],
    ])("rejects a %s radius", (_case, radius) => {
        expect(() => createHorizontalNeighbourBlurKernel(radius)).toThrow(
            RangeError,
        );
    });

    it("returns independent weight storage", () => {
        const first = createHorizontalNeighbourBlurKernel(2);
        const second = createHorizontalNeighbourBlurKernel(2);

        expect(first.weights).not.toBe(second.weights);
    });
});
