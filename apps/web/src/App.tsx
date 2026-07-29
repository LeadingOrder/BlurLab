import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from "react";

import {
    createBoxBlurKernel,
    createHorizontalNeighbourBlurKernel,
    pixelCoordinateToOffset,
    type Kernel,
    type PixelCoordinate,
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
    sourceWidth: number;
    sourceHeight: number;
    size: number;
};

type FittedImageRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
};

type BlurPreset = {
    id: BlurPresetId;
    label: string;
    createKernel: (radius: number) => Kernel;
    direction: string;
    description: string;
};

const MICROSCOPE_RADIUS = 5;
const MICROSCOPE_SIDE_LENGTH =
    2 * MICROSCOPE_RADIUS + 1;

const presets: readonly BlurPreset[] = [
    {
        id: "neighbour",
        label: "Neighbour",
        createKernel: createHorizontalNeighbourBlurKernel,
        direction: "Horizontal",
        description: "Each output averages the current pixel with its right-hand neighbours.",
    },
    {
        id: "box",
        label: "Box",
        createKernel: createBoxBlurKernel,
        direction: "Both axes",
        description: "Each output is the equal-weight average of a square neighbourhood.",
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

function calculateFittedImageRect(
    viewportWidth: number,
    viewportHeight: number,
    imageWidth: number,
    imageHeight: number,
): FittedImageRect {
    const inset = Math.min(
        40,
        viewportWidth * 0.06,
        viewportHeight * 0.06,
    );
    const scale = Math.min(
        (viewportWidth - inset * 2) / imageWidth,
        (viewportHeight - inset * 2) / imageHeight,
    );
    const width = imageWidth * scale;
    const height = imageHeight * scale;

    return {
        x: (viewportWidth - width) / 2,
        y: (viewportHeight - height) / 2,
        width,
        height,
        scale,
    };
}

function clampMicroscopeCenter(
    coordinate: PixelCoordinate,
    buffer: PixelBuffer,
): PixelCoordinate {
    const minX =
        buffer.width >= MICROSCOPE_SIDE_LENGTH
            ? MICROSCOPE_RADIUS
            : 0;
    const minY =
        buffer.height >= MICROSCOPE_SIDE_LENGTH
            ? MICROSCOPE_RADIUS
            : 0;
    const maxX =
        buffer.width >= MICROSCOPE_SIDE_LENGTH
            ? buffer.width - MICROSCOPE_RADIUS - 1
            : buffer.width - 1;
    const maxY =
        buffer.height >= MICROSCOPE_SIDE_LENGTH
            ? buffer.height - MICROSCOPE_RADIUS - 1
            : buffer.height - 1;

    return {
        x: Math.min(maxX, Math.max(minX, coordinate.x)),
        y: Math.min(maxY, Math.max(minY, coordinate.y)),
    };
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

    const imageRect = calculateFittedImageRect(
        width,
        height,
        originalRaster.width,
        originalRaster.height,
    );

    context.drawImage(
        originalRaster,
        imageRect.x,
        imageRect.y,
        imageRect.width,
        imageRect.height,
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
        imageRect.x,
        imageRect.y,
        imageRect.width,
        imageRect.height,
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
    selectedCoordinate,
    onSelectedCoordinateChange,
    metadata,
    loadError,
    isProcessing,
    processingError,
    processingLabel,
    onOpenImage,
}: {
    sourceBuffer: PixelBuffer | null;
    resultBuffer: PixelBuffer | null;
    selectedCoordinate: PixelCoordinate | null;
    onSelectedCoordinateChange: (coordinate: PixelCoordinate) => void;
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
    const [stageSize, setStageSize] = useState({
        width: 0,
        height: 0,
    });

    const fittedImageRect = useMemo(() => {
        if (
            sourceBuffer === null ||
            stageSize.width === 0 ||
            stageSize.height === 0
        ) {
            return null;
        }

        return calculateFittedImageRect(
            stageSize.width,
            stageSize.height,
            sourceBuffer.width,
            sourceBuffer.height,
        );
    }, [sourceBuffer, stageSize]);

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
        resultRasterRef.current = originalRaster;
        drawCurrentComparison();
    }, [drawCurrentComparison, sourceBuffer]);

    useEffect(() => {
        if (sourceBuffer === null) {
            return;
        }

        const originalRaster = originalRasterRef.current;

        if (originalRaster === null) {
            return;
        }

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

        const synchronizeStage = () => {
            const bounds = container.getBoundingClientRect();
            const width = Math.round(bounds.width);
            const height = Math.round(bounds.height);

            setStageSize((currentSize) => (
                currentSize.width === width &&
                currentSize.height === height
                    ? currentSize
                    : { width, height }
            ));
            drawCurrentComparison();
        };
        const observer = new ResizeObserver(synchronizeStage);

        observer.observe(container);
        synchronizeStage();
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
        const bounds =
            event.currentTarget.parentElement?.getBoundingClientRect();

        if (bounds === undefined) {
            return;
        }

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

    const updateSelectionFromPointer = (
        event: PointerEvent<HTMLDivElement>,
    ) => {
        if (sourceBuffer === null) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const imageRect = calculateFittedImageRect(
            bounds.width,
            bounds.height,
            sourceBuffer.width,
            sourceBuffer.height,
        );
        const localX = event.clientX - bounds.left - imageRect.x;
        const localY = event.clientY - bounds.top - imageRect.y;

        if (
            localX < 0 ||
            localY < 0 ||
            localX >= imageRect.width ||
            localY >= imageRect.height
        ) {
            return;
        }

        onSelectedCoordinateChange(
            clampMicroscopeCenter(
                {
                    x: Math.floor(localX / imageRect.scale),
                    y: Math.floor(localY / imageRect.scale),
                },
                sourceBuffer,
            ),
        );
    };

    const handleSelectionPointerDown = (
        event: PointerEvent<HTMLDivElement>,
    ) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateSelectionFromPointer(event);
    };

    const handleSelectionPointerMove = (
        event: PointerEvent<HTMLDivElement>,
    ) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateSelectionFromPointer(event);
        }
    };

    const handleSelectionKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
    ) => {
        if (sourceBuffer === null || selectedCoordinate === null) {
            return;
        }

        const step = event.shiftKey
            ? MICROSCOPE_SIDE_LENGTH
            : 1;
        let nextCoordinate: PixelCoordinate;

        if (event.key === "ArrowLeft") {
            nextCoordinate = {
                ...selectedCoordinate,
                x: selectedCoordinate.x - step,
            };
        } else if (event.key === "ArrowRight") {
            nextCoordinate = {
                ...selectedCoordinate,
                x: selectedCoordinate.x + step,
            };
        } else if (event.key === "ArrowUp") {
            nextCoordinate = {
                ...selectedCoordinate,
                y: selectedCoordinate.y - step,
            };
        } else if (event.key === "ArrowDown") {
            nextCoordinate = {
                ...selectedCoordinate,
                y: selectedCoordinate.y + step,
            };
        } else {
            return;
        }

        event.preventDefault();
        onSelectedCoordinateChange(
            clampMicroscopeCenter(nextCoordinate, sourceBuffer),
        );
    };

    const selectionStyle =
        fittedImageRect === null ||
        selectedCoordinate === null
            ? null
            : {
                left:
                    fittedImageRect.x +
                    (selectedCoordinate.x + 0.5) *
                    fittedImageRect.scale,
                top:
                    fittedImageRect.y +
                    (selectedCoordinate.y + 0.5) *
                    fittedImageRect.scale,
                width: Math.max(
                    30,
                    MICROSCOPE_SIDE_LENGTH *
                    fittedImageRect.scale,
                ),
                height: Math.max(
                    30,
                    MICROSCOPE_SIDE_LENGTH *
                    fittedImageRect.scale,
                ),
            };
    const selectionFootprintSize =
        fittedImageRect === null
            ? 0
            : MICROSCOPE_SIDE_LENGTH * fittedImageRect.scale;

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

                {hasImage && (
                    <div
                        className={styles.selectionSurface}
                        onPointerDown={handleSelectionPointerDown}
                        onPointerMove={handleSelectionPointerMove}
                    />
                )}

                {hasImage &&
                    selectedCoordinate !== null &&
                    selectionStyle !== null && (
                        <div
                            className={styles.selectionReticle}
                            style={selectionStyle}
                            role="region"
                            tabIndex={0}
                            aria-label={`Microscope selection at x ${selectedCoordinate.x}, y ${selectedCoordinate.y}. Use arrow keys to move it.`}
                            onKeyDown={handleSelectionKeyDown}
                        >
                            <span
                                className={styles.selectionFootprint}
                                style={{
                                    width: selectionFootprintSize,
                                    height: selectionFootprintSize,
                                }}
                                aria-hidden="true"
                            />
                            <span aria-hidden="true">
                                {MICROSCOPE_SIDE_LENGTH}×
                                {MICROSCOPE_SIDE_LENGTH}
                            </span>
                        </div>
                    )}

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
                    <>
                        <span className={styles.originalLabel}>Original</span>
                        <span className={styles.resultLabel}>Result</span>
                        <div
                            className={styles.comparisonSlider}
                            style={{ left: `${dividerPercentage}%` }}
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
                            <span
                                className={styles.comparisonDivider}
                                aria-hidden="true"
                            >
                                <span>‹</span>
                                <span>›</span>
                            </span>
                        </div>
                    </>
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
                                {metadata.width !== metadata.sourceWidth ||
                                metadata.height !== metadata.sourceHeight
                                    ? `scaled from ${metadata.sourceWidth} × ${metadata.sourceHeight}`
                                    : isProcessing
                                        ? "kernel · running"
                                        : "native · buffer"}
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
    kernel,
    onSelectPreset,
    blurRadius,
    onBlurRadiusChange,
}: {
    selectedPreset: BlurPreset;
    kernel: Kernel;
    onSelectPreset: (preset: BlurPreset) => void;
    blurRadius: number;
    onBlurRadiusChange: (radius: number) => void;
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
                <div className={styles.radiusControl}>
                    <div className={styles.radiusReadout}>
                        <span>Target radius</span>
                        <strong>{blurRadius} px</strong>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={blurRadius}
                        aria-label={`Target ${selectedPreset.label.toLowerCase()} blur radius in source pixels`}
                        onChange={(event) => {
                            onBlurRadiusChange(
                                Number(event.currentTarget.value),
                            );
                        }}
                    />
                    <div className={styles.radiusScale} aria-hidden="true">
                        <span>1 px</span>
                        <span>12 px</span>
                    </div>
                    <p className={styles.pendingParameter}>
                        Active kernel · {kernel.height} × {kernel.width} ·
                        {" "}{kernel.weights.length} equal weights
                    </p>
                </div>
            </div>

            <FormulaCard
                preset={selectedPreset}
                blurRadius={blurRadius}
            />
            <KernelSummary kernel={kernel} />
        </section>
    );
}

