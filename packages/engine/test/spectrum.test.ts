import { describe, expect, it } from "vitest";

import {
    createBoxBlurKernel,
    identityKernel,
} from "../src/blurKernels";
import type { Kernel } from "../src/kernel";
import type { PixelBuffer } from "../src/pixelBuffer";
import {
    analyzeSpectrum,
    prepareSpectrumSource,
} from "../src/spectrum";
import { createTeachingPattern } from "../src/teachingPatterns";

const SIZE = 32;
const DECIBEL_FLOOR = -80;

function createGrayscaleBuffer(
    width: number,
    height: number,
    valueAt: (x: number, y: number) => number,
): PixelBuffer {
    const data = new Uint8ClampedArray(
        width * height * 4,
    );

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            const value = valueAt(x, y);

            data[offset] = value;
            data[offset + 1] = value;
            data[offset + 2] = value;
            data[offset + 3] = 255;
        }
    }

    return { width, height, data };
}

function analyze(
    source: PixelBuffer,
    kernel: Kernel = identityKernel,
) {
    return analyzeSpectrum({
        source,
        kernel,
        maximumDimension: SIZE,
        decibelFloor: DECIBEL_FLOOR,
    });
}

function shiftedIndex(
    x: number,
    y: number,
    width = SIZE,
): number {
    return y * width + x;
}

