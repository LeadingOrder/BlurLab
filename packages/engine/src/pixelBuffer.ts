/**
 * Canonical image storage.
 *
 * This module will own:
 * - the PixelBuffer type;
 * - its data-length invariant;
 * - conversion from (x, y) pixel coordinates to packed RGBA offsets.
 *
 * It must not contain Canvas, ImageData, view state, processing settings, or
 * blur-specific behavior.
 */
export const RGBA_CHANNEL_COUNT = 4;

export type PixelBuffer = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
};

export type PixelCoordinate = {
    x: number;
    y: number;
};

export function pixelCoordinateToOffset(
    buffer: PixelBuffer,
    coordinate: PixelCoordinate,
): number {
    return RGBA_CHANNEL_COUNT * (buffer.width * coordinate.y + coordinate.x);
}

export function pixelOffsetToCoordinate(
    buffer: PixelBuffer,
    offset: number,
): PixelCoordinate {
    assertValidOffset(buffer, offset);

    const pixelIndex =
        offset / RGBA_CHANNEL_COUNT;

    return {
        x: pixelIndex % buffer.width,
        y: Math.floor(pixelIndex / buffer.width),
    };
}

export function assertValidOffset(
    buffer: PixelBuffer,
    offset: number,
): void {
    assertValidPixelBuffer(buffer);

    if (!Number.isSafeInteger(offset)) {
        throw new RangeError(
            "Offset must be a safe integer.",
        );
    }

    if (
        offset < 0 ||
        offset >= buffer.data.length
    ) {
        throw new RangeError(
            `Offset must be between 0 and ${buffer.data.length - RGBA_CHANNEL_COUNT}.`,
        );
    }

    if (offset % RGBA_CHANNEL_COUNT !== 0) {
        throw new RangeError(
            `Offset must be divisible by ${RGBA_CHANNEL_COUNT}.`,
        );
    }
}

export function assertValidPixelBuffer(
    buffer: PixelBuffer,
): void {
    if (
        !Number.isInteger(buffer.width) ||
        !Number.isInteger(buffer.height) ||
        buffer.width <= 0 ||
        buffer.height <= 0
    ) {
        throw new RangeError(
            "PixelBuffer dimensions must be positive integers.",
        );
    }

    const expectedLength =
        buffer.width *
        buffer.height *
        RGBA_CHANNEL_COUNT;

    if (!Number.isSafeInteger(expectedLength)) {
        throw new RangeError(
            "PixelBuffer dimensions exceed the supported array size.",
        );
    }

    if (buffer.data.length !== expectedLength) {
        throw new RangeError(
            `PixelBuffer data length must be ${expectedLength}, received ${buffer.data.length}.`,
        );
    }
}
