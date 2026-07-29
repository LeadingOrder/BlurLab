import { clamp } from "../boundary";
import { assertValidKernel, type Kernel } from "../kernel";
import { assertValidPixelBuffer, pixelCoordinateToOffset, type PixelBuffer } from "../pixelBuffer";

export function applyKernel(
    source: PixelBuffer,
    kernel: Kernel,
): PixelBuffer {
    assertValidKernel(kernel)
    assertValidPixelBuffer(source)

    const outputBuffer: PixelBuffer = {
        ...source,
        data: new Uint8ClampedArray(source.data.length),
    }

    for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {

            let Ra: number = 0;
            let Ga: number = 0;
            let Ba: number = 0;
            let Aa: number = 0;

            for (let ky = 0; ky < kernel.height; ky += 1) {
                const sy = clamp(y + ky - kernel.anchorY, 0, source.height - 1);
                for (let kx = 0; kx < kernel.width; kx += 1) {
                    const sx = clamp(x + kx - kernel.anchorX, 0, source.width - 1);
                    const pixelOffset = pixelCoordinateToOffset(source, { x: sx, y: sy });
                    const R: number = source.data[pixelOffset]!;
                    const G: number = source.data[pixelOffset + 1]!;
                    const B: number = source.data[pixelOffset + 2]!;
                    const A: number = source.data[pixelOffset + 3]!;
                    const kw = kernel.weights[ky * kernel.width + kx]!;
                    Ra += kw * R;
                    Ga += kw * G;
                    Ba += kw * B;
                    Aa += kw * A;
                }
            }
            const outputOffset = pixelCoordinateToOffset(source, { x, y });
            outputBuffer.data[outputOffset] = Math.round(Ra);
            outputBuffer.data[outputOffset + 1] = Math.round(Ga);
            outputBuffer.data[outputOffset + 2] = Math.round(Ba);
            outputBuffer.data[outputOffset + 3] = Math.round(Aa);

        }

    }
    return outputBuffer
}
