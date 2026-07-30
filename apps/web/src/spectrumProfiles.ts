export type SpectrumAxis = "x" | "y";

export type SpectrumCoordinate = {
    x: number;
    y: number;
};

export type SpectrumZoom = 1 | 2 | 4;

export type SpectrumViewport = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export function createSpectrumViewport(
    width: number,
    height: number,
    center: SpectrumCoordinate,
    zoom: SpectrumZoom,
): SpectrumViewport {
    const viewportWidth = Math.max(
        1,
        Math.floor(width / zoom),
    );
    const viewportHeight = Math.max(
        1,
        Math.floor(height / zoom),
    );

    return {
        x: Math.min(
            width - viewportWidth,
            Math.max(
                0,
                Math.floor(center.x - viewportWidth / 2),
            ),
        ),
        y: Math.min(
            height - viewportHeight,
            Math.max(
                0,
                Math.floor(center.y - viewportHeight / 2),
            ),
        ),
        width: viewportWidth,
        height: viewportHeight,
    };
}

export function spectrumViewportContains(
    viewport: SpectrumViewport,
    coordinate: SpectrumCoordinate,
): boolean {
    return (
        coordinate.x >= viewport.x &&
        coordinate.x < viewport.x + viewport.width &&
        coordinate.y >= viewport.y &&
        coordinate.y < viewport.y + viewport.height
    );
}

export function spectrumCoordinateAtViewportPosition(
    viewport: SpectrumViewport,
    horizontalPosition: number,
    verticalPosition: number,
): SpectrumCoordinate {
    const displayX = Math.min(
        viewport.width - 1,
        Math.max(
            0,
            Math.floor(horizontalPosition * viewport.width),
        ),
    );
    const displayY = Math.min(
        viewport.height - 1,
        Math.max(
            0,
            Math.floor(verticalPosition * viewport.height),
        ),
    );

    return {
        x: viewport.x + displayX,
        y:
            viewport.y +
            viewport.height -
            displayY -
            1,
    };
}

export function spectrumCoordinatePositionInViewport(
    viewport: SpectrumViewport,
    coordinate: SpectrumCoordinate,
): {
    x: number;
    y: number;
} {
    return {
        x:
            (coordinate.x - viewport.x + 0.5) /
            viewport.width,
        y:
            (
                viewport.y +
                viewport.height -
                coordinate.y -
                0.5
            ) /
            viewport.height,
    };
}

export function spectrumSliceLength(
    axis: SpectrumAxis,
    width: number,
    height: number,
): number {
    return axis === "x" ? width : height;
}

export function spectrumSliceValue(
    values: Float32Array,
    width: number,
    coordinate: SpectrumCoordinate,
    axis: SpectrumAxis,
    index: number,
): number {
    const offset =
        axis === "x"
            ? coordinate.y * width + index
            : index * width + coordinate.x;

    return values[offset]!;
}

export function normalizedAngularFrequency(
    coordinate: number,
    dimension: number,
): number {
    return 2 * (coordinate - dimension / 2) / dimension;
}

export function frequencyLabel(
    coordinate: number,
    dimension: number,
): string {
    const value = normalizedAngularFrequency(
        coordinate,
        dimension,
    );

    if (Math.abs(value) < 0.005) {
        return "0";
    }

    const sign = value < 0 ? "−" : "+";

    return `${sign}${Math.abs(value).toFixed(2)}π`;
}

export function decibelLabel(value: number): string {
    const normalized =
        Math.abs(value) < 0.05 ? 0 : value;

    return `${normalized.toFixed(1).replace("-", "−")} dB`;
}
