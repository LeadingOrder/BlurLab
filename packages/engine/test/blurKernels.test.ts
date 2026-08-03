import { describe, expect, it } from "vitest";

import {
    boxBlur3x3Kernel,
    createBoxBlurKernel,
    createGaussianBlurKernel,
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

describe("createGaussianBlurKernel", () => {
    it("creates a centered, normalized kernel covering three sigma", () => {
        const kernel = createGaussianBlurKernel(1);
        const sum = kernel.weights.reduce(
            (total, weight) => total + weight,
            0,
        );

        expect(kernel.width).toBe(7);
        expect(kernel.height).toBe(7);
        expect(kernel.anchorX).toBe(3);
        expect(kernel.anchorY).toBe(3);
        expect(sum).toBeCloseTo(1);
    });

    it("is symmetric and gives the center the greatest weight", () => {
        const kernel = createGaussianBlurKernel(1.4);
        const centerIndex =
            kernel.anchorY * kernel.width + kernel.anchorX;
        const centerWeight = kernel.weights[centerIndex]!;

        for (let index = 0; index < kernel.weights.length; index += 1) {
            expect(kernel.weights[index]).toBeCloseTo(
                kernel.weights[kernel.weights.length - index - 1]!,
            );
            expect(kernel.weights[index]).toBeLessThanOrEqual(
                centerWeight,
            );
        }
    });

    it("constructs the two-dimensional kernel as a separable outer product", () => {
        const kernel = createGaussianBlurKernel(0.8);
        const pivot = kernel.weights[
            kernel.anchorY * kernel.width + kernel.anchorX
        ]!;

        for (let y = 0; y < kernel.height; y += 1) {
            for (let x = 0; x < kernel.width; x += 1) {
                const weight = kernel.weights[y * kernel.width + x]!;
                const vertical = kernel.weights[
                    y * kernel.width + kernel.anchorX
                ]!;
                const horizontal = kernel.weights[
                    kernel.anchorY * kernel.width + x
                ]!;

                expect(weight * pivot).toBeCloseTo(
                    vertical * horizontal,
                );
            }
        }
    });

    it.each([
        ["zero", 0],
        ["negative", -1],
        ["NaN", Number.NaN],
        ["positive infinity", Number.POSITIVE_INFINITY],
        ["negative infinity", Number.NEGATIVE_INFINITY],
    ])("rejects a %s sigma", (_case, sigma) => {
        expect(() => createGaussianBlurKernel(sigma)).toThrow(
            RangeError,
        );
    });

    it("returns independent weight storage", () => {
        const first = createGaussianBlurKernel(1);
        const second = createGaussianBlurKernel(1);

        expect(first.weights).not.toBe(second.weights);
    });
});
