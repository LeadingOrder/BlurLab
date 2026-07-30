import type { Kernel } from "./kernel";
import type {
    PixelBuffer,
    PixelCoordinate,
} from "./pixelBuffer";

export type FourierScopeMode =
    | "global"
    | "local";

export type SpectrumWindow =
    | "none"
    | "hann";

export type SpectrumAnalysisRequest = {
    source: PixelBuffer;
    result: PixelBuffer;
    kernel: Kernel;
    mode: FourierScopeMode;
    center: PixelCoordinate | null;
    localSize: number;
    maximumBinCount: number;
    decibelFloor: number;
};

export type SpectrumAnalysisResult = {
    mode: FourierScopeMode;
    sampleWidth: number;
    sampleHeight: number;
    center: PixelCoordinate | null;
    window: SpectrumWindow;
    boundary: "circular";
    angularFrequencies: Float64Array;
    inputDecibels: Float64Array;
    kernelDecibels: Float64Array;
    outputDecibels: Float64Array;
};

/**
 * Keep this false until analyzeSpectrum satisfies the contract below.
 * The web layer uses it to avoid copying full image buffers into a worker that
 * cannot produce a spectrum yet.
 */
export const SPECTRUM_IMPLEMENTATION_READY = false;

/**
 * Teaching implementation slot.
 *
 * Contract:
 * - return samples ordered from negative to positive horizontal frequency;
 * - use actual DFT-bin angular frequencies in [-π, π);
 * - keep all four output arrays at the same non-zero length;
 * - normalize X and Y to the same input DC reference;
 * - express H relative to its DC gain;
 * - clamp decibel values to request.decibelFloor;
 * - use the circular boundary model when extracting local coordinates;
 * - use no window globally and a two-dimensional Hann window locally.
 */
export function analyzeSpectrum(
    request: SpectrumAnalysisRequest,
): SpectrumAnalysisResult {
    throw new Error(
        "analyzeSpectrum is ready for its numerical implementation.",
    );
    assertValidPixelBuffer(request.source);
    assertValidPixelBuffer(request.result);
    assertValidKernel(request.kernel);
}
