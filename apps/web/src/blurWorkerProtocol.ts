import type {
    Kernel,
    PixelBuffer,
} from "@blurlab/engine";

export type BlurWorkerRequest = {
    source: PixelBuffer;
    kernel: Kernel;
};

export type BlurWorkerResponse =
    | {
        ok: true;
        result: PixelBuffer;
    }
    | {
        ok: false;
        message: string;
    };
