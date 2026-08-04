export type BlurPresetId =
    | "neighbour"
    | "box"
    | "gaussian"
    | "custom";

export type BlurPreset = {
    id: BlurPresetId;
    label: string;
    parameter: "radius" | "sigma" | "custom";
    direction: string;
    description: string;
};

export const BLUR_RADIUS_RANGE = {
    min: 1,
    max: 12,
    step: 1,
} as const;

export const GAUSSIAN_SIGMA_RANGE = {
    min: 0.5,
    max: 4,
    step: 0.1,
} as const;

export const blurPresets: readonly BlurPreset[] = [
    {
        id: "neighbour",
        label: "Neighbour",
        parameter: "radius",
        direction: "Horizontal",
        description: "Each output averages the current pixel with its right-hand neighbours.",
    },
    {
        id: "box",
        label: "Box",
        parameter: "radius",
        direction: "Both axes",
        description: "Each output is the equal-weight average of a square neighbourhood.",
    },
    {
        id: "gaussian",
        label: "Gaussian",
        parameter: "sigma",
        direction: "Both axes",
        description: "Nearby pixels contribute more strongly according to their Gaussian distance from the centre.",
    },
    {
        id: "custom",
        label: "Custom",
        parameter: "custom",
        direction: "User-defined",
        description: "Each output is the weighted sum defined by the editable custom kernel.",
    },
];

export function getBlurPreset(id: BlurPresetId): BlurPreset {
    const preset = blurPresets.find(
        (candidate) => candidate.id === id,
    );

    if (preset === undefined) {
        throw new Error(`Unknown blur preset: ${id}`);
    }

    return preset;
}