describe("analyzeSpectrum", () => {
    it("returns aligned, finite two-dimensional decibel fields", () => {
        const result = analyze(
            createTeachingPattern("composite", SIZE),
        );

        expect(result).toMatchObject({
            width: SIZE,
            height: SIZE,
            decibelFloor: DECIBEL_FLOOR,
            boundary: "circular",
        });

        for (const values of [
            result.inputDecibels,
            result.kernelDecibels,
            result.outputDecibels,
        ]) {
            expect(values).toHaveLength(SIZE * SIZE);

            for (const value of values) {
                expect(Number.isFinite(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(
                    DECIBEL_FLOOR,
                );
                expect(value).toBeLessThanOrEqual(0);
            }
        }
    });

    it("centres constant-image energy at the zero-frequency bin", () => {
        const result = analyze(
            createGrayscaleBuffer(
                SIZE,
                SIZE,
                () => 96,
            ),
        );
        const center = SIZE / 2;
        const centerIndex = shiftedIndex(center, center);

        expect(result.inputDecibels[centerIndex]).toBeCloseTo(0);

        const strongestOffCenter = Math.max(
            ...result.inputDecibels.filter(
                (_value, index) => index !== centerIndex,
            ),
        );

        expect(strongestOffCenter).toBe(DECIBEL_FLOOR);
    });

    it("gives a spatial impulse a flat magnitude spectrum", () => {
        const result = analyze(
            createTeachingPattern("impulse", SIZE),
        );

        for (const value of result.inputDecibels) {
            expect(value).toBeCloseTo(0, 5);
        }
    });

    it("places vertical-stripe frequencies on the horizontal axis", () => {
        const result = analyze(
            createTeachingPattern(
                "vertical-stripes",
                SIZE,
            ),
        );
        const center = SIZE / 2;

        for (let y = 0; y < SIZE; y += 1) {
            if (y === center) {
                continue;
            }

            for (let x = 0; x < SIZE; x += 1) {
                expect(
                    result.inputDecibels[
                        shiftedIndex(x, y)
                    ],
                ).toBe(DECIBEL_FLOOR);
            }
        }
    });

    it("places horizontal-stripe frequencies on the vertical axis", () => {
        const result = analyze(
            createTeachingPattern(
                "horizontal-stripes",
                SIZE,
            ),
        );
        const center = SIZE / 2;

        for (let y = 0; y < SIZE; y += 1) {
            for (let x = 0; x < SIZE; x += 1) {
                if (x === center) {
                    continue;
                }

                expect(
                    result.inputDecibels[
                        shiftedIndex(x, y)
                    ],
                ).toBe(DECIBEL_FLOOR);
            }
        }
    });

    it("places checkerboard energy at a two-axis frequency", () => {
        const result = analyze(
            createTeachingPattern("checkerboard", SIZE),
        );
        const center = SIZE / 2;

        expect(
            result.inputDecibels[shiftedIndex(0, 0)],
        ).toBeGreaterThan(DECIBEL_FLOOR);
        expect(
            result.inputDecibels[
                shiftedIndex(0, center)
            ],
        ).toBe(DECIBEL_FLOOR);
        expect(
            result.inputDecibels[
                shiftedIndex(center, 0)
            ],
        ).toBe(DECIBEL_FLOOR);
    });

    it("gives the identity kernel a zero-decibel response", () => {
        const result = analyze(
            createTeachingPattern("composite", SIZE),
        );

        for (const value of result.kernelDecibels) {
            expect(value).toBeCloseTo(0, 5);
        }
    });

    it("matches input and output spectra for the identity kernel", () => {
        const result = analyze(
            createTeachingPattern("composite", SIZE),
        );

        expect([...result.outputDecibels]).toEqual(
            [...result.inputDecibels],
        );
    });

    it("computes the exact normalized product XH", () => {
        const result = analyze(
            createTeachingPattern("composite", SIZE),
            createBoxBlurKernel(2),
        );

        for (
            let index = 0;
            index < result.outputDecibels.length;
            index += 1
        ) {
            const expected = Math.max(
                DECIBEL_FLOOR,
                result.inputDecibels[index]! +
                    result.kernelDecibels[index]!,
            );

            expect(
                result.outputDecibels[index],
            ).toBeCloseTo(expected, 4);
        }
    });

    it("suppresses high frequencies more strongly for a larger box", () => {
        const source = createTeachingPattern(
            "composite",
            SIZE,
        );
        const small = analyze(
            source,
            createBoxBlurKernel(1),
        );
        const large = analyze(
            source,
            createBoxBlurKernel(3),
        );
        const center = SIZE / 2;
        const comparisonIndex = shiftedIndex(
            center + 3,
            center,
        );

        expect(
            large.kernelDecibels[comparisonIndex],
        ).toBeLessThan(
            small.kernelDecibels[comparisonIndex]!,
        );
        expect(
            large.kernelDecibels[
                shiftedIndex(center, center)
            ],
        ).toBeCloseTo(0);
    });

    it("preserves magnitude under a circular spatial shift", () => {
        const first = analyze(
            createGrayscaleBuffer(
                SIZE,
                SIZE,
                (x, y) =>
                    x === 3 && y === 7 ? 255 : 0,
            ),
        );
        const shifted = analyze(
            createGrayscaleBuffer(
                SIZE,
                SIZE,
                (x, y) =>
                    x === 19 && y === 28 ? 255 : 0,
            ),
        );

        for (
            let index = 0;
            index < first.inputDecibels.length;
            index += 1
        ) {
            expect(
                shifted.inputDecibels[index],
            ).toBeCloseTo(
                first.inputDecibels[index]!,
                5,
            );
        }
    });

    it("reduces the complete image to power-of-two dimensions", () => {
        const prepared = prepareSpectrumSource(
            createGrayscaleBuffer(
                300,
                170,
                (x, y) => (x + y) % 256,
            ),
            256,
        );

        expect(prepared.width).toBe(256);
        expect(prepared.height).toBe(128);
        expect(prepared.complexSpectrum).toHaveLength(
            256 * 128 * 2,
        );
    });

    it.each([
        ["zero", 0],
        ["one", 1],
        ["fractional", 63.5],
        ["infinite", Number.POSITIVE_INFINITY],
    ])(
        "rejects a %s maximum dimension",
        (_label, maximumDimension) => {
            expect(() =>
                analyzeSpectrum({
                    source: createTeachingPattern(
                        "edge",
                        SIZE,
                    ),
                    kernel: identityKernel,
                    maximumDimension,
                    decibelFloor: DECIBEL_FLOOR,
                }),
            ).toThrow(RangeError);
        },
    );

    it.each([0, 1, Number.NaN, Number.NEGATIVE_INFINITY])(
        "rejects the invalid decibel floor %s",
        (decibelFloor) => {
            expect(() =>
                analyzeSpectrum({
                    source: createTeachingPattern(
                        "edge",
                        SIZE,
                    ),
                    kernel: identityKernel,
                    maximumDimension: SIZE,
                    decibelFloor,
                }),
            ).toThrow(RangeError);
        },
    );
});
