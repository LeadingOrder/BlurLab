import type {
    Kernel,
    PixelBuffer,
    SpectrumAnalysisResult,
} from "@blurlab/engine";

export type FourierWorkerRequest =
    | {
        type: "set-source";
        requestId: number;
        sourceRevision: number;
        source: PixelBuffer;
        maximumDimension: number;
    }
    | {
        type: "analyze-kernel";
        requestId: number;
        sourceRevision: number;
        kernel: Kernel;
        decibelFloor: number;
    };

export type FourierWorkerResponse =
    | {
        ok: true;
        requestId: number;
        result: SpectrumAnalysisResult;
    }
    | {
        ok: false;
        requestId: number;
        message: string;
    };
