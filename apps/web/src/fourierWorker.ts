/// <reference lib="webworker" />

import {
    analyzePreparedSpectrum,
    prepareSpectrumSource,
    type PreparedSpectrumSource,
} from "@blurlab/engine";

import type {
    FourierWorkerRequest,
    FourierWorkerResponse,
} from "./fourierWorkerProtocol";

const workerScope =
    self as unknown as DedicatedWorkerGlobalScope;

let preparedSource: PreparedSpectrumSource | null = null;
let preparedSourceRevision = -1;

workerScope.onmessage = (
    event: MessageEvent<FourierWorkerRequest>,
) => {
    const request = event.data;

    try {
        if (request.type === "set-source") {
            preparedSource = prepareSpectrumSource(
                request.source,
                request.maximumDimension,
            );
            preparedSourceRevision =
                request.sourceRevision;
            return;
        }

        if (
            preparedSource === null ||
            preparedSourceRevision !==
                request.sourceRevision
        ) {
            throw new Error(
                "The Fourier source changed before analysis could begin.",
            );
        }

        const result = analyzePreparedSpectrum(
            preparedSource,
            request.kernel,
            request.decibelFloor,
        );
        const response: FourierWorkerResponse = {
            ok: true,
            requestId: request.requestId,
            result,
        };

        workerScope.postMessage(
            response,
            [
                result.inputDecibels.buffer,
                result.kernelDecibels.buffer,
                result.outputDecibels.buffer,
            ],
        );
    } catch (error) {
        const response: FourierWorkerResponse = {
            ok: false,
            requestId: request.requestId,
            message:
                error instanceof Error
                    ? error.message
                    : "The spectrum analysis failed.",
        };

        workerScope.postMessage(response);
    }
};

export {};
