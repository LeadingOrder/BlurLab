import FFT from "fft.js";

import { wrap } from "./boundary";
import {
    assertValidKernel,
    type Kernel,
} from "./kernel";
import {
    assertValidPixelBuffer,
    RGBA_CHANNEL_COUNT,
    type PixelBuffer,
} from "./pixelBuffer";

const RED_COEFFICIENT = 0.2126;
const GREEN_COEFFICIENT = 0.7152;
const BLUE_COEFFICIENT = 0.0722;
const MINIMUM_REFERENCE_MAGNITUDE = 1e-12;

export type SpectrumAnalysisRequest = {
    source: PixelBuffer;
    kernel: Kernel;
    maximumDimension: number;
    decibelFloor: number;
};

export type PreparedSpectrumSource = {
    width: number;
    height: number;
    complexSpectrum: Float64Array;
    referenceMagnitude: number;
};

export type SpectrumAnalysisResult = {
    width: number;
    height: number;
    decibelFloor: number;
    boundary: "circular";
    inputDecibels: Float32Array;
    kernelDecibels: Float32Array;
    outputDecibels: Float32Array;
};

function assertValidMaximumDimension(
    maximumDimension: number,
): void {
    if (
        !Number.isSafeInteger(maximumDimension) ||
        maximumDimension < 2
    ) {
        throw new RangeError(
            "The maximum spectrum dimension must be an integer of at least two.",
        );
    }
}

function assertValidDecibelFloor(
    decibelFloor: number,
): void {
    if (
        !Number.isFinite(decibelFloor) ||
        decibelFloor >= 0
    ) {
        throw new RangeError(
            "The spectrum decibel floor must be finite and negative.",
        );
    }
}

function powerOfTwoAtMost(
    dimension: number,
    maximumDimension: number,
): number {
    const limit = Math.max(
        2,
        Math.min(dimension, maximumDimension),
    );

    return 2 ** Math.floor(Math.log2(limit));
}

function pixelLuma(
    buffer: PixelBuffer,
    x: number,
    y: number,
): number {
    const offset =
        (y * buffer.width + x) *
        RGBA_CHANNEL_COUNT;

    return (
        RED_COEFFICIENT * buffer.data[offset]! +
        GREEN_COEFFICIENT * buffer.data[offset + 1]! +
        BLUE_COEFFICIENT * buffer.data[offset + 2]!
    );
}

/**
 * Area-averages the complete image into a power-of-two scalar field.
 *
 * Keeping the full field avoids changing the Fourier scope into a local crop.
 * The overlap weights also make the reduction a low-pass operation rather
 * than an aliased point sample.
 */
function createReducedLumaField(
    source: PixelBuffer,
    width: number,
    height: number,
): Float64Array {
    const result = new Float64Array(width * height);
    const sourcePixelsPerTargetX = source.width / width;
    const sourcePixelsPerTargetY = source.height / height;
    const targetArea =
        sourcePixelsPerTargetX *
        sourcePixelsPerTargetY;

    for (let targetY = 0; targetY < height; targetY += 1) {
        const sourceTop =
            targetY * sourcePixelsPerTargetY;
        const sourceBottom =
            (targetY + 1) * sourcePixelsPerTargetY;
        const firstSourceY = Math.floor(sourceTop);
        const lastSourceY = Math.ceil(sourceBottom);

        for (let targetX = 0; targetX < width; targetX += 1) {
            const sourceLeft =
                targetX * sourcePixelsPerTargetX;
            const sourceRight =
                (targetX + 1) * sourcePixelsPerTargetX;
            const firstSourceX = Math.floor(sourceLeft);
            const lastSourceX = Math.ceil(sourceRight);
            let weightedLuma = 0;

            for (
                let sourceY = firstSourceY;
                sourceY < lastSourceY;
                sourceY += 1
            ) {
                const verticalOverlap = Math.max(
                    0,
                    Math.min(sourceY + 1, sourceBottom) -
                        Math.max(sourceY, sourceTop),
                );
                const clampedY = Math.min(
                    source.height - 1,
                    sourceY,
                );

                for (
                    let sourceX = firstSourceX;
                    sourceX < lastSourceX;
                    sourceX += 1
                ) {
                    const horizontalOverlap = Math.max(
                        0,
                        Math.min(sourceX + 1, sourceRight) -
                            Math.max(sourceX, sourceLeft),
                    );
                    const clampedX = Math.min(
                        source.width - 1,
                        sourceX,
                    );

                    weightedLuma +=
                        pixelLuma(source, clampedX, clampedY) *
                        horizontalOverlap *
                        verticalOverlap;
                }
            }

            result[targetY * width + targetX] =
                weightedLuma / targetArea;
        }
    }

    return result;
}