function FormulaCard({
    preset,
    blurRadius,
}: {
    preset: BlurPreset;
    blurRadius: number;
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
                        <span className={styles.mathVariable}>
                            <i>y</i><sub>i,j</sub>
                        </span>
                        <span>=</span>
                        <span className={styles.coefficientFraction}>
                            <span>1</span>
                            <span>{blurRadius + 1}</span>
                        </span>
                        <Summation
                            index="m"
                            lowerBound={0}
                            upperBound={blurRadius}
                        />
                        <span className={styles.mathVariable}>
                            <i>x</i><sub>i+m,j</sub>
                        </span>
                    </>
                )}
                {preset.id === "box" && (
                    <>
                        <span className={styles.mathVariable}>
                            <i>y</i><sub>i,j</sub>
                        </span>
                        <span>=</span>
                        <span className={styles.coefficientFraction}>
                            <span>1</span>
                            <span>{(2 * blurRadius + 1) ** 2}</span>
                        </span>
                        <Summation
                            index="m"
                            lowerBound={-blurRadius}
                            upperBound={blurRadius}
                        />
                        <Summation
                            index="n"
                            lowerBound={-blurRadius}
                            upperBound={blurRadius}
                        />
                        <span className={styles.mathVariable}>
                            <i>x</i><sub>i+m,j+n</sub>
                        </span>
                    </>
                )}
            </div>
            <p>{preset.description}</p>
        </div>
    );
}

