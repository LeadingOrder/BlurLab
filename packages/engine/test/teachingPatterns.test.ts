import { describe, expect, it } from "vitest";

import {
    createTeachingPattern,
    TEACHING_PATTERN_IDS,
    type TeachingPatternId,
} from "../src/teachingPatterns";
import {
    pixelCoordinateToOffset,
    type PixelBuffer,
} from "../src/pixelBuffer";

function grayscaleAt(
    buffer: PixelBuffer,
    x: number,
    y: number,
): number {
    return buffer.data[
        pixelCoordinateToOffset(buffer, { x, y })
    ]!;
}

describe("createTeachingPattern", () => {
    it.each(TEACHING_PATTERN_IDS)(
        "creates a valid opaque %s pattern",
        (id) => {
            const buffer = createTeachingPattern(id, 32);

            expect(buffer.width).toBe(32);
            expect(buffer.height).toBe(32);
            expect(buffer.data).toHaveLength(32 * 32 * 4);

            for (let offset = 0; offset < buffer.data.length; offset += 4) {
                expect(buffer.data[offset + 1]).toBe(buffer.data[offset]);
                expect(buffer.data[offset + 2]).toBe(buffer.data[offset]);
                expect(buffer.data[offset + 3]).toBe(255);
            }
        },
    );

    it("places the hard edge halfway across the image", () => {
        const buffer = createTeachingPattern("edge", 32);

        expect(grayscaleAt(buffer, 15, 10)).toBe(24);
        expect(grayscaleAt(buffer, 16, 10)).toBe(232);
    });

    it("varies vertical stripes only along x", () => {
        const buffer = createTeachingPattern(
            "vertical-stripes",
            32,
        );

        expect(grayscaleAt(buffer, 0, 0)).toBe(
            grayscaleAt(buffer, 0, 19),
        );
        expect(grayscaleAt(buffer, 0, 0)).not.toBe(
            grayscaleAt(buffer, 1, 0),
        );
    });

    it("varies horizontal stripes only along y", () => {
        const buffer = createTeachingPattern(
            "horizontal-stripes",
            32,
        );

        expect(grayscaleAt(buffer, 0, 0)).toBe(
            grayscaleAt(buffer, 19, 0),
        );
        expect(grayscaleAt(buffer, 0, 0)).not.toBe(
            grayscaleAt(buffer, 0, 1),
        );
    });

    it("alternates checkerboard cells along both axes", () => {
        const buffer = createTeachingPattern(
            "checkerboard",
            32,
        );

        expect(grayscaleAt(buffer, 0, 0)).not.toBe(
            grayscaleAt(buffer, 1, 0),
        );
        expect(grayscaleAt(buffer, 0, 0)).not.toBe(
            grayscaleAt(buffer, 0, 1),
        );
        expect(grayscaleAt(buffer, 0, 0)).toBe(
            grayscaleAt(buffer, 1, 1),
        );
    });

    it("contains exactly one bright impulse", () => {
        const buffer = createTeachingPattern("impulse", 32);
        let brightPixelCount = 0;

        for (let offset = 0; offset < buffer.data.length; offset += 4) {
            if (buffer.data[offset] === 255) {
                brightPixelCount += 1;
            }
        }

        expect(brightPixelCount).toBe(1);
        expect(grayscaleAt(buffer, 16, 16)).toBe(255);
    });

    it.each([0, 15, 17, 24, 30])(
        "rejects unsupported size %i",
        (size) => {
            expect(() =>
                createTeachingPattern("edge", size),
            ).toThrow(RangeError);
        },
    );

    it("rejects sizes whose packed RGBA length is unsafe", () => {
        expect(() =>
            createTeachingPattern("edge", 2 ** 27),
        ).toThrow(RangeError);
    });

    it("keeps the public identifiers accepted by the generator", () => {
        for (const id of TEACHING_PATTERN_IDS) {
            expect(() =>
                createTeachingPattern(
                    id as TeachingPatternId,
                    32,
                ),
            ).not.toThrow();
        }
    });
});
