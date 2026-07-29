/**
 * Public boundary of @blurlab/engine.
 *
 * Export numerical concepts from here only after their contracts and tests
 * exist. Keeping this file explicit prevents internal helpers from becoming
 * accidental public API.
 */
export {
    boxBlur3x3Kernel,
    horizontalNeighbourBlurKernel,
    identityKernel,
} from "./blurKernels";
export {
    assertValidKernel,
    type Kernel,
} from "./kernel";
export {
    assertValidPixelBuffer,
    type PixelBuffer,
} from "./pixelBuffer";
export { applyKernel } from "./transforms/applyKernel";
