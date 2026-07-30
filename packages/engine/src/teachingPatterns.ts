import {
    RGBA_CHANNEL_COUNT,
    type PixelBuffer,
} from "./pixelBuffer";

export const DEFAULT_TEACHING_PATTERN_SIZE = 512;

export const TEACHING_PATTERN_IDS = [
    "edge",
    "vertical-stripes",
    "horizontal-stripes",
    "checkerboard",
    "impulse",
    "composite",
] as const;

export type TeachingPatternId =
    typeof TEACHING_PATTERN_IDS[number];

function assertValidPatternSize(size: number): void {
    if (
        !Number.isSafeInteger(size) ||
        size < 16 ||
        !Number.isInteger(Math.log2(size))
    ) {
        throw new RangeError(
            "Teaching pattern size must be a power-of-two integer of at least 16.",
        );
    }

    const dataLength =
        size * size * RGBA_CHANNEL_COUNT;

    if (!Number.isSafeInteger(dataLength)) {
        throw new RangeError(
            "Teaching pattern size exceeds the supported array length.",
        );
    }
}

function writeOpaqueGrayscale(
    data: Uint8ClampedArray,
    offset: number,
    value: number,
): void {
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
}

function sinusoid(
    coordinate: number,
    period: number,
): number {
    return 127.5 * (
        1 + Math.cos(2 * Math.PI * coordinate / period)
    );
}

function compositeValue(
    x: number,
    y: number,
    size: number,
): number {
    const half = size / 2;

    if (y < half && x < half) {
        return x < half / 2 ? 24 : 232;
    }

    if (y < half) {
        return sinusoid(
            x - half,
            Math.max(2, size / 16),
        );
    }

    if (x < half) {
        const cellSize = Math.max(1, size / 64);
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor((y - half) / cellSize);

        return (cellX + cellY) % 2 === 0 ? 24 : 232;
    }

    const localX = (x - half) / (half - 1);

    return 24 + localX * 208;
}

function patternValue(
    id: TeachingPatternId,
    x: number,
    y: number,
    size: number,
): number {
    switch (id) {
        case "edge":
            return x < size / 2 ? 24 : 232;
        case "vertical-stripes":
            return sinusoid(
                x,
                Math.max(2, size / 16),
            );
        case "horizontal-stripes":
            return sinusoid(
                y,
                Math.max(2, size / 16),
            );
        case "checkerboard": {
            const cellSize = Math.max(1, size / 32);
            const cellX = Math.floor(x / cellSize);
            const cellY = Math.floor(y / cellSize);

            return (cellX + cellY) % 2 === 0 ? 24 : 232;
        }
        case "impulse":
            return x === size / 2 && y === size / 2
                ? 255
                : 0;
        case "composite":
            return compositeValue(x, y, size);
    }
}

/**
 * Creates exact, deterministic sources for explaining blur in the spatial and
 * frequency domains. Keeping them in the engine makes their pixels testable
 * and lets every UI consume the same canonical PixelBuffer representation.
 */
export function createTeachingPattern(
    id: TeachingPatternId,
    size = DEFAULT_TEACHING_PATTERN_SIZE,
): PixelBuffer {
    assertValidPatternSize(size);

    const data = new Uint8ClampedArray(
        size * size * RGBA_CHANNEL_COUNT,
    );
    let offset = 0;

    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            writeOpaqueGrayscale(
                data,
                offset,
                patternValue(id, x, y, size),
            );
            offset += RGBA_CHANNEL_COUNT;
        }
    }

    return {
        width: size,
        height: size,
        data,
    };
}
