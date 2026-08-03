import { describe, expect, it } from "vitest";

import {
    createIdentityCustomKernelDraft,
    normalizeCustomKernelDraft,
    parseCustomKernelDraft,
} from "../src/customKernel";

describe("custom kernel drafts", () => {
    it("creates a centered identity kernel for each supported size", () => {
        const parsed = parseCustomKernelDraft(
            createIdentityCustomKernelDraft(5),
        );

        expect(parsed.ok).toBe(true);

        if (!parsed.ok) {
            return;
        }

        expect(parsed.kernel).toMatchObject({
            width: 5,
            height: 5,
            anchorX: 2,
            anchorY: 2,
        });
        expect(parsed.kernel.weights[12]).toBe(1);
        expect(parsed.sum).toBe(1);
    });

    it("accepts arbitrary finite real weights", () => {
        const draft = createIdentityCustomKernelDraft(3);

        draft.weights = [
            "0", "-1", "0",
            "-1", "4", "-1",
            "0", "-1", "0",
        ];

        const parsed = parseCustomKernelDraft(draft);

        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.sum).toBe(0);
        }
    });

    it.each(["", "not-a-number", "Infinity", "NaN"])(
        "rejects the invalid weight %s",
        (invalidWeight) => {
            const draft = createIdentityCustomKernelDraft(3);

            draft.weights[0] = invalidWeight;

            expect(parseCustomKernelDraft(draft)).toMatchObject({
                ok: false,
            });
        },
    );

    it("normalizes a non-zero-sum draft", () => {
        const draft = createIdentityCustomKernelDraft(3);

        draft.weights.fill("1");

        const normalized = normalizeCustomKernelDraft(draft);

        expect(normalized).not.toBeNull();
        if (normalized !== null) {
            const parsed = parseCustomKernelDraft(normalized);

            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.sum).toBeCloseTo(1);
            }
        }
    });

    it("keeps a normalized 7 by 7 draft within display tolerance", () => {
        const draft = createIdentityCustomKernelDraft(7);

        draft.weights.fill("1");

        const normalized = normalizeCustomKernelDraft(draft);

        expect(normalized).not.toBeNull();
        if (normalized !== null) {
            const parsed = parseCustomKernelDraft(normalized);

            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(Math.abs(parsed.sum - 1)).toBeLessThanOrEqual(1e-9);
            }
        }
    });

    it("does not normalize a zero-sum draft", () => {
        const draft = createIdentityCustomKernelDraft(3);

        draft.weights = [
            "0", "-1", "0",
            "-1", "4", "-1",
            "0", "-1", "0",
        ];

        expect(normalizeCustomKernelDraft(draft)).toBeNull();
    });
});
