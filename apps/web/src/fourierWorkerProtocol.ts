import type {
    SpectrumAnalysisRequest,
    SpectrumAnalysisResult,
} from "@blurlab/engine";

export type FourierWorkerRequest =
    SpectrumAnalysisRequest;

export type FourierWorkerResponse =
    | {
        ok: true;
        result: SpectrumAnalysisResult;
    }
    | {
        ok: false;
        message: string;
    };
