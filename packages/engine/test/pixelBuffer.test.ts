import { describe, expect, it } from "vitest";

import {
    assertValidOffset,
    assertValidPixelBuffer,
    pixelCoordinateToOffset,
    pixelOffsetToCoordinate,
    type PixelBuffer,
    type PixelCoordinate,
} from "../src/pixelBuffer";

const twoByTwoBuffer: PixelBuffer = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
        10, 20, 30, 255,
        40, 50, 60, 255,
        70, 80, 90, 255,
        100, 110, 120, 255,
    ]),
};

describe("pixelCoordinateToOffset", () => {
    it("maps two-dimensional pixels to packed RGBA offsets", () => {
        expect(
            pixelCoordinateToOffset(
                twoByTwoBuffer,
                { x: 0, y: 0 },
            ),
        ).toBe(0);
        expect(
            pixelCoordinateToOffset(
                twoByTwoBuffer,
                { x: 1, y: 0 },
            ),
        ).toBe(4);
        expect(
            pixelCoordinateToOffset(
                twoByTwoBuffer,
                { x: 0, y: 1 },
            ),
        ).toBe(8);
        expect(
            pixelCoordinateToOffset(
                twoByTwoBuffer,
                { x: 1, y: 1 },
            ),
        ).toBe(12);
    });
});

describe("pixelOffsetToCoordinate", () => {
    it.each([
        [0, { x: 0, y: 0 }],
        [4, { x: 1, y: 0 }],
        [8, { x: 0, y: 1 }],
        [12, { x: 1, y: 1 }],
    ])(
        "maps packed offset %i to its pixel coordinate",
        (offset, expected) => {
            expect(
                pixelOffsetToCoordinate(
                    twoByTwoBuffer,
                    offset,
                ),
            ).toEqual(expected);
        },
    );

    it.each<PixelCoordinate>([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
    ])(
        "is the inverse of pixelCoordinateToOffset at ($x, $y)",
        (coordinate) => {
            const offset =
                pixelCoordinateToOffset(
                    twoByTwoBuffer,
                    coordinate,
                );

            expect(
                pixelOffsetToCoordinate(
                    twoByTwoBuffer,
                    offset,
                ),
            ).toEqual(coordinate);
        },
    );
});

describe("assertValidOffset", () => {
    it.each([0, 4, 8, 12])(
        "accepts aligned in-bounds offset %i",
        (offset) => {
            expect(() =>
                assertValidOffset(
                    twoByTwoBuffer,
                    offset,
                ),
            ).not.toThrow();
        },
    );

    it.each([
        ["negative", -4],
        ["misaligned", 1],
        ["fractional", 4.5],
        ["at the upper bound", 16],
        ["above the upper bound", 20],
        ["NaN", Number.NaN],
        ["infinite", Number.POSITIVE_INFINITY],
    ])(
        "rejects a %s offset",
        (_case, offset) => {
            expect(() =>
                assertValidOffset(
                    twoByTwoBuffer,
                    offset,
                ),
            ).toThrow(RangeError);
        },
    );
});

describe("assertValidPixelBuffer", () => {
    it("accepts a buffer containing exactly four channels per pixel", () => {
        const buffer: PixelBuffer = {
            width: 2,
            height: 1,
            data: new Uint8ClampedArray([
                10, 20, 30, 255,
                100, 110, 120, 255,
            ]),
        };

        expect(() => assertValidPixelBuffer(buffer)).not.toThrow();
    });

    it.each([
        ["zero", 0, 1],
        ["negative", -1, 1],
        ["fractional", 1.5, 1],
        ["non-finite", Number.POSITIVE_INFINITY, 1],
    ])(
        "rejects %s dimensions",
        (_case, width, height) => {
            const buffer: PixelBuffer = {
                width,
                height,
                data: new Uint8ClampedArray(),
            };

            expect(() => assertValidPixelBuffer(buffer)).toThrow(
                RangeError,
            );
        },
    );

    it("rejects data whose length is not four times width times height", () => {
        const buffer: PixelBuffer = {
            width: 1,
            height: 1,
            data: new Uint8ClampedArray([10, 20, 30]),
        };

        expect(() => assertValidPixelBuffer(buffer)).toThrow(
            RangeError,
        );
    });

    it("rejects dimensions whose required array length is unsafe", () => {
        const buffer: PixelBuffer = {
            width: Number.MAX_SAFE_INTEGER,
            height: 2,
            data: new Uint8ClampedArray(),
        };

        expect(() => assertValidPixelBuffer(buffer)).toThrow(
            RangeError,
        );
    });
});