function Summation({
    index,
    lowerBound,
    upperBound,
}: {
    index: "m" | "n";
    lowerBound: number;
    upperBound: number;
}) {
    return (
        <span className={styles.summation} aria-hidden="true">
            <span className={styles.summationUpper}>{upperBound}</span>
            <span className={styles.summationSymbol}>∑</span>
            <span className={styles.summationLower}>
                {index}={lowerBound}
            </span>
        </span>
    );
}

function formatWeight(weight: number): string {
    return Number.isInteger(weight)
        ? weight.toFixed(0)
        : Number(weight.toPrecision(4)).toString();
}

function CompactKernelWeight({
    kernel,
}: {
    kernel: Kernel;
}) {
    const weight = kernel.weights[0]!;
    const isNormalizedUniform =
        [...kernel.weights].every(
            (candidate) => candidate === weight,
        ) &&
        Math.abs(weight * kernel.weights.length - 1) <
            Number.EPSILON * kernel.weights.length;

    return (
        <div className={styles.compactKernelWeight}>
            <span>{kernel.weights.length} equal weights</span>
            <strong>
                <i>w</i>
                <span>=</span>
                {isNormalizedUniform && (
                    <span className={styles.compactFraction}>
                        <span>1</span>
                        <span>{kernel.weights.length}</span>
                    </span>
                )}
                <span>≈ {formatWeight(weight)}</span>
            </strong>
        </div>
    );
}

