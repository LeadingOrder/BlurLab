/// <reference lib="webworker" />

import { applyKernel } from "@blurlab/engine";

import type {
    BlurWorkerRequest,
    BlurWorkerResponse,
} from "./blurWorkerProtocol";

const workerScope =
    self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = (
    event: MessageEvent<BlurWorkerRequest>,
) => {
    try {
        const result = applyKernel(
            event.data.source,
            event.data.kernel,
        );
        const response: BlurWorkerResponse = {
            ok: true,
            result,
        };

        workerScope.postMessage(
            response,
            [result.data.buffer as ArrayBuffer],
        );
    } catch (error) {
        const response: BlurWorkerResponse = {
            ok: false,
            message:
                error instanceof Error
                    ? error.message
                    : "The blur operation failed.",
        };

        workerScope.postMessage(response);
    }
};

export {};
