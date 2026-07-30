/**
 * Public boundary of @blurlab/engine.
 *
 * Export numerical concepts from here only after their contracts and tests
 * exist. Keeping this file explicit prevents internal helpers from becoming
 * accidental public API.
 */
export {
    boxBlur3x3Kernel,
    createHorizontalNeighbourBlurKernel,
    horizontalNeighbourBlurKernel,
    identityKernel,
    createBoxBlurKernel,
} from "./blurKernels";
export {
    assertValidKernel,
    type Kernel,
} from "./kernel";
export {
    assertValidPixelBuffer,
    pixelCoordinateToOffset,
    type PixelCoordinate,
    type PixelBuffer,
} from "./pixelBuffer";
export {
    createTeachingPattern,
    DEFAULT_TEACHING_PATTERN_SIZE,
    TEACHING_PATTERN_IDS,
    type TeachingPatternId,
} from "./teachingPatterns";
export { applyKernel } from "./transforms/applyKernel";
export {
    analyzeSpectrum,
    analyzePreparedSpectrum,
    prepareSpectrumSource,
    type PreparedSpectrumSource,
    type SpectrumAnalysisRequest,
    type SpectrumAnalysisResult,
} from "./spectrum";
