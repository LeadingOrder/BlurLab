import type { PixelBuffer } from "@blurlab/engine";

export const MAX_WORKING_PIXEL_COUNT =
    1920 * 1080;

export type DecodedImage = {
    buffer: PixelBuffer;
    sourceWidth: number;
    sourceHeight: number;
};

function calculateWorkingDimensions(
    sourceWidth: number,
    sourceHeight: number,
): {
    width: number;
    height: number;
} {
    const sourcePixelCount =
        sourceWidth * sourceHeight;

    if (sourcePixelCount <= MAX_WORKING_PIXEL_COUNT) {
        return {
            width: sourceWidth,
            height: sourceHeight,
        };
    }

    const scale = Math.sqrt(
        MAX_WORKING_PIXEL_COUNT / sourcePixelCount,
    );

    return {
        width: Math.max(1, Math.floor(sourceWidth * scale)),
        height: Math.max(1, Math.floor(sourceHeight * scale)),
    };
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(
            new Error("The selected file could not be decoded as an image."),
        );
        image.src = sourceUrl;
    });
}

function getCanvasContext(
    canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
    const context = canvas.getContext("2d");

    if (context === null) {
        throw new Error("A two-dimensional canvas context is unavailable.");
    }

    return context;
}

export async function decodeImageFile(
    file: File,
): Promise<DecodedImage> {
    const sourceUrl = URL.createObjectURL(file);

    try {
        const image = await loadImage(sourceUrl);
        const canvas = document.createElement("canvas");
        const workingDimensions = calculateWorkingDimensions(
            image.naturalWidth,
            image.naturalHeight,
        );

        canvas.width = workingDimensions.width;
        canvas.height = workingDimensions.height;

        const context = getCanvasContext(canvas);

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
        );

        return {
            buffer: {
                width: imageData.width,
                height: imageData.height,
                data: imageData.data,
            },
            sourceWidth: image.naturalWidth,
            sourceHeight: image.naturalHeight,
        };
    } finally {
        URL.revokeObjectURL(sourceUrl);
    }
}

export function pixelBufferToCanvas(
    buffer: PixelBuffer,
): HTMLCanvasElement {
    const canvas = document.createElement("canvas");

    canvas.width = buffer.width;
    canvas.height = buffer.height;

    const context = getCanvasContext(canvas);
    const canvasData = new Uint8ClampedArray(
        buffer.data.buffer as ArrayBuffer,
        buffer.data.byteOffset,
        buffer.data.length,
    );
    const imageData = new ImageData(
        canvasData,
        buffer.width,
        buffer.height,
    );

    context.putImageData(imageData, 0, 0);

    return canvas;
}
