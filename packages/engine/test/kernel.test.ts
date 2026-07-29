import { describe, expect, it } from "vitest";

import {
    assertValidKernel,
    type Kernel,
} from "../src/kernel";

describe("assertValidKernel", () => {
    it("accepts a finite kernel with a valid shape and anchor", () => {
        const kernel: Kernel = {
            width: 2,
            height: 1,
            anchorX: 0,
            anchorY: 0,
            weights: new Float64Array([0.5, 0.5]),
        };

        expect(() => assertValidKernel(kernel)).not.toThrow();
    });

    it.each([
        ["zero", 0, 1],
        ["negative", -1, 1],
        ["fractional", 1.5, 1],
        ["non-finite", Number.POSITIVE_INFINITY, 1],
    ])(
        "rejects %s dimensions",
        (_case, width, height) => {
            const kernel: Kernel = {
                width,
                height,
                anchorX: 0,
                anchorY: 0,
                weights: new Float64Array(),
            };

            expect(() => assertValidKernel(kernel)).toThrow(
                RangeError,
            );
        },
    );

    it.each([
        ["negative x", -1, 0],
        ["negative y", 0, -1],
        ["x at width", 2, 0],
        ["y at height", 0, 1],
        ["fractional x", 0.5, 0],
        ["fractional y", 0, 0.5],
    ])(
        "rejects an anchor with %s",
        (_case, anchorX, anchorY) => {
            const kernel: Kernel = {
                width: 2,
                height: 1,
                anchorX,
                anchorY,
                weights: new Float64Array([0.5, 0.5]),
            };

            expect(() => assertValidKernel(kernel)).toThrow(
                RangeError,
            );
        },
    );

    it("rejects a weight count that does not match the matrix dimensions", () => {
        const kernel: Kernel = {
            width: 2,
            height: 2,
            anchorX: 0,
            anchorY: 0,
            weights: new Float64Array([1, 0, 0]),
        };

        expect(() => assertValidKernel(kernel)).toThrow(
            RangeError,
        );
    });

    it.each([
        ["NaN", Number.NaN],
        ["positive infinity", Number.POSITIVE_INFINITY],
        ["negative infinity", Number.NEGATIVE_INFINITY],
    ])("rejects %s weights", (_case, weight) => {
        const kernel: Kernel = {
            width: 1,
            height: 1,
            anchorX: 0,
            anchorY: 0,
            weights: new Float64Array([weight]),
        };

        expect(() => assertValidKernel(kernel)).toThrow(
            RangeError,
        );
    });

    it("does not require a generic kernel to be normalized", () => {
        const kernel: Kernel = {
            width: 2,
            height: 1,
            anchorX: 0,
            anchorY: 0,
            weights: new Float64Array([2, -1]),
        };

        expect(() => assertValidKernel(kernel)).not.toThrow();
    });
});
