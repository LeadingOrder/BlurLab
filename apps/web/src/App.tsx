import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from "react";

import {
    boxBlur3x3Kernel,
    horizontalNeighbourBlurKernel,
    type Kernel,
    type PixelBuffer,
} from "@blurlab/engine";

import styles from "./App.module.css";
import type {
    BlurWorkerRequest,
    BlurWorkerResponse,
} from "./blurWorkerProtocol";
import {
    decodeImageFile,
    pixelBufferToCanvas,
} from "./imagePipeline";

type MobilePanel = "blur" | "kernel" | "pixels" | "fourier";
type BlurPresetId = "neighbour" | "box";

type ImageMetadata = {
    name: string;
    width: number;
    height: number;
    size: number;
};

type BlurPreset = {
    id: BlurPresetId;
    label: string;
    kernel: Kernel;
    direction: string;
    description: string;
};

const presets: readonly BlurPreset[] = [
    {
        id: "neighbour",
        label: "Neighbour",
        kernel: horizontalNeighbourBlurKernel,
        direction: "Horizontal",
        description: "Each output mixes one pixel with its right-hand neighbour.",
    },
    {
        id: "box",
        label: "Box",
        kernel: boxBlur3x3Kernel,
        direction: "Both axes",
        description: "Each output is the equal-weight average of a 3 × 3 neighbourhood.",
    },
];

function getPreset(id: BlurPresetId): BlurPreset {
    return presets.find((preset) => preset.id === id)!;
}

const mobilePanels: {
    id: MobilePanel;
    label: string;
    index: string;
}[] = [
        { id: "blur", label: "Blur", index: "01" },
        { id: "kernel", label: "Kernel", index: "02" },
        { id: "pixels", label: "Pixels", index: "03" },
        { id: "fourier", label: "Fourier", index: "04" },
    ];

function PanelHeading({
    eyebrow,
    title,
    accent,
    aside,
}: {
    eyebrow: string;
    title: string;
    accent: "primary" | "spatial" | "pixel" | "frequency";
    aside?: ReactNode;
}) {
    return (
        <header className={styles.panelHeading}>
            <div>
                <p
                    className={styles.eyebrow}
                    data-accent={accent}
                >
                    {eyebrow}
                </p>
                <h2>{title}</h2>
            </div>
            {aside}
        </header>
    );
}

function TopBar({
    hasImage,
    onOpenImage,
    onReset,
}: {
    hasImage: boolean;
    onOpenImage: () => void;
    onReset: () => void;
}) {
    return (
        <header className={styles.topBar}>
            <div className={styles.brand}>
                <span className={styles.brandMark} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </span>
                <div>
                    <strong>Blur Lab</strong>
                    <span>by Leading Order</span>
                </div>
            </div>

            <div className={styles.topBarActions}>
                <span className={styles.localBadge}>
                    <span aria-hidden="true" />
                    Local only
                </span>
                <button
                    className={styles.resetButton}
                    type="button"
                    disabled={!hasImage}
                    onClick={onReset}
                >
                    Reset
                </button>
                <button
                    className={styles.openButton}
                    type="button"
                    onClick={onOpenImage}
                >
                    <span aria-hidden="true">＋</span>
                    Open image
                </button>
            </div>
        </header>
    );
}

