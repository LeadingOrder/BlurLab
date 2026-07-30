import type { TeachingPatternId } from "@blurlab/engine";

export type TeachingSourceDefinition = {
    id: TeachingPatternId;
    label: string;
    detail: string;
};

export const teachingSources: readonly TeachingSourceDefinition[] = [
    {
        id: "edge",
        label: "Hard edge",
        detail: "one discontinuity",
    },
    {
        id: "vertical-stripes",
        label: "Vertical stripes",
        detail: "horizontal frequency",
    },
    {
        id: "horizontal-stripes",
        label: "Horizontal stripes",
        detail: "vertical frequency",
    },
    {
        id: "checkerboard",
        label: "Checkerboard",
        detail: "two-axis detail",
    },
    {
        id: "impulse",
        label: "Impulse",
        detail: "flat input spectrum",
    },
    {
        id: "composite",
        label: "Teaching target",
        detail: "mixed structures",
    },
];
