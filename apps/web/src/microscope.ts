import {
    pixelCoordinateToOffset,
    type PixelBuffer,
    type PixelCoordinate,
} from "@blurlab/engine";

export const MICROSCOPE_RADIUS = 5;
export const MICROSCOPE_SIDE_LENGTH =
    2 * MICROSCOPE_RADIUS + 1;

export type RgbaSample = readonly [
    red: number,
    green: number,
    blue: number,
    alpha: number,
];

export type MicroscopeSample = {
    coordinate: PixelCoordinate | null;
    rgba: RgbaSample | null;
    isCenter: boolean;
};

export function clampMicroscopeCenter(
    coordinate: PixelCoordinate,
    buffer: PixelBuffer,
): PixelCoordinate {
    const minX = buffer.width >= MICROSCOPE_SIDE_LENGTH
        ? MICROSCOPE_RADIUS
        : 0;
    const minY = buffer.height >= MICROSCOPE_SIDE_LENGTH
        ? MICROSCOPE_RADIUS
        : 0;
    const maxX = buffer.width >= MICROSCOPE_SIDE_LENGTH
        ? buffer.width - MICROSCOPE_RADIUS - 1
        : buffer.width - 1;
    const maxY = buffer.height >= MICROSCOPE_SIDE_LENGTH
        ? buffer.height - MICROSCOPE_RADIUS - 1
        : buffer.height - 1;

    return {
        x: Math.min(maxX, Math.max(minX, coordinate.x)),
        y: Math.min(maxY, Math.max(minY, coordinate.y)),
    };
}

export function readPixel(
    buffer: PixelBuffer,
    coordinate: PixelCoordinate,
): RgbaSample {
    const x = Math.min(
        buffer.width - 1,
        Math.max(0, coordinate.x),
    );
    const y = Math.min(
        buffer.height - 1,
        Math.max(0, coordinate.y),
    );
    const offset = pixelCoordinateToOffset(buffer, { x, y });

    return [
        buffer.data[offset]!,
        buffer.data[offset + 1]!,
        buffer.data[offset + 2]!,
        buffer.data[offset + 3]!,
    ];
}

export function createMicroscopeSamples(
    buffer: PixelBuffer | null,
    center: PixelCoordinate | null,
): MicroscopeSample[] {
    return Array.from(
        { length: MICROSCOPE_SIDE_LENGTH ** 2 },
        (_, index) => {
            const localX = index % MICROSCOPE_SIDE_LENGTH;
            const localY = Math.floor(
                index / MICROSCOPE_SIDE_LENGTH,
            );
            const isCenter =
                localX === MICROSCOPE_RADIUS &&
                localY === MICROSCOPE_RADIUS;

            if (buffer === null || center === null) {
                return {
                    coordinate: null,
                    rgba: null,
                    isCenter,
                };
            }

            const coordinate = {
                x: Math.min(
                    buffer.width - 1,
                    Math.max(
                        0,
                        center.x + localX - MICROSCOPE_RADIUS,
                    ),
                ),
                y: Math.min(
                    buffer.height - 1,
                    Math.max(
                        0,
                        center.y + localY - MICROSCOPE_RADIUS,
                    ),
                ),
            };

            return {
                coordinate,
                rgba: readPixel(buffer, coordinate),
                isCenter,
            };
        },
    );
}