function KernelSummary({
    kernel,
}: {
    kernel: Kernel;
}) {
    const showFullMatrix =
        kernel.width <= 5 &&
        kernel.height <= 5;
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
            {showFullMatrix ? (
                <div
                    className={styles.kernelSummaryMatrix}
                    style={{
                        gridTemplateColumns:
                            `repeat(${kernel.width}, 34px)`,
                    }}
                >
                    {[...kernel.weights].map((weight, index) => (
                        <span key={index}>{formatWeight(weight)}</span>
                    ))}
                </div>
            ) : (
                <CompactKernelWeight kernel={kernel} />
            )}
        </div>
    );
}

type RgbaSample = readonly [
    red: number,
    green: number,
    blue: number,
    alpha: number,
];

type MicroscopeSample = {
    coordinate: PixelCoordinate | null;
    rgba: RgbaSample | null;
    isCenter: boolean;
};

function readPixel(
    buffer: PixelBuffer,
    coordinate: PixelCoordinate,
): RgbaSample {
    const x = Math.min(
        buffer.width - 1,
        Math.max(0, coordinate.x),
    );
    const y = Math.min(
        buffer.height - 1,
        Math.max(0, coordinate.y),
    );
    const offset = pixelCoordinateToOffset(
        buffer,
        { x, y },
    );

    return [
        buffer.data[offset]!,
        buffer.data[offset + 1]!,
        buffer.data[offset + 2]!,
        buffer.data[offset + 3]!,
    ];
}

function createMicroscopeSamples(
    buffer: PixelBuffer | null,
    center: PixelCoordinate | null,
): MicroscopeSample[] {
    return Array.from(
        { length: MICROSCOPE_SIDE_LENGTH ** 2 },
        (_, index) => {
            const localX = index % MICROSCOPE_SIDE_LENGTH;
            const localY = Math.floor(
                index / MICROSCOPE_SIDE_LENGTH,
            );
            const isCenter =
                localX === MICROSCOPE_RADIUS &&
                localY === MICROSCOPE_RADIUS;

            if (buffer === null || center === null) {
                return {
                    coordinate: null,
                    rgba: null,
                    isCenter,
                };
            }

            const coordinate = {
                x: Math.min(
                    buffer.width - 1,
                    Math.max(
                        0,
                        center.x + localX - MICROSCOPE_RADIUS,
                    ),
                ),
                y: Math.min(
                    buffer.height - 1,
                    Math.max(
                        0,
                        center.y + localY - MICROSCOPE_RADIUS,
                    ),
                ),
            };

            return {
                coordinate,
                rgba: readPixel(buffer, coordinate),
                isCenter,
            };
        },
    );
}

function formatRgba(rgba: RgbaSample | null): string {
    return rgba === null
        ? "—"
        : rgba.join(", ");
}

