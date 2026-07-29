import { clamp } from "../boundary";
import { assertValidKernel, type Kernel } from "../kernel";
import {
    assertValidPixelBuffer,
    RGBA_CHANNEL_COUNT,
    type PixelBuffer,
} from "../pixelBuffer";

export function applyKernel(
    source: PixelBuffer,
    kernel: Kernel,
): PixelBuffer {
    assertValidKernel(kernel);
    assertValidPixelBuffer(source);

    const outputBuffer: PixelBuffer = {
        ...source,
        data: new Uint8ClampedArray(source.data.length),
    };
    const {
        width,
        height,
        data: sourceData,
    } = source;
    const {
        width: kernelWidth,
        height: kernelHeight,
        anchorX,
        anchorY,
        weights,
    } = kernel;
    const outputData = outputBuffer.data;
    const rowStride = width * RGBA_CHANNEL_COUNT;

    // Boundary handling factorizes by axis. Resolve it once for every
    // (output coordinate, kernel coordinate) pair, then reuse the resulting
    // byte offsets for every pixel and channel accumulation.
    const horizontalOffsets = new Uint32Array(
        width * kernelWidth,
    );
    const verticalOffsets = new Uint32Array(
        height * kernelHeight,
    );

    for (let x = 0; x < width; x += 1) {
        const lookupOffset = x * kernelWidth;

        for (let kx = 0; kx < kernelWidth; kx += 1) {
            const sampleX = clamp(
                x + kx - anchorX,
                0,
                width - 1,
            );

            horizontalOffsets[lookupOffset + kx] =
                sampleX * RGBA_CHANNEL_COUNT;
        }
    }

    for (let y = 0; y < height; y += 1) {
        const lookupOffset = y * kernelHeight;

        for (let ky = 0; ky < kernelHeight; ky += 1) {
            const sampleY = clamp(
                y + ky - anchorY,
                0,
                height - 1,
            );

            verticalOffsets[lookupOffset + ky] =
                sampleY * rowStride;
        }
    }

    // Packed RGBA output is sequential in the chosen y, x iteration order.
    let outputOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const verticalLookupOffset = y * kernelHeight;

        for (let x = 0; x < width; x += 1) {
            const horizontalLookupOffset = x * kernelWidth;
            let redAccumulator = 0;
            let greenAccumulator = 0;
            let blueAccumulator = 0;
            let alphaAccumulator = 0;

            for (let ky = 0; ky < kernelHeight; ky += 1) {
                const sourceRowOffset =
                    verticalOffsets[verticalLookupOffset + ky]!;
                const kernelRowOffset = ky * kernelWidth;

                for (let kx = 0; kx < kernelWidth; kx += 1) {
                    const sourceOffset =
                        sourceRowOffset +
                        horizontalOffsets[
                            horizontalLookupOffset + kx
                        ]!;
                    const weight =
                        weights[kernelRowOffset + kx]!;

                    redAccumulator +=
                        weight * sourceData[sourceOffset]!;
                    greenAccumulator +=
                        weight * sourceData[sourceOffset + 1]!;
                    blueAccumulator +=
                        weight * sourceData[sourceOffset + 2]!;
                    alphaAccumulator +=
                        weight * sourceData[sourceOffset + 3]!;
                }
            }

            outputData[outputOffset] =
                Math.round(redAccumulator);
            outputData[outputOffset + 1] =
                Math.round(greenAccumulator);
            outputData[outputOffset + 2] =
                Math.round(blueAccumulator);
            outputData[outputOffset + 3] =
                Math.round(alphaAccumulator);
            outputOffset += RGBA_CHANNEL_COUNT;
        }
    }

    return outputBuffer;
}
