export type Kernel = {
    width: number;
    height: number;
    anchorX: number;
    anchorY: number;
    weights: Float64Array;
}

export function assertValidKernel(
    kernel: Kernel,
): void {
    if (
        !Number.isInteger(kernel.width) ||
        !Number.isInteger(kernel.height) ||
        kernel.width <= 0 ||
        kernel.height <= 0
    ) {
        throw new RangeError(
            "Kernel dimensions must be positive integers.",
        );
    }

    if (
        !Number.isInteger(kernel.anchorX) ||
        !Number.isInteger(kernel.anchorY) ||
        kernel.anchorX > kernel.width - 1 ||
        kernel.anchorY > kernel.height - 1 ||
        kernel.anchorX < 0 ||
        kernel.anchorY < 0
    ) {
        throw new RangeError(
            "Kernel anchors must be positive integers and be less than width / height.",
        );
    }

    if (
        kernel.weights.length !== kernel.width * kernel.height
    ) {
        throw new RangeError(
            "Kernel dimensions must match width / height fields."
        )
    }

    for (const weight of kernel.weights) {
        if (!Number.isFinite(weight)) {
            throw new RangeError(
                "Kernel weights must be finite real numbers.",
            );
        }
    }
}
