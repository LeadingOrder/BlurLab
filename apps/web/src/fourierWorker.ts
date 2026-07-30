/// <reference lib="webworker" />

import { analyzeSpectrum } from "@blurlab/engine";

import type {
    FourierWorkerRequest,
    FourierWorkerResponse,
} from "./fourierWorkerProtocol";

const workerScope =
    self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = (
    event: MessageEvent<FourierWorkerRequest>,
) => {
    try {
        const result = analyzeSpectrum(event.data);
        const response: FourierWorkerResponse = {
            ok: true,
            result,
        };

        workerScope.postMessage(
            response,
            [
                result.angularFrequencies.buffer,
                result.inputDecibels.buffer,
                result.kernelDecibels.buffer,
                result.outputDecibels.buffer,
            ],
        );
    } catch (error) {
        const response: FourierWorkerResponse = {
            ok: false,
            message:
                error instanceof Error
                    ? error.message
                    : "The spectrum analysis failed.",
        };

        workerScope.postMessage(response);
    }
};

export {};
