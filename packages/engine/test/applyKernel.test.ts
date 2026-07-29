import { describe, expect, it } from "vitest";

import {
    boxBlur3x3Kernel,
    horizontalNeighbourBlurKernel,
    identityKernel,
} from "../src/blurKernels";
import type { PixelBuffer } from "../src/pixelBuffer";
import { applyKernel } from "../src/transforms/applyKernel";

function pixelBuffer(
    width: number,
    height: number,
    values: number[],
): PixelBuffer {
    return {
        width,
        height,
        data: new Uint8ClampedArray(values),
    };
}

describe("applyKernel", () => {
    it("reconstructs the source exactly with the identity kernel", () => {
        const source = pixelBuffer(
            2,
            1,
            [
                10, 20, 30, 40,
                50, 60, 70, 80,
            ],
        );

        const result = applyKernel(source, identityKernel);

        expect(result).not.toBe(source);
        expect(result.data).not.toBe(source.data);
        expect(result).toEqual(source);
    });

    it("averages each channel with the right-hand neighbour", () => {
        const source = pixelBuffer(
            3,
            1,
            [
                0, 10, 20, 255,
                10, 20, 30, 255,
                20, 30, 40, 255,
            ],
        );

        const result = applyKernel(
            source,
            horizontalNeighbourBlurKernel,
        );

        expect([...result.data]).toEqual([
            5, 15, 25, 255,
            15, 25, 35, 255,
            20, 30, 40, 255,
        ]);
    });

    it("uses clamp-to-edge sampling at image boundaries", () => {
        const source = pixelBuffer(
            1,
            1,
            [18, 36, 72, 255],
        );

        const result = applyKernel(source, boxBlur3x3Kernel);

        expect([...result.data]).toEqual([18, 36, 72, 255]);
    });
});
