import type { PixelBuffer } from "@blurlab/engine";

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
): Promise<PixelBuffer> {
    const sourceUrl = URL.createObjectURL(file);

    try {
        const image = await loadImage(sourceUrl);
        const canvas = document.createElement("canvas");

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = getCanvasContext(canvas);

        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
        );

        return {
            width: imageData.width,
            height: imageData.height,
            data: imageData.data,
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
    const imageData = context.createImageData(
        buffer.width,
        buffer.height,
    );

    imageData.data.set(buffer.data);
    context.putImageData(imageData, 0, 0);

    return canvas;
}
