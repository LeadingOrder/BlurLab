import type { Kernel } from "@blurlab/engine";

export const CUSTOM_KERNEL_SIZES = [3, 5, 7] as const;

export type CustomKernelSize =
    (typeof CUSTOM_KERNEL_SIZES)[number];

export type CustomKernelDraft = {
    size: CustomKernelSize;
    weights: string[];
};

export type ParsedCustomKernelDraft =
    | {
        ok: true;
        kernel: Kernel;
        sum: number;
    }
    | {
        ok: false;
        message: string;
    };

export const CUSTOM_KERNEL_ZERO_TOLERANCE = 1e-12;

export function createIdentityCustomKernelDraft(
    size: CustomKernelSize,
): CustomKernelDraft {
    const centerIndex = Math.floor(size * size / 2);

    return {
        size,
        weights: Array.from(
            { length: size * size },
            (_, index) => index === centerIndex ? "1" : "0",
        ),
    };
}

export function parseCustomKernelDraft(
    draft: CustomKernelDraft,
): ParsedCustomKernelDraft {
    const expectedWeightCount = draft.size * draft.size;

    if (draft.weights.length !== expectedWeightCount) {
        return {
            ok: false,
            message: `Expected ${expectedWeightCount} weights.`,
        };
    }

    const weights = new Float64Array(expectedWeightCount);
    let sum = 0;

    for (let index = 0; index < draft.weights.length; index += 1) {
        const source = draft.weights[index]!.trim();
        const weight = source === "" ? Number.NaN : Number(source);

        if (!Number.isFinite(weight)) {
            const row = Math.floor(index / draft.size) + 1;
            const column = index % draft.size + 1;

            return {
                ok: false,
                message: `Row ${row}, column ${column} must be a finite number.`,
            };
        }

        weights[index] = weight;
        sum += weight;
    }

    const anchor = Math.floor(draft.size / 2);

    return {
        ok: true,
        kernel: {
            width: draft.size,
            height: draft.size,
            anchorX: anchor,
            anchorY: anchor,
            weights,
        },
        sum,
    };
}

function formatDraftWeight(weight: number): string {
    const rounded = Number(weight.toPrecision(12));

    return Object.is(rounded, -0) ? "0" : rounded.toString();
}

export function normalizeCustomKernelDraft(
    draft: CustomKernelDraft,
): CustomKernelDraft | null {
    const parsed = parseCustomKernelDraft(draft);

    if (
        !parsed.ok ||
        Math.abs(parsed.sum) <= CUSTOM_KERNEL_ZERO_TOLERANCE
    ) {
        return null;
    }

    return {
        size: draft.size,
        weights: [...parsed.kernel.weights].map((weight) =>
            formatDraftWeight(weight / parsed.sum),
        ),
    };
}
