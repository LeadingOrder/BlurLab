import { describe, expect, it } from "vitest";

import type { PixelBuffer } from "@blurlab/engine";

import {
    MICROSCOPE_RADIUS,
    MICROSCOPE_SIDE_LENGTH,
    clampMicroscopeCenter,
    createMicroscopeSamples,
} from "../src/microscope";

function createCoordinateBuffer(
    width: number,
    height: number,
): PixelBuffer {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;

            data[offset] = x;
            data[offset + 1] = y;
            data[offset + 3] = 255;
        }
    }

    return {
        width,
        height,
        data,
    };
}

describe("pixel microscope", () => {
    it("maps every grid cell to its corresponding image coordinate", () => {
        const buffer = createCoordinateBuffer(32, 24);
        const center = { x: 15, y: 12 };
        const samples = createMicroscopeSamples(buffer, center);

        expect(samples).toHaveLength(MICROSCOPE_SIDE_LENGTH ** 2);
        expect(samples[0]?.coordinate).toEqual({
            x: center.x - MICROSCOPE_RADIUS,
            y: center.y - MICROSCOPE_RADIUS,
        });
        expect(
            samples[MICROSCOPE_RADIUS * MICROSCOPE_SIDE_LENGTH + MICROSCOPE_RADIUS],
        ).toMatchObject({
            coordinate: center,
            rgba: [center.x, center.y, 0, 255],
            isCenter: true,
        });
    });

    it("clamps a selected center so a complete grid remains visible", () => {
        const buffer = createCoordinateBuffer(32, 24);

        expect(
            clampMicroscopeCenter({ x: 0, y: 23 }, buffer),
        ).toEqual({
            x: MICROSCOPE_RADIUS,
            y: buffer.height - MICROSCOPE_RADIUS - 1,
        });
    });

    it("allows every pixel to be the center of an image smaller than the grid", () => {
        const buffer = createCoordinateBuffer(4, 3);

        expect(
            clampMicroscopeCenter({ x: 3, y: 2 }, buffer),
        ).toEqual({ x: 3, y: 2 });
    });
});