function transformRows(
    values: Float64Array,
    width: number,
    height: number,
): void {
    const fft = new FFT(width);
    const input = new Float64Array(width * 2);
    const output = new Float64Array(width * 2);

    for (let y = 0; y < height; y += 1) {
        const rowOffset = y * width * 2;

        input.set(
            values.subarray(
                rowOffset,
                rowOffset + width * 2,
            ),
        );
        fft.transform(output, input);
        values.set(output, rowOffset);
    }
}

function transformColumns(
    values: Float64Array,
    width: number,
    height: number,
): void {
    const fft = new FFT(height);
    const input = new Float64Array(height * 2);
    const output = new Float64Array(height * 2);

    for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
            const sourceOffset =
                (y * width + x) * 2;
            const columnOffset = y * 2;

            input[columnOffset] =
                values[sourceOffset]!;
            input[columnOffset + 1] =
                values[sourceOffset + 1]!;
        }

        fft.transform(output, input);

        for (let y = 0; y < height; y += 1) {
            const targetOffset =
                (y * width + x) * 2;
            const columnOffset = y * 2;

            values[targetOffset] =
                output[columnOffset]!;
            values[targetOffset + 1] =
                output[columnOffset + 1]!;
        }
    }
}

function transformRealField(
    field: Float64Array,
    width: number,
    height: number,
): Float64Array {
    const complex = new Float64Array(
        width * height * 2,
    );

    for (let index = 0; index < field.length; index += 1) {
        complex[index * 2] = field[index]!;
    }

    transformRows(complex, width, height);
    transformColumns(complex, width, height);

    return complex;
}

function maximumMagnitude(
    spectrum: Float64Array,
): number {
    let maximum = 0;

    for (let offset = 0; offset < spectrum.length; offset += 2) {
        maximum = Math.max(
            maximum,
            Math.hypot(
                spectrum[offset]!,
                spectrum[offset + 1]!,
            ),
        );
    }

    return maximum;
}

function stableReferenceMagnitude(
    spectrum: Float64Array,
): number {
    const dcMagnitude = Math.hypot(
        spectrum[0]!,
        spectrum[1]!,
    );

    if (dcMagnitude >= MINIMUM_REFERENCE_MAGNITUDE) {
        return dcMagnitude;
    }

    return Math.max(
        maximumMagnitude(spectrum),
        MINIMUM_REFERENCE_MAGNITUDE,
    );
}

export function prepareSpectrumSource(
    source: PixelBuffer,
    maximumDimension: number,
): PreparedSpectrumSource {
    assertValidPixelBuffer(source);
    assertValidMaximumDimension(maximumDimension);

    const width = powerOfTwoAtMost(
        source.width,
        maximumDimension,
    );
    const height = powerOfTwoAtMost(
        source.height,
        maximumDimension,
    );
    const luma = createReducedLumaField(
        source,
        width,
        height,
    );
    const complexSpectrum = transformRealField(
        luma,
        width,
        height,
    );

    return {
        width,
        height,
        complexSpectrum,
        referenceMagnitude:
            stableReferenceMagnitude(complexSpectrum),
    };
}

function createKernelField(
    kernel: Kernel,
    width: number,
    height: number,
): Float64Array {
    const field = new Float64Array(width * height);

    for (let kernelY = 0; kernelY < kernel.height; kernelY += 1) {
        const periodicY = wrap(
            kernel.anchorY - kernelY,
            0,
            height - 1,
        );
        const kernelRowOffset =
            kernelY * kernel.width;

        for (let kernelX = 0; kernelX < kernel.width; kernelX += 1) {
            const periodicX = wrap(
                kernel.anchorX - kernelX,
                0,
                width - 1,
            );

            field[periodicY * width + periodicX] +=
                kernel.weights[kernelRowOffset + kernelX]!;
        }
    }

    return field;
}

