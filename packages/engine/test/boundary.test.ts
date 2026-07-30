import { describe, expect, it } from "vitest";

import { clamp, wrap } from "../src/boundary";

describe("clamp", () => {
    it.each([
        [-2, 0],
        [-1, 0],
        [0, 0],
        [2, 2],
        [3, 3],
        [4, 3],
        [8, 3],
    ])("clamps %s into the interval [0, 3]", (value, expected) => {
        expect(clamp(value, 0, 3)).toBe(expected);
    });

    it("preserves fractional values inside the interval", () => {
        expect(clamp(1.5, 0, 3)).toBe(1.5);
    });

    it("returns the only value in a degenerate interval", () => {
        expect(clamp(8, 3, 3)).toBe(3);
    });
});

describe("wrap", () => {
    it.each([
        [-9, 3],
        [-5, 3],
        [-4, 0],
        [-1, 3],
        [0, 0],
        [2, 2],
        [3, 3],
        [4, 0],
        [5, 1],
        [8, 0],
    ])("wraps %s into the periodic interval [0, 3]", (value, expected) => {
        expect(wrap(value, 0, 3)).toBe(expected);
    });

    it("supports a periodic interval with a non-zero origin", () => {
        expect(wrap(8, 3, 6)).toBe(4);
        expect(wrap(1, 3, 6)).toBe(5);
    });

    it("returns the only value in a degenerate interval", () => {
        expect(wrap(8, 3, 3)).toBe(3);
    });
});