function PixelGrid({
    label,
    buffer,
    center,
}: {
    label: "Original" | "Result";
    buffer: PixelBuffer | null;
    center: PixelCoordinate | null;
}) {
    const samples = useMemo(
        () => createMicroscopeSamples(buffer, center),
        [buffer, center],
    );

    return (
        <div className={styles.pixelGridGroup}>
            <div>
                <strong
                    className={styles.pixelGridLabel}
                    data-result={label === "Result"}
                >
                    {label}
                </strong>
                <span>
                    {buffer === null ? "awaiting pixels" : "RGBA"}
                </span>
            </div>
            <div
                className={styles.pixelGrid}
                style={{
                    gridTemplateColumns:
                        `repeat(${MICROSCOPE_SIDE_LENGTH}, var(--pixel-zoom))`,
                    gridTemplateRows:
                        `repeat(${MICROSCOPE_SIDE_LENGTH}, var(--pixel-zoom))`,
                }}
                aria-label={`${label} ${MICROSCOPE_SIDE_LENGTH} by ${MICROSCOPE_SIDE_LENGTH} pixel grid`}
            >
                {samples.map((sample, index) => (
                    <span
                        key={index}
                        className={styles.pixelCell}
                        data-center={sample.isCenter}
                        data-available={sample.rgba !== null}
                        style={
                            sample.rgba === null
                                ? undefined
                                : {
                                    backgroundColor:
                                        `rgba(${sample.rgba[0]}, ${sample.rgba[1]}, ${sample.rgba[2]}, ${sample.rgba[3] / 255})`,
                                }
                        }
                        title={
                            sample.coordinate === null ||
                            sample.rgba === null
                                ? undefined
                                : `x ${sample.coordinate.x}, y ${sample.coordinate.y} · RGBA ${formatRgba(sample.rgba)}`
                        }
                    />
                ))}
            </div>
        </div>
    );
}

