import { useMemo } from "react";
import type { Kernel } from "@blurlab/engine";

import {
    CUSTOM_KERNEL_SIZES,
    CUSTOM_KERNEL_ZERO_TOLERANCE,
    createIdentityCustomKernelDraft,
    normalizeCustomKernelDraft,
    parseCustomKernelDraft,
    type CustomKernelDraft,
} from "./customKernel";
import styles from "./CustomKernelEditor.module.css";

function formatSum(sum: number): string {
    return Number(sum.toPrecision(6)).toString();
}

export function CustomKernelEditor({
    draft,
    onDraftChange,
    onApply,
}: {
    draft: CustomKernelDraft;
    onDraftChange: (draft: CustomKernelDraft) => void;
    onApply: (kernel: Kernel) => void;
}) {
    const parsed = useMemo(
        () => parseCustomKernelDraft(draft),
        [draft],
    );
    const canNormalize =
        parsed.ok &&
        Math.abs(parsed.sum) > CUSTOM_KERNEL_ZERO_TOLERANCE;
    const sumIsOne =
        parsed.ok && Math.abs(parsed.sum - 1) <= 1e-9;
    const sumIsZero =
        parsed.ok &&
        Math.abs(parsed.sum) <= CUSTOM_KERNEL_ZERO_TOLERANCE;

    const updateWeight = (index: number, value: string) => {
        const weights = [...draft.weights];

        weights[index] = value;
        onDraftChange({ ...draft, weights });
    };

    return (
        <div className={styles.editor}>
            <div className={styles.toolbar}>
                <div
                    className={styles.sizeControl}
                    role="group"
                    aria-label="Custom kernel size"
                >
                    {CUSTOM_KERNEL_SIZES.map((size) => (
                        <button
                            key={size}
                            type="button"
                            data-active={draft.size === size}
                            aria-pressed={draft.size === size}
                            onClick={() => {
                                if (size !== draft.size) {
                                    onDraftChange(
                                        createIdentityCustomKernelDraft(size),
                                    );
                                }
                            }}
                        >
                            {size}×{size}
                        </button>
                    ))}
                </div>
                <span>centre anchor</span>
            </div>

            <div
                className={styles.matrix}
                style={{
                    gridTemplateColumns: `repeat(${draft.size}, minmax(34px, 1fr))`,
                }}
                aria-label={`${draft.size} by ${draft.size} editable custom kernel`}
            >
                {draft.weights.map((weight, index) => {
                    const row = Math.floor(index / draft.size) + 1;
                    const column = index % draft.size + 1;
                    const anchor = Math.floor(draft.size / 2) + 1;

                    return (
                        <input
                            key={`${draft.size}-${index}`}
                            type="text"
                            inputMode="decimal"
                            value={weight}
                            data-anchor={row === anchor && column === anchor}
                            aria-label={`Kernel weight row ${row}, column ${column}`}
                            onChange={(event) => {
                                updateWeight(
                                    index,
                                    event.currentTarget.value,
                                );
                            }}
                        />
                    );
                })}
            </div>

            <div
                className={styles.status}
                data-valid={parsed.ok}
                role="status"
            >
                {parsed.ok ? (
                    <>
                        <strong>sum {formatSum(parsed.sum)}</strong>
                        <span>
                            {sumIsOne
                                ? "brightness preserving"
                                : sumIsZero
                                  ? "zero-sum response"
                                  : "brightness will change"}
                        </span>
                    </>
                ) : (
                    <span>{parsed.message}</span>
                )}
            </div>

            <div className={styles.actions}>
                <button
                    type="button"
                    onClick={() => {
                        onDraftChange(
                            createIdentityCustomKernelDraft(draft.size),
                        );
                    }}
                >
                    Reset
                </button>
                <button
                    type="button"
                    disabled={!canNormalize}
                    onClick={() => {
                        const normalized =
                            normalizeCustomKernelDraft(draft);

                        if (normalized !== null) {
                            onDraftChange(normalized);
                        }
                    }}
                >
                    Normalize
                </button>
                <button
                    className={styles.applyButton}
                    type="button"
                    disabled={!parsed.ok}
                    onClick={() => {
                        if (parsed.ok) {
                            onApply(parsed.kernel);
                        }
                    }}
                >
                    Apply kernel
                </button>
            </div>
            <p className={styles.commitNote}>
                Draft edits affect the image only after Apply.
            </p>
        </div>
    );
}
