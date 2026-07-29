import { describe, expect, it } from "vitest";

import { clamp } from "../src/boundary";

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