function PixelPanel({
    sourceBuffer,
    resultBuffer,
    selectedCoordinate,
}: {
    sourceBuffer: PixelBuffer | null;
    resultBuffer: PixelBuffer | null;
    selectedCoordinate: PixelCoordinate | null;
}) {
    const selectedSource =
        sourceBuffer === null ||
        selectedCoordinate === null
            ? null
            : readPixel(sourceBuffer, selectedCoordinate);
    const selectedResult =
        resultBuffer === null ||
        selectedCoordinate === null
            ? null
            : readPixel(resultBuffer, selectedCoordinate);

    return (
        <section className={`${styles.panel} ${styles.pixelPanel}`}>
            <PanelHeading
                eyebrow="Exact samples"
                title="Pixel microscope"
                accent="pixel"
                aside={
                    <span className={styles.coordinate}>
                        {selectedCoordinate === null
                            ? "x — · y —"
                            : `x ${selectedCoordinate.x} · y ${selectedCoordinate.y}`}
                    </span>
                }
            />

            <div className={styles.microscopeBody}>
                <div className={styles.pixelComparisons}>
                    <PixelGrid
                        label="Original"
                        buffer={sourceBuffer}
                        center={selectedCoordinate}
                    />
                    <PixelGrid
                        label="Result"
                        buffer={resultBuffer}
                        center={selectedCoordinate}
                    />
                </div>
                <div className={styles.sampleData}>
                    <span>Selected pixel</span>
                    <strong>
                        {selectedCoordinate === null
                            ? "RGBA unavailable"
                            : `x ${selectedCoordinate.x}, y ${selectedCoordinate.y}`}
                    </strong>
                    <dl>
                        <div>
                            <dt>Original</dt>
                            <dd>{formatRgba(selectedSource)}</dd>
                        </div>
                        <div>
                            <dt>Result</dt>
                            <dd>{formatRgba(selectedResult)}</dd>
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
    const showFullMatrix =
        kernel.width <= 5 &&
        kernel.height <= 5;
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
                {showFullMatrix ? (
                    <div
                        className={styles.kernelMatrix}
                        aria-label={`${kernel.height} by ${kernel.width} kernel weights`}
                        style={{
                            gridTemplateColumns:
                                `repeat(${kernel.width}, 1fr)`,
                        }}
                    >
                        {[...kernel.weights].map((weight, index) => (
                            <span key={index}>{formatWeight(weight)}</span>
                        ))}
                    </div>
                ) : (
                    <CompactKernelWeight kernel={kernel} />
                )}
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
    kernel,
    sourceBuffer,
    resultBuffer,
    selectedCoordinate,
    onSelectPreset,
    blurRadius,
    onBlurRadiusChange,
}: {
    activePanel: MobilePanel;
    selectedPreset: BlurPreset;
    kernel: Kernel;
    sourceBuffer: PixelBuffer | null;
    resultBuffer: PixelBuffer | null;
    selectedCoordinate: PixelCoordinate | null;
    onSelectPreset: (preset: BlurPreset) => void;
    blurRadius: number;
    onBlurRadiusChange: (radius: number) => void;
}) {
    return (
        <div className={styles.mobileInspector}>
            {activePanel === "blur" && (
                <BlurPanel
                    selectedPreset={selectedPreset}
                    kernel={kernel}
                    onSelectPreset={onSelectPreset}
                    blurRadius={blurRadius}
                    onBlurRadiusChange={onBlurRadiusChange}
                />
            )}
            {activePanel === "kernel" && (
                <section className={`${styles.panel} ${styles.kernelPanel}`}>
                    <KernelPanel kernel={kernel} />
                </section>
            )}
            {activePanel === "pixels" && (
                <PixelPanel
                    sourceBuffer={sourceBuffer}
                    resultBuffer={resultBuffer}
                    selectedCoordinate={selectedCoordinate}
                />
            )}
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
    const [selectedCoordinate, setSelectedCoordinate] =
        useState<PixelCoordinate | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingError, setProcessingError] =
        useState<string | null>(null);
    const [selectedPresetId, setSelectedPresetId] =
        useState<BlurPresetId>("neighbour");
    const [blurRadius, setBlurRadius] = useState<number>(1);
    const selectedPreset = getPreset(selectedPresetId);
    const selectedKernel = useMemo(
        () => selectedPreset.createKernel(blurRadius),
        [blurRadius, selectedPreset],
    );

    const changeBlurRadius = (radius: number) => {
        if (radius === blurRadius) {
            return;
        }

        setBlurRadius(radius);

        if (sourceBuffer !== null) {
            setResultBuffer(null);
            setProcessingError(null);
            setIsProcessing(true);
        }
    };

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
            ...selectedKernel,
            weights: selectedKernel.weights.slice(),
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
    }, [selectedKernel, sourceBuffer]);

    useEffect(() => {
        if (imageFile === null) {
            return;
        }

        let ignoreResult = false;

        void decodeImageFile(imageFile)
            .then((decodedImage) => {
                if (ignoreResult) {
                    return;
                }

                const { buffer } = decodedImage;

                setResultBuffer(null);
                setProcessingError(null);
                setIsProcessing(true);
                setSourceBuffer(buffer);
                setSelectedCoordinate(
                    clampMicroscopeCenter(
                        {
                            x: Math.floor(buffer.width / 2),
                            y: Math.floor(buffer.height / 2),
                        },
                        buffer,
                    ),
                );
                setMetadata({
                    name: imageFile.name,
                    width: buffer.width,
                    height: buffer.height,
                    sourceWidth: decodedImage.sourceWidth,
                    sourceHeight: decodedImage.sourceHeight,
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
        setSelectedCoordinate(null);
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
        setSelectedCoordinate(null);
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
                    selectedCoordinate={selectedCoordinate}
                    onSelectedCoordinateChange={setSelectedCoordinate}
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
                        kernel={selectedKernel}
                        onSelectPreset={selectPreset}
                        blurRadius={blurRadius}
                        onBlurRadiusChange={changeBlurRadius}
                    />
                </div>
                <div className={styles.desktopPixel}>
                    <PixelPanel
                        sourceBuffer={sourceBuffer}
                        resultBuffer={resultBuffer}
                        selectedCoordinate={selectedCoordinate}
                    />
                </div>
                <div className={styles.desktopFourier}>
                    <section className={`${styles.panel} ${styles.fourierPanel}`}>
                        <FourierPanel />
                    </section>
                </div>
                <MobileInspector
                    activePanel={activeMobilePanel}
                    selectedPreset={selectedPreset}
                    kernel={selectedKernel}
                    sourceBuffer={sourceBuffer}
                    resultBuffer={resultBuffer}
                    selectedCoordinate={selectedCoordinate}
                    onSelectPreset={selectPreset}
                    blurRadius={blurRadius}
                    onBlurRadiusChange={changeBlurRadius}
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
