import type { Kernel } from "@blurlab/engine";

import styles from "./App.module.css";
import {
    BLUR_RADIUS_RANGE,
    GAUSSIAN_SIGMA_RANGE,
    blurPresets,
    type BlurPreset,
} from "./blurPresets";

type SharedBlurControlProps = {
    selectedPreset: BlurPreset;
    blurRadius: number;
    onBlurRadiusChange: (radius: number) => void;
    gaussianSigma: number;
    onGaussianSigmaChange: (sigma: number) => void;
    onEditCustomKernel?: () => void;
};

export function BlurPresetSelector({
    selectedPreset,
    onSelectPreset,
    compact = false,
}: {
    selectedPreset: BlurPreset;
    onSelectPreset: (preset: BlurPreset) => void;
    compact?: boolean;
}) {
    return (
        <div
            className={compact
                ? styles.presentationPresetList
                : styles.presetList}
            aria-label="Blur presets"
        >
            {blurPresets.map((preset, index) => (
                <button
                    key={preset.id}
                    className={compact
                        ? styles.presentationPreset
                        : styles.preset}
                    type="button"
                    data-selected={preset.id === selectedPreset.id}
                    aria-pressed={preset.id === selectedPreset.id}
                    onClick={() => onSelectPreset(preset)}
                >
                    {!compact && (
                        <span>{String(index).padStart(2, "0")}</span>
                    )}
                    <strong>{preset.label}</strong>
                    {preset.id === selectedPreset.id && (
                        <span
                            className={styles.selectedDot}
                            aria-hidden="true"
                        />
                    )}
                </button>
            ))}
        </div>
    );
}

export function BlurParameterControl({
    selectedPreset,
    blurRadius,
    onBlurRadiusChange,
    gaussianSigma,
    onGaussianSigmaChange,
    onEditCustomKernel,
    compact = false,
}: SharedBlurControlProps & {
    compact?: boolean;
}) {
    const controlClassName = compact
        ? `${styles.radiusControl} ${styles.presentationRadiusControl}`
        : styles.radiusControl;

    if (selectedPreset.parameter === "radius") {
        return (
            <div className={controlClassName}>
                <div className={styles.radiusReadout}>
                    <span>Target radius</span>
                    <strong>{blurRadius} px</strong>
                </div>
                <input
                    type="range"
                    min={BLUR_RADIUS_RANGE.min}
                    max={BLUR_RADIUS_RANGE.max}
                    step={BLUR_RADIUS_RANGE.step}
                    value={blurRadius}
                    aria-label={`Target ${selectedPreset.label.toLowerCase()} blur radius in source pixels`}
                    onChange={(event) => {
                        onBlurRadiusChange(
                            Number(event.currentTarget.value),
                        );
                    }}
                />
                {!compact && (
                    <div className={styles.radiusScale} aria-hidden="true">
                        <span>{BLUR_RADIUS_RANGE.min} px</span>
                        <span>{BLUR_RADIUS_RANGE.max} px</span>
                    </div>
                )}
            </div>
        );
    }

    if (selectedPreset.parameter === "sigma") {
        return (
            <div className={controlClassName}>
                <div className={styles.radiusReadout}>
                    <span>Gaussian spread</span>
                    <strong>σ {gaussianSigma.toFixed(1)}</strong>
                </div>
                <input
                    type="range"
                    min={GAUSSIAN_SIGMA_RANGE.min}
                    max={GAUSSIAN_SIGMA_RANGE.max}
                    step={GAUSSIAN_SIGMA_RANGE.step}
                    value={gaussianSigma}
                    aria-label="Gaussian blur sigma in source pixels"
                    onChange={(event) => {
                        onGaussianSigmaChange(
                            Number(event.currentTarget.value),
                        );
                    }}
                />
                {!compact && (
                    <div className={styles.radiusScale} aria-hidden="true">
                        <span>σ {GAUSSIAN_SIGMA_RANGE.min.toFixed(1)}</span>
                        <span>σ {GAUSSIAN_SIGMA_RANGE.max.toFixed(1)}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={compact
                ? styles.presentationCustomControl
                : styles.customKernelControl}
        >
            {!compact && (
                <p>
                    Edit finite real weights on a centred odd grid,
                    then apply them as one kernel.
                </p>
            )}
            {onEditCustomKernel !== undefined && (
                <button
                    type="button"
                    onClick={onEditCustomKernel}
                >
                    Edit custom kernel
                </button>
            )}
        </div>
    );
}

export function PresentationBlurControls({
    selectedPreset,
    kernel,
    onSelectPreset,
    blurRadius,
    onBlurRadiusChange,
    gaussianSigma,
    onGaussianSigmaChange,
    onEditCustomKernel,
    isProcessing,
}: SharedBlurControlProps & {
    kernel: Kernel;
    onSelectPreset: (preset: BlurPreset) => void;
    onEditCustomKernel: () => void;
    isProcessing: boolean;
}) {
    return (
        <section
            className={styles.presentationBlurControls}
            aria-label="Presentation blur controls"
        >
            <BlurPresetSelector
                selectedPreset={selectedPreset}
                onSelectPreset={onSelectPreset}
                compact
            />
            <div className={styles.presentationParameterBlock}>
                <div className={styles.presentationParameterHeading}>
                    <span>{selectedPreset.direction}</span>
                    <strong>
                        {selectedPreset.id === "custom"
                            ? `${kernel.width} × ${kernel.height} kernel`
                            : selectedPreset.label}
                    </strong>
                </div>
                <BlurParameterControl
                    selectedPreset={selectedPreset}
                    blurRadius={blurRadius}
                    onBlurRadiusChange={onBlurRadiusChange}
                    gaussianSigma={gaussianSigma}
                    onGaussianSigmaChange={onGaussianSigmaChange}
                    onEditCustomKernel={onEditCustomKernel}
                    compact
                />
                <span
                    className={styles.presentationProcessingStatus}
                    data-processing={isProcessing}
                    role="status"
                    aria-live="polite"
                >
                    {isProcessing ? "Updating output" : "Output ready"}
                </span>
            </div>
        </section>
    );
}
