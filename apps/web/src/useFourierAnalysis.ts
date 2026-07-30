import {
    useEffect,
    useRef,
    useState,
} from "react";

import type {
    Kernel,
    PixelBuffer,
    SpectrumAnalysisResult,
} from "@blurlab/engine";

import type {
    FourierWorkerRequest,
    FourierWorkerResponse,
} from "./fourierWorkerProtocol";

const MAXIMUM_SPECTRUM_DIMENSION = 256;
const DECIBEL_FLOOR = -60;

export type FourierAnalysisStatus =
    | "empty"
    | "analyzing"
    | "ready"
    | "error";

type FourierJob = {
    requestId: number;
    source: PixelBuffer;
    kernel: Kernel;
};

type FourierOutcome =
    | {
        job: FourierJob;
        ok: true;
        analysis: SpectrumAnalysisResult;
    }
    | {
        job: FourierJob;
        ok: false;
        error: string;
    };

export function useFourierAnalysis({
    sourceBuffer,
    kernel,
}: {
    sourceBuffer: PixelBuffer | null;
    kernel: Kernel;
}): {
    analysis: SpectrumAnalysisResult | null;
    status: FourierAnalysisStatus;
    error: string | null;
} {
    const [outcome, setOutcome] =
        useState<FourierOutcome | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const lastSourceRef =
        useRef<PixelBuffer | null>(null);
    const sourceRevisionRef = useRef(0);
    const requestIdRef = useRef(0);
    const latestJobRef = useRef<FourierJob | null>(null);

    useEffect(() => {
        const worker = new Worker(
            new URL("./fourierWorker.ts", import.meta.url),
            { type: "module" },
        );

        workerRef.current = worker;
        worker.onmessage = (
            event: MessageEvent<FourierWorkerResponse>,
        ) => {
            const latestJob = latestJobRef.current;

            if (
                latestJob === null ||
                event.data.requestId !==
                    latestJob.requestId
            ) {
                return;
            }

            if (event.data.ok) {
                setOutcome({
                    job: latestJob,
                    ok: true,
                    analysis: event.data.result,
                });
            } else {
                setOutcome({
                    job: latestJob,
                    ok: false,
                    error: event.data.message,
                });
            }
        };
        worker.onerror = () => {
            const latestJob = latestJobRef.current;

            if (latestJob === null) {
                return;
            }

            setOutcome({
                job: latestJob,
                ok: false,
                error:
                    "The Fourier worker stopped before producing a spectrum.",
            });
        };

        return () => {
            worker.terminate();
            workerRef.current = null;
            lastSourceRef.current = null;
        };
    }, []);

    useEffect(() => {
        const worker = workerRef.current;

        if (sourceBuffer === null) {
            lastSourceRef.current = null;
            latestJobRef.current = null;
            return;
        }

        if (worker === null) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        const job: FourierJob = {
            requestId,
            source: sourceBuffer,
            kernel,
        };

        requestIdRef.current = requestId;
        latestJobRef.current = job;

        if (sourceBuffer !== lastSourceRef.current) {
            const sourceRevision =
                sourceRevisionRef.current + 1;
            const workerSource: PixelBuffer = {
                ...sourceBuffer,
                data: sourceBuffer.data.slice(),
            };
            const sourceRequest: FourierWorkerRequest = {
                type: "set-source",
                requestId,
                sourceRevision,
                source: workerSource,
                maximumDimension:
                    MAXIMUM_SPECTRUM_DIMENSION,
            };

            sourceRevisionRef.current = sourceRevision;
            lastSourceRef.current = sourceBuffer;
            worker.postMessage(
                sourceRequest,
                [
                    workerSource.data.buffer as ArrayBuffer,
                ],
            );
        }

        const workerKernel: Kernel = {
            ...kernel,
            weights: kernel.weights.slice(),
        };
        const analysisRequest: FourierWorkerRequest = {
            type: "analyze-kernel",
            requestId,
            sourceRevision:
                sourceRevisionRef.current,
            kernel: workerKernel,
            decibelFloor: DECIBEL_FLOOR,
        };

        worker.postMessage(
            analysisRequest,
            [
                workerKernel.weights.buffer as ArrayBuffer,
            ],
        );
    }, [kernel, sourceBuffer]);

    if (sourceBuffer === null) {
        return {
            analysis: null,
            status: "empty",
            error: null,
        };
    }

    if (
        outcome === null ||
        outcome.job.source !== sourceBuffer ||
        outcome.job.kernel !== kernel
    ) {
        return {
            analysis: null,
            status: "analyzing",
            error: null,
        };
    }

    if (!outcome.ok) {
        return {
            analysis: null,
            status: "error",
            error: outcome.error,
        };
    }

    return {
        analysis: outcome.analysis,
        status: "ready",
        error: null,
    };
}