function drawFittedComparison(
    canvas: HTMLCanvasElement,
    originalRaster: HTMLCanvasElement,
    resultRaster: HTMLCanvasElement,
    dividerPercentage: number,
) {
    const bounds = canvas.parentElement?.getBoundingClientRect();

    if (bounds === undefined || bounds.width === 0 || bounds.height === 0) {
        return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");

    if (context === null) {
        return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const inset = Math.min(40, width * 0.06, height * 0.06);
    const scale = Math.min(
        (width - inset * 2) / originalRaster.width,
        (height - inset * 2) / originalRaster.height,
    );
    const renderedWidth = originalRaster.width * scale;
    const renderedHeight = originalRaster.height * scale;
    const x = (width - renderedWidth) / 2;
    const y = (height - renderedHeight) / 2;

    context.drawImage(
        originalRaster,
        x,
        y,
        renderedWidth,
        renderedHeight,
    );

    const dividerX = width * dividerPercentage / 100;

    context.save();
    context.beginPath();
    context.rect(
        dividerX,
        0,
        width - dividerX,
        height,
    );
    context.clip();
    context.drawImage(
        resultRaster,
        x,
        y,
        renderedWidth,
        renderedHeight,
    );
    context.restore();
}

function clearCanvas(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");

    if (context !== null) {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function ImageStage({
    sourceBuffer,
    resultBuffer,
    metadata,
    loadError,
    isProcessing,
    processingError,
    processingLabel,
    onOpenImage,
}: {
    sourceBuffer: PixelBuffer | null;
    resultBuffer: PixelBuffer | null;
    metadata: ImageMetadata | null;
    loadError: boolean;
    isProcessing: boolean;
    processingError: string | null;
    processingLabel: string;
    onOpenImage: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const originalRasterRef = useRef<HTMLCanvasElement | null>(null);
    const resultRasterRef = useRef<HTMLCanvasElement | null>(null);
    const dividerPercentageRef = useRef(50);
    const [dividerPercentage, setDividerPercentage] = useState(50);

    const drawCurrentComparison = useCallback(() => {
        const canvas = canvasRef.current;
        const originalRaster = originalRasterRef.current;
        const resultRaster = resultRasterRef.current;

        if (
            canvas === null ||
            originalRaster === null ||
            resultRaster === null
        ) {
            return;
        }

        drawFittedComparison(
            canvas,
            originalRaster,
            resultRaster,
            dividerPercentageRef.current,
        );
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (canvas === null) {
            return;
        }

        if (sourceBuffer === null) {
            originalRasterRef.current = null;
            resultRasterRef.current = null;
            clearCanvas(canvas);
            return;
        }

        const originalRaster = pixelBufferToCanvas(sourceBuffer);

        originalRasterRef.current = originalRaster;
        resultRasterRef.current =
            resultBuffer === null
                ? originalRaster
                : pixelBufferToCanvas(resultBuffer);
        drawCurrentComparison();
    }, [drawCurrentComparison, resultBuffer, sourceBuffer]);

    useEffect(() => {
        dividerPercentageRef.current = dividerPercentage;
        drawCurrentComparison();
    }, [dividerPercentage, drawCurrentComparison]);

    useEffect(() => {
        const container = canvasRef.current?.parentElement;

        if (container === null || container === undefined) {
            return;
        }

        const observer = new ResizeObserver(drawCurrentComparison);

        observer.observe(container);
        return () => observer.disconnect();
    }, [drawCurrentComparison]);

    const hasImage = sourceBuffer !== null && metadata !== null;
    const sizeInMegabytes =
        metadata === null
            ? null
            : `${(metadata.size / 1_000_000).toFixed(1)} MB`;

    const updateDividerFromPointer = (
        event: PointerEvent<HTMLDivElement>,
    ) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const percentage =
            100 * (event.clientX - bounds.left) / bounds.width;

        setDividerPercentage(
            Math.min(100, Math.max(0, percentage)),
        );
    };

    const handleDividerPointerDown = (
        event: PointerEvent<HTMLDivElement>,
    ) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateDividerFromPointer(event);
    };

    const handleDividerPointerMove = (
        event: PointerEvent<HTMLDivElement>,
    ) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateDividerFromPointer(event);
        }
    };

    const handleDividerKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
    ) => {
        const step = event.shiftKey ? 10 : 2;

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            setDividerPercentage((value) => Math.max(0, value - step));
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setDividerPercentage((value) => Math.min(100, value + step));
        } else if (event.key === "Home") {
            event.preventDefault();
            setDividerPercentage(0);
        } else if (event.key === "End") {
            event.preventDefault();
            setDividerPercentage(100);
        }
    };

    return (
        <section
            className={styles.imageStage}
            aria-labelledby="stage-title"
            data-has-image={hasImage}
        >
            <div className={styles.stageToolbar}>
                <div>
                    <span className={styles.liveDot} aria-hidden="true" />
                    <span id="stage-title">
                        {metadata?.name ?? "Image stage"}
                    </span>
                </div>
                <div className={styles.comparisonMode}>
                    <span>Original</span>
                    <span aria-hidden="true">↔</span>
                    <span>Result</span>
                </div>
                <span className={styles.zoomReadout}>
                    {hasImage ? "Fit" : "100%"}
                </span>
            </div>

            <div className={styles.stageCanvas}>
                <canvas
                    ref={canvasRef}
                    className={styles.sourceCanvas}
                    aria-label={
                        hasImage
                            ? `Original and filtered comparison: ${metadata.name}`
                            : "No image loaded"
                    }
                />

                {hasImage && isProcessing && (
                    <div
                        className={styles.processingOverlay}
                        role="status"
                        aria-live="polite"
                    >
                        <span
                            className={styles.processingSweep}
                            aria-hidden="true"
                        />
                        <div className={styles.processingStatus}>
                            <span aria-hidden="true" />
                            Applying {processingLabel} kernel
                        </div>
                    </div>
                )}

                {hasImage && processingError !== null && (
                    <div
                        className={styles.processingError}
                        role="alert"
                    >
                        {processingError}
                    </div>
                )}

                {hasImage && resultBuffer !== null && (
                    <div
                        className={styles.comparisonSlider}
                        style={
                            {
                                "--divider-position": `${dividerPercentage}%`,
                            } as CSSProperties
                        }
                        role="slider"
                        tabIndex={0}
                        aria-label="Original and result comparison"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(dividerPercentage)}
                        aria-valuetext={`${Math.round(dividerPercentage)} percent original`}
                        onPointerDown={handleDividerPointerDown}
                        onPointerMove={handleDividerPointerMove}
                        onKeyDown={handleDividerKeyDown}
                    >
                        <span className={styles.originalLabel}>Original</span>
                        <span className={styles.resultLabel}>Result</span>
                        <span
                            className={styles.comparisonDivider}
                            aria-hidden="true"
                        >
                            <span>‹</span>
                            <span>›</span>
                        </span>
                    </div>
                )}

                {!hasImage && (
                    <div className={styles.stageAxes} aria-hidden="true">
                        <span className={styles.axisX}>x</span>
                        <span className={styles.axisY}>y</span>
                    </div>
                )}

                {!hasImage && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyGlyph} aria-hidden="true">
                            <span />
                        </div>
                        <p className={styles.emptyKicker}>
                            {loadError ? "Unsupported image" : "Start with a source"}
                        </p>
                        <h1>
                            {loadError
                                ? "That image could not be decoded."
                                : "See what blur does to every pixel."}
                        </h1>
                        <p>
                            {loadError
                                ? "Try a PNG, JPEG, WebP, or another browser-supported format."
                                : "Choose a local image to inspect it in space and frequency. Nothing leaves your browser."}
                        </p>
                        <button
                            className={styles.stageOpenButton}
                            type="button"
                            onClick={onOpenImage}
                        >
                            {loadError ? "Choose another image" : "Open an image"}
                        </button>
                    </div>
                )}

                <div className={styles.coordinateReadout}>
                    {metadata === null ? (
                        <>
                            <span>x —</span>
                            <span>y —</span>
                            <span>RGBA —</span>
                        </>
                    ) : (
                        <>
                            <span>{metadata.width} × {metadata.height}</span>
                            <span>{sizeInMegabytes}</span>
                            <span>
                                {isProcessing
                                    ? "kernel · running"
                                    : "compare · canvas"}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

function BlurPanel({
    selectedPreset,
    onSelectPreset,
    boxRadius,
    onBoxRadiusChange,
}: {
    selectedPreset: BlurPreset;
    onSelectPreset: (preset: BlurPreset) => void;
    boxRadius: number;
    onBoxRadiusChange: (radius: number) => void;
}) {
    return (
        <section className={`${styles.panel} ${styles.blurPanel}`}>
            <PanelHeading
                eyebrow="Spatial operation"
                title="Blur"
                accent="primary"
                aside={<span className={styles.stepBadge}>1 / 5</span>}
            />

            <div className={styles.presetList} aria-label="Blur presets">
                {presets.map((preset, index) => (
                    <button
                        key={preset.id}
                        className={styles.preset}
                        type="button"
                        data-selected={preset.id === selectedPreset.id}
                        aria-pressed={preset.id === selectedPreset.id}
                        onClick={() => onSelectPreset(preset)}
                    >
                        <span>{String(index).padStart(2, "0")}</span>
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

            <div className={styles.parameterBlock}>
                <div className={styles.parameterLabel}>
                    <div>
                        <span>Direction</span>
                        <strong>{selectedPreset.direction}</strong>
                    </div>
                    <span className={styles.valuePill}>
                        {selectedPreset.id === "neighbour"
                            ? "x-axis"
                            : "x · y"}
                    </span>
                </div>
                {selectedPreset.id === "neighbour" && (
                    <div className={styles.segmentedControl}>
                        <button type="button" data-active="true">
                            Horizontal
                        </button>
                        <button type="button" disabled>
                            Vertical
                        </button>
                    </div>
                )}
                {selectedPreset.id === "box" && (
                    <div className={styles.radiusControl}>
                        <div className={styles.radiusReadout}>
                            <span>Target radius</span>
                            <strong>{boxRadius} px</strong>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={boxRadius}
                            aria-label="Target box blur radius in source pixels"
                            onChange={(event) => {
                                onBoxRadiusChange(
                                    Number(event.currentTarget.value),
                                );
                            }}
                        />
                        <div className={styles.radiusScale} aria-hidden="true">
                            <span>1 px</span>
                            <span>100 px</span>
                        </div>
                        <p className={styles.pendingParameter}>
                            Control state ready · engine remains at radius 1
                            until its kernel factory is connected.
                        </p>
                    </div>
                )}
            </div>

            <FormulaCard preset={selectedPreset} />
            <KernelSummary kernel={selectedPreset.kernel} />
        </section>
    );
}

function FormulaCard({
    preset,
}: {
    preset: BlurPreset;
}) {
    return (
        <div className={styles.formulaCard}>
            <div className={styles.formulaHeader}>
                <span>Formula</span>
                <span>normalized</span>
            </div>
            <div
                className={styles.formula}
                aria-label={`${preset.label} kernel formula`}
            >
                {preset.id === "neighbour" && (
                    <>
                        <i>y</i><sub>i,j</sub>
                        <span>=</span>
                        <span className={styles.fraction}>
                            <span>
                                <i>x</i><sub>i,j</sub> + <i>x</i><sub>i+1,j</sub>
                            </span>
                            <span>2</span>
                        </span>
                    </>
                )}
                {preset.id === "box" && (
                    <>
                        <i>y</i><sub>i,j</sub>
                        <span>=</span>
                        <span>⅑ ∑<sub>m,n=-1</sub><sup>1</sup></span>
                        <i>x</i><sub>i+m,j+n</sub>
                    </>
                )}
            </div>
            <p>{preset.description}</p>
        </div>
    );
}

function formatWeight(weight: number): string {
    return Number.isInteger(weight)
        ? weight.toFixed(0)
        : weight.toFixed(3).replace(/0+$/, "");
}

function KernelSummary({
    kernel,
}: {
    kernel: Kernel;
}) {
    const weightSum = kernel.weights.reduce(
        (sum, weight) => sum + weight,
        0,
    );

    return (
        <div className={styles.kernelSummary}>
            <div>
                <span>Kernel</span>
                <strong>
                    {kernel.height} × {kernel.width}
                    {" · "}
                    sum {weightSum.toFixed(2)}
                </strong>
            </div>
            <div
                className={styles.kernelSummaryMatrix}
                style={{
                    gridTemplateColumns: `repeat(${kernel.width}, 34px)`,
                }}
            >
                {[...kernel.weights].map((weight, index) => (
                    <span key={index}>{formatWeight(weight)}</span>
                ))}
            </div>
        </div>
    );
}

function PixelPanel() {
    const cells = Array.from({ length: 25 }, (_, index) => index);

    return (
        <section className={`${styles.panel} ${styles.pixelPanel}`}>
            <PanelHeading
                eyebrow="Exact samples"
                title="Pixel microscope"
                accent="pixel"
                aside={<span className={styles.coordinate}>x — · y —</span>}
            />

            <div className={styles.microscopeBody}>
                <div className={styles.pixelGrid} aria-label="Pixel grid preview">
                    {cells.map((cell) => (
                        <span
                            key={cell}
                            className={styles.pixelCell}
                            data-center={cell === 12}
                        />
                    ))}
                </div>
                <div className={styles.sampleData}>
                    <span>Selected pixel</span>
                    <strong>RGBA unavailable</strong>
                    <dl>
                        <div>
                            <dt>Source</dt>
                            <dd>—</dd>
                        </div>
                        <div>
                            <dt>Result</dt>
                            <dd>—</dd>
                        </div>
                        <div>
                            <dt>Scale</dt>
                            <dd>16×</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </section>
    );
}

function KernelPanel({
    kernel,
}: {
    kernel: Kernel;
}) {
    const weightSum = kernel.weights.reduce(
        (sum, weight) => sum + weight,
        0,
    );

    return (
        <section className={styles.kernelPanelContent}>
            <PanelHeading
                eyebrow="Local weights"
                title="Kernel"
                accent="spatial"
                aside={
                    <span className={styles.dimension}>
                        {kernel.height} × {kernel.width}
                    </span>
                }
            />
            <div className={styles.kernelBody}>
                <div
                    className={styles.kernelMatrix}
                    aria-label={`${kernel.height} by ${kernel.width} kernel weights`}
                    style={{
                        gridTemplateColumns: `repeat(${kernel.width}, 1fr)`,
                    }}
                >
                    {[...kernel.weights].map((weight, index) => (
                        <span key={index}>{formatWeight(weight)}</span>
                    ))}
                </div>
                <dl className={styles.kernelProperties}>
                    <div>
                        <dt>Sum</dt>
                        <dd>{weightSum.toFixed(2)}</dd>
                    </div>
                    <div>
                        <dt>Symmetric</dt>
                        <dd>Yes</dd>
                    </div>
                    <div>
                        <dt>Separable</dt>
                        <dd>Yes</dd>
                    </div>
                </dl>
            </div>
        </section>
    );
}

const plotSeries = [
    {
        label: "Input · X",
        detail: "source spectrum",
        color: "#7c5cff",
        values: [0.15, 0.24, 0.37, 0.58, 0.82, 0.95, 0.82, 0.58, 0.37, 0.24, 0.15],
    },
    {
        label: "Kernel · H",
        detail: "transfer function",
        color: "#ff3bd4",
        values: [0.06, 0.12, 0.24, 0.48, 0.82, 1, 0.82, 0.48, 0.24, 0.12, 0.06],
    },
    {
        label: "Output · Y",
        detail: "filtered spectrum",
        color: "#2eebff",
        values: [0.02, 0.06, 0.15, 0.37, 0.7, 0.95, 0.7, 0.37, 0.15, 0.06, 0.02],
    },
] as const;

function drawFrequencyPlot(canvas: HTMLCanvasElement) {
    const bounds = canvas.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) {
        return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    const context = canvas.getContext("2d");

    if (context === null) {
        return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const left = 34;
    const right = 14;
    const top = 18;
    const bottom = 28;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    context.strokeStyle = "rgba(255, 255, 255, 0.075)";
    context.lineWidth = 1;

    for (let index = 0; index <= 4; index += 1) {
        const y = top + (plotHeight * index) / 4;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
    }

    for (let index = 0; index <= 6; index += 1) {
        const x = left + (plotWidth * index) / 6;
        context.beginPath();
        context.moveTo(x, top);
        context.lineTo(x, height - bottom);
        context.stroke();
    }

    context.fillStyle = "rgba(162, 164, 178, 0.72)";
    context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.fillText("−π", left, height - 9);
    context.fillText("0", left + plotWidth / 2, height - 9);
    context.fillText("+π", width - right, height - 9);

    plotSeries.forEach((series) => {
        context.save();
        context.strokeStyle = series.color;
        context.lineWidth = 2;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.shadowColor = series.color;
        context.shadowBlur = 13;
        context.beginPath();

        series.values.forEach((value, index) => {
            const x =
                left +
                (plotWidth * index) / (series.values.length - 1);
            const y = top + plotHeight * (1 - value);

            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });

        context.stroke();
        context.restore();
    });
}

function FrequencyPlot() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (canvas === null) {
            return;
        }

        const draw = () => drawFrequencyPlot(canvas);
        const observer = new ResizeObserver(draw);

        observer.observe(canvas);
        draw();
        return () => observer.disconnect();
    }, []);

    return (
        <div className={styles.frequencyPlot}>
            <canvas
                ref={canvasRef}
                aria-label="Combined preview of input spectrum, kernel transfer function, and output spectrum"
            />
            <div className={styles.frequencyAxisLabel}>spatial frequency</div>
        </div>
    );
}

function FourierPanel() {
    return (
        <section className={styles.fourierPanelContent}>
            <PanelHeading
                eyebrow="Frequency response"
                title="Fourier scope"
                accent="frequency"
                aside={<span className={styles.equationBadge}>X × H = Y</span>}
            />
            <div className={styles.fourierLegend}>
                {plotSeries.map((series) => (
                    <div key={series.label}>
                        <span
                            style={
                                {
                                    "--series-color": series.color,
                                } as CSSProperties
                            }
                            aria-hidden="true"
                        />
                        <p>
                            <strong>{series.label}</strong>
                            <span>{series.detail}</span>
                        </p>
                    </div>
                ))}
            </div>
            <FrequencyPlot />
            <div className={styles.previewNotice}>
                <span>Structural preview</span>
                <p>
                    Live spectra begin with the canonical pixel buffer.
                </p>
            </div>
        </section>
    );
}

function MobileInspector({
    activePanel,
    selectedPreset,
    onSelectPreset,
    boxRadius,
    onBoxRadiusChange,
}: {
    activePanel: MobilePanel;
    selectedPreset: BlurPreset;
    onSelectPreset: (preset: BlurPreset) => void;
    boxRadius: number;
    onBoxRadiusChange: (radius: number) => void;
}) {
    return (
        <div className={styles.mobileInspector}>
            {activePanel === "blur" && (
                <BlurPanel
                    selectedPreset={selectedPreset}
                    onSelectPreset={onSelectPreset}
                    boxRadius={boxRadius}
                    onBoxRadiusChange={onBoxRadiusChange}
                />
            )}
            {activePanel === "kernel" && (
                <section className={`${styles.panel} ${styles.kernelPanel}`}>
                    <KernelPanel kernel={selectedPreset.kernel} />
                </section>
            )}
            {activePanel === "pixels" && <PixelPanel />}
            {activePanel === "fourier" && (
                <section className={`${styles.panel} ${styles.fourierPanel}`}>
                    <FourierPanel />
                </section>
            )}
        </div>
    );
}

function MobileNavigation({
    activePanel,
    onChange,
}: {
    activePanel: MobilePanel;
    onChange: (panel: MobilePanel) => void;
}) {
    return (
        <nav className={styles.mobileNavigation} aria-label="Inspector panels">
            {mobilePanels.map((panel) => (
                <button
                    key={panel.id}
                    type="button"
                    data-selected={activePanel === panel.id}
                    aria-pressed={activePanel === panel.id}
                    onClick={() => onChange(panel.id)}
                >
                    <span>{panel.index}</span>
                    {panel.label}
                </button>
            ))}
        </nav>
    );
}

function App() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeMobilePanel, setActiveMobilePanel] =
        useState<MobilePanel>("blur");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [sourceBuffer, setSourceBuffer] =
        useState<PixelBuffer | null>(null);
    const [metadata, setMetadata] =
        useState<ImageMetadata | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [resultBuffer, setResultBuffer] =
        useState<PixelBuffer | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingError, setProcessingError] =
        useState<string | null>(null);
    const [selectedPresetId, setSelectedPresetId] =
        useState<BlurPresetId>("neighbour");
    const [boxRadius, setBoxRadius] = useState(1);

    const selectedPreset = getPreset(selectedPresetId);

    useEffect(() => {
        if (sourceBuffer === null) {
            return;
        }

        let ignoreResult = false;
        const worker = new Worker(
            new URL("./blurWorker.ts", import.meta.url),
            { type: "module" },
        );
        const workerSource: PixelBuffer = {
            ...sourceBuffer,
            data: sourceBuffer.data.slice(),
        };
        const workerKernel: Kernel = {
            ...selectedPreset.kernel,
            weights: selectedPreset.kernel.weights.slice(),
        };
        const request: BlurWorkerRequest = {
            source: workerSource,
            kernel: workerKernel,
        };

        worker.onmessage = (
            event: MessageEvent<BlurWorkerResponse>,
        ) => {
            if (ignoreResult) {
                return;
            }

            if (event.data.ok) {
                setResultBuffer(event.data.result);
            } else {
                setProcessingError(event.data.message);
            }

            setIsProcessing(false);
            worker.terminate();
        };

        worker.onerror = () => {
            if (ignoreResult) {
                return;
            }

            setProcessingError(
                "The blur worker stopped before producing a result.",
            );
            setIsProcessing(false);
            worker.terminate();
        };

        worker.postMessage(
            request,
            [
                workerSource.data.buffer as ArrayBuffer,
                workerKernel.weights.buffer as ArrayBuffer,
            ],
        );

        return () => {
            ignoreResult = true;
            worker.terminate();
        };
    }, [selectedPreset, sourceBuffer]);

    useEffect(() => {
        if (imageFile === null) {
            return;
        }

        let ignoreResult = false;

        void decodeImageFile(imageFile)
            .then((buffer) => {
                if (ignoreResult) {
                    return;
                }

                setResultBuffer(null);
                setProcessingError(null);
                setIsProcessing(true);
                setSourceBuffer(buffer);
                setMetadata({
                    name: imageFile.name,
                    width: buffer.width,
                    height: buffer.height,
                    size: imageFile.size,
                });
            })
            .catch(() => {
                if (ignoreResult) {
                    return;
                }

                setSourceBuffer(null);
                setMetadata(null);
                setLoadError(true);
            });

        return () => {
            ignoreResult = true;
        };
    }, [imageFile]);

    const openImagePicker = () => fileInputRef.current?.click();

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextFile = event.currentTarget.files?.[0] ?? null;

        setSourceBuffer(null);
        setResultBuffer(null);
        setMetadata(null);
        setLoadError(false);
        setProcessingError(null);
        setIsProcessing(false);
        setImageFile(nextFile);
        event.currentTarget.value = "";
    };

    const resetImage = () => {
        setImageFile(null);
        setSourceBuffer(null);
        setResultBuffer(null);
        setMetadata(null);
        setLoadError(false);
        setProcessingError(null);
        setIsProcessing(false);
    };

    const selectPreset = (preset: BlurPreset) => {
        if (preset.id === selectedPresetId) {
            return;
        }

        setResultBuffer(null);
        setProcessingError(null);
        setIsProcessing(sourceBuffer !== null);
        setSelectedPresetId(preset.id);
    };

    return (
        <div className={styles.app}>
            <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                aria-label="Choose a local image"
            />
            <TopBar
                hasImage={sourceBuffer !== null}
                onOpenImage={openImagePicker}
                onReset={resetImage}
            />
            <main className={styles.workspace}>
                <ImageStage
                    sourceBuffer={sourceBuffer}
                    resultBuffer={resultBuffer}
                    metadata={metadata}
                    loadError={loadError}
                    isProcessing={isProcessing}
                    processingError={processingError}
                    processingLabel={selectedPreset.label}
                    onOpenImage={openImagePicker}
                />
                <div className={styles.desktopControls}>
                    <BlurPanel
                        selectedPreset={selectedPreset}
                        onSelectPreset={selectPreset}
                        boxRadius={boxRadius}
                        onBoxRadiusChange={setBoxRadius}
                    />
                </div>
                <div className={styles.desktopPixel}>
                    <PixelPanel />
                </div>
                <div className={styles.desktopFourier}>
                    <section className={`${styles.panel} ${styles.fourierPanel}`}>
                        <FourierPanel />
                    </section>
                </div>
                <MobileInspector
                    activePanel={activeMobilePanel}
                    selectedPreset={selectedPreset}
                    onSelectPreset={selectPreset}
                    boxRadius={boxRadius}
                    onBoxRadiusChange={setBoxRadius}
                />
            </main>
            <MobileNavigation
                activePanel={activeMobilePanel}
                onChange={setActiveMobilePanel}
            />
        </div>
    );
}

export default App;