function complexMultiply(
    left: Float64Array,
    right: Float64Array,
): Float64Array {
    const result = new Float64Array(left.length);

    for (let offset = 0; offset < left.length; offset += 2) {
        const leftReal = left[offset]!;
        const leftImaginary = left[offset + 1]!;
        const rightReal = right[offset]!;
        const rightImaginary = right[offset + 1]!;

        result[offset] =
            leftReal * rightReal -
            leftImaginary * rightImaginary;
        result[offset + 1] =
            leftReal * rightImaginary +
            leftImaginary * rightReal;
    }

    return result;
}

function createShiftedDecibels(
    spectrum: Float64Array,
    width: number,
    height: number,
    referenceMagnitude: number,
    decibelFloor: number,
): Float32Array {
    const result = new Float32Array(width * height);

    for (let displayY = 0; displayY < height; displayY += 1) {
        const sourceY =
            (displayY + height / 2) % height;

        for (let displayX = 0; displayX < width; displayX += 1) {
            const sourceX =
                (displayX + width / 2) % width;
            const sourceOffset =
                (sourceY * width + sourceX) * 2;
            const magnitude = Math.hypot(
                spectrum[sourceOffset]!,
                spectrum[sourceOffset + 1]!,
            );
            const decibels =
                20 *
                Math.log10(
                    Math.max(
                        magnitude,
                        MINIMUM_REFERENCE_MAGNITUDE,
                    ) /
                        referenceMagnitude,
                );

            result[displayY * width + displayX] =
                Math.max(
                    decibelFloor,
                    Math.min(0, decibels),
                );
        }
    }

    return result;
}

function assertValidPreparedSpectrumSource(
    source: PreparedSpectrumSource,
): void {
    if (
        !Number.isSafeInteger(source.width) ||
        !Number.isSafeInteger(source.height) ||
        source.width < 2 ||
        source.height < 2 ||
        !Number.isInteger(Math.log2(source.width)) ||
        !Number.isInteger(Math.log2(source.height))
    ) {
        throw new RangeError(
            "Prepared spectrum dimensions must be powers of two of at least two.",
        );
    }

    if (
        source.complexSpectrum.length !==
        source.width * source.height * 2
    ) {
        throw new RangeError(
            "Prepared spectrum storage must match its dimensions.",
        );
    }

    if (
        !Number.isFinite(source.referenceMagnitude) ||
        source.referenceMagnitude <= 0
    ) {
        throw new RangeError(
            "Prepared spectrum reference magnitude must be finite and positive.",
        );
    }
}

export function analyzePreparedSpectrum(
    source: PreparedSpectrumSource,
    kernel: Kernel,
    decibelFloor: number,
): SpectrumAnalysisResult {
    assertValidPreparedSpectrumSource(source);
    assertValidKernel(kernel);
    assertValidDecibelFloor(decibelFloor);

    const kernelField = createKernelField(
        kernel,
        source.width,
        source.height,
    );
    const kernelSpectrum = transformRealField(
        kernelField,
        source.width,
        source.height,
    );
    const kernelReference =
        stableReferenceMagnitude(kernelSpectrum);
    const outputSpectrum = complexMultiply(
        source.complexSpectrum,
        kernelSpectrum,
    );

    return {
        width: source.width,
        height: source.height,
        decibelFloor,
        boundary: "circular",
        inputDecibels: createShiftedDecibels(
            source.complexSpectrum,
            source.width,
            source.height,
            source.referenceMagnitude,
            decibelFloor,
        ),
        kernelDecibels: createShiftedDecibels(
            kernelSpectrum,
            source.width,
            source.height,
            kernelReference,
            decibelFloor,
        ),
        outputDecibels: createShiftedDecibels(
            outputSpectrum,
            source.width,
            source.height,
            source.referenceMagnitude *
                kernelReference,
            decibelFloor,
        ),
    };
}

export function analyzeSpectrum(
    request: SpectrumAnalysisRequest,
): SpectrumAnalysisResult {
    const preparedSource = prepareSpectrumSource(
        request.source,
        request.maximumDimension,
    );

    return analyzePreparedSpectrum(
        preparedSource,
        request.kernel,
        request.decibelFloor,
    );
}
