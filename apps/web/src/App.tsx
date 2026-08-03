import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
    type PointerEvent,
} from "react";

import {
    createBoxBlurKernel,
    createGaussianBlurKernel,
    createHorizontalNeighbourBlurKernel,
    createTeachingPattern,
    pixelCoordinateToOffset,
    type Kernel,
    type PixelCoordinate,
    type PixelBuffer,
    type SpectrumAnalysisResult,
    type TeachingPatternId,
} from "@blurlab/engine";

import styles from "./App.module.css";
import { BlurLabLogo } from "./BlurLabLogo";
import { CustomKernelEditor } from "./CustomKernelEditor";
import {
    createIdentityCustomKernelDraft,
    parseCustomKernelDraft,
    type CustomKernelDraft,
} from "./customKernel";
import {
    FullscreenPanel,
    type ExpandedPanel,
} from "./FullscreenPanel";
import {
    FourierPanel,
} from "./FourierPanel";
import {
    useFourierAnalysis,
    type FourierAnalysisStatus,
} from "./useFourierAnalysis";
import {
    TeachingSourceGrid,
    TeachingSourcePicker,
} from "./TeachingSourcePicker";
import {
    ExpandButton,
    PanelHeading,
} from "./PanelHeading";
import { teachingSources } from "./teachingSources";
import type {
    BlurWorkerRequest,
    BlurWorkerResponse,
} from "./blurWorkerProtocol";
import {
    decodeImageFile,
    pixelBufferToCanvas,
} from "./imagePipeline";

type MobilePanel = "blur" | "kernel" | "pixels" | "fourier";
type BlurPresetId = "neighbour" | "box" | "gaussian" | "custom";

type ImageMetadata = {
    name: string;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
    size: number | null;
    source: "file" | "teaching";
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
    parameter: "radius" | "sigma" | "custom";
    direction: string;
    description: string;
};

const MICROSCOPE_RADIUS = 5;
const MICROSCOPE_SIDE_LENGTH =
    2 * MICROSCOPE_RADIUS + 1;
const INITIAL_TEACHING_PATTERN: TeachingPatternId =
    "composite";

const presets: readonly BlurPreset[] = [
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

const expandedPanelTitles: Record<ExpandedPanel, string> = {
    image: "Image stage",
    blur: "Blur controls",
    kernel: "Kernel",
    pixels: "Pixel microscope",
    fourier: "Fourier scope",
};

function createTeachingSource(
    id: TeachingPatternId,
): {
    buffer: PixelBuffer;
    metadata: ImageMetadata;
} {
    const buffer = createTeachingPattern(id);
    const definition = teachingSources.find(
        (source) => source.id === id,
    );

    if (definition === undefined) {
        throw new Error(`Unknown teaching source: ${id}`);
    }

    return {
        buffer,
        metadata: {
            name: definition.label,
            width: buffer.width,
            height: buffer.height,
            sourceWidth: buffer.width,
            sourceHeight: buffer.height,
            size: null,
            source: "teaching",
        },
    };
}

const initialTeachingSource = createTeachingSource(
    INITIAL_TEACHING_PATTERN,
);

function TopBar({
    hasImage,
    activeTeachingPattern,
    onSelectTeachingPattern,
    onOpenImage,
    onReset,
}: {
    hasImage: boolean;
    activeTeachingPattern: TeachingPatternId | null;
    onSelectTeachingPattern: (id: TeachingPatternId) => void;
    onOpenImage: () => void;
    onReset: () => void;
}) {
    return (
        <header className={styles.topBar}>
            <div className={styles.brand}>
                <BlurLabLogo
                    className={styles.brandMark}
                    decorative
                />
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
                <TeachingSourcePicker
                    activeId={activeTeachingPattern}
                    onSelect={onSelectTeachingPattern}
                />
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
    dividerPercentage,
    onDividerPercentageChange,
    onExpand,
    onOpenImage,
    onSelectTeachingPattern,
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
    dividerPercentage: number;
    onDividerPercentageChange: (percentage: number) => void;
    onExpand?: () => void;
    onOpenImage: () => void;
    onSelectTeachingPattern: (id: TeachingPatternId) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const originalRasterRef = useRef<HTMLCanvasElement | null>(null);
    const resultRasterRef = useRef<HTMLCanvasElement | null>(null);
    const dividerPercentageRef = useRef(dividerPercentage);
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
        metadata === null || metadata.size === null
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

        onDividerPercentageChange(
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
            onDividerPercentageChange(
                Math.max(0, dividerPercentage - step),
            );
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            onDividerPercentageChange(
                Math.min(100, dividerPercentage + step),
            );
        } else if (event.key === "Home") {
            event.preventDefault();
            onDividerPercentageChange(0);
        } else if (event.key === "End") {
            event.preventDefault();
            onDividerPercentageChange(100);
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
            aria-label="Image stage"
            data-has-image={hasImage}
        >
            <div className={styles.stageToolbar}>
                <div>
                    <span className={styles.liveDot} aria-hidden="true" />
                    <span>
                        {metadata?.name ?? "Image stage"}
                    </span>
                </div>
                <div className={styles.comparisonMode}>
                    <span>Original</span>
                    <span aria-hidden="true">↔</span>
                    <span>Result</span>
                </div>
                <div className={styles.stageToolbarEnd}>
                    <span className={styles.zoomReadout}>
                        {hasImage ? "Fit" : "100%"}
                    </span>
                    {onExpand !== undefined && (
                        <ExpandButton
                            label="Image stage"
                            onClick={onExpand}
                        />
                    )}
                </div>
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
                    <div
                        className={styles.emptyState}
                        data-with-sources={!loadError}
                    >
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
                        {!loadError && (
                            <TeachingSourceGrid
                                onSelect={onSelectTeachingPattern}
                            />
                        )}
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
                            <span>
                                {metadata.source === "teaching"
                                    ? "generated source"
                                    : sizeInMegabytes}
                            </span>
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
    gaussianSigma,
    onGaussianSigmaChange,
    onExpand,
    onExpandKernel,
    presentation = false,
}: {
    selectedPreset: BlurPreset;
    kernel: Kernel;
    onSelectPreset: (preset: BlurPreset) => void;
    blurRadius: number;
    onBlurRadiusChange: (radius: number) => void;
    gaussianSigma: number;
    onGaussianSigmaChange: (sigma: number) => void;
    onExpand?: () => void;
    onExpandKernel?: () => void;
    presentation?: boolean;
}) {
    const kernelSum = kernel.weights.reduce(
        (sum, weight) => sum + weight,
        0,
    );

    return (
        <section
            className={`${styles.panel} ${styles.blurPanel}`}
            data-presentation={presentation}
        >
            <PanelHeading
                eyebrow="Spatial operation"
                title="Blur"
                accent="primary"
                aside={<span className={styles.stepBadge}>1 / 5</span>}
                onExpand={onExpand}
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
                            : selectedPreset.id === "custom"
                              ? "free"
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
                {selectedPreset.parameter === "radius" && (
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
                    </div>
                )}
                {selectedPreset.parameter === "sigma" && (
                    <div className={styles.radiusControl}>
                        <div className={styles.radiusReadout}>
                            <span>Gaussian spread</span>
                            <strong>σ {gaussianSigma.toFixed(1)}</strong>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="4"
                            step="0.1"
                            value={gaussianSigma}
                            aria-label="Gaussian blur sigma in source pixels"
                            onChange={(event) => {
                                onGaussianSigmaChange(
                                    Number(event.currentTarget.value),
                                );
                            }}
                        />
                        <div className={styles.radiusScale} aria-hidden="true">
                            <span>σ 0.5</span>
                            <span>σ 4.0</span>
                        </div>
                    </div>
                )}
                {selectedPreset.parameter === "custom" && (
                    <div className={styles.customKernelControl}>
                        <p>
                            Edit finite real weights on a centred odd grid,
                            then apply them as one kernel.
                        </p>
                        {onExpandKernel !== undefined && (
                            <button
                                type="button"
                                onClick={onExpandKernel}
                            >
                                Edit custom kernel
                            </button>
                        )}
                    </div>
                )}
                <p className={styles.pendingParameter}>
                    Active kernel · {kernel.height} × {kernel.width} ·
                    {" "}{kernel.weights.length} weights · sum {formatWeight(kernelSum)} · periodic edge
                    {selectedPreset.id === "gaussian" && (
                        <> · radius {kernel.anchorX} px</>
                    )}
                </p>
            </div>

            <FormulaCard
                preset={selectedPreset}
                blurRadius={blurRadius}
                gaussianSigma={gaussianSigma}
                kernel={kernel}
            />
            <KernelSummary
                kernel={kernel}
                onExpand={onExpandKernel}
            />
        </section>
    );
}

function FormulaCard({
    preset,
    blurRadius,
    gaussianSigma,
    kernel,
}: {
    preset: BlurPreset;
    blurRadius: number;
    gaussianSigma: number;
    kernel: Kernel;
}) {
    return (
        <div className={styles.formulaCard}>
            <div className={styles.formulaHeader}>
                <span>Formula</span>
                <span>
                    {preset.id === "custom"
                        ? "user weights"
                        : "normalized"}
                </span>
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
                {preset.id === "gaussian" && (
                    <>
                        <span className={styles.mathVariable}>
                            <i>K</i><sub>m,n</sub>
                        </span>
                        <span>=</span>
                        <span className={styles.coefficientFraction}>
                            <span>1</span>
                            <span>Z</span>
                        </span>
                        <span>exp</span>
                        <span className={styles.gaussianExponent}>
                            −(m²+n²) / (2·{gaussianSigma.toFixed(1)}²)
                        </span>
                    </>
                )}
                {preset.id === "custom" && (
                    <>
                        <span className={styles.mathVariable}>
                            <i>y</i><sub>i,j</sub>
                        </span>
                        <span>=</span>
                        <Summation
                            index="m"
                            lowerBound={-kernel.anchorY}
                            upperBound={kernel.height - kernel.anchorY - 1}
                        />
                        <Summation
                            index="n"
                            lowerBound={-kernel.anchorX}
                            upperBound={kernel.width - kernel.anchorX - 1}
                        />
                        <span className={styles.mathVariable}>
                            <i>K</i><sub>m,n</sub>
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
    const isUniform = [...kernel.weights].every(
        (candidate) => candidate === weight,
    );
    const isNormalizedUniform =
        isUniform &&
        Math.abs(weight * kernel.weights.length - 1) <
        Number.EPSILON * kernel.weights.length;
    const minimum = Math.min(...kernel.weights);
    const maximum = Math.max(...kernel.weights);

    return (
        <div className={styles.compactKernelWeight}>
            <span>
                {kernel.weights.length}{" "}
                {isUniform ? "equal weights" : "spatial weights"}
            </span>
            {isUniform ? (
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
            ) : (
                <strong>
                    <span>min {formatWeight(minimum)}</span>
                    <span>·</span>
                    <span>max {formatWeight(maximum)}</span>
                </strong>
            )}
        </div>
    );
}

function KernelSummary({
    kernel,
    onExpand,
}: {
    kernel: Kernel;
    onExpand?: () => void;
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
            {onExpand !== undefined && (
                <ExpandButton
                    label="Kernel"
                    onClick={onExpand}
                />
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
    onExpand,
    presentation = false,
}: {
    sourceBuffer: PixelBuffer | null;
    resultBuffer: PixelBuffer | null;
    selectedCoordinate: PixelCoordinate | null;
    onExpand?: () => void;
    presentation?: boolean;
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
        <section
            className={`${styles.panel} ${styles.pixelPanel}`}
            data-presentation={presentation}
        >
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
                onExpand={onExpand}
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

function isKernelSeparable(kernel: Kernel): boolean {
    let pivotIndex = 0;
    let pivotMagnitude = 0;

    for (let index = 0; index < kernel.weights.length; index += 1) {
        const magnitude = Math.abs(kernel.weights[index]!);

        if (magnitude > pivotMagnitude) {
            pivotIndex = index;
            pivotMagnitude = magnitude;
        }
    }

    if (pivotMagnitude === 0) {
        return true;
    }

    const pivotY = Math.floor(pivotIndex / kernel.width);
    const pivotX = pivotIndex % kernel.width;
    const pivot = kernel.weights[pivotIndex]!;

    for (let y = 0; y < kernel.height; y += 1) {
        for (let x = 0; x < kernel.width; x += 1) {
            const left = kernel.weights[y * kernel.width + x]! * pivot;
            const right =
                kernel.weights[y * kernel.width + pivotX]! *
                kernel.weights[pivotY * kernel.width + x]!;
            const scale = Math.max(1, Math.abs(left), Math.abs(right));

            if (Math.abs(left - right) > 1e-10 * scale) {
                return false;
            }
        }
    }

    return true;
}

function KernelPanel({
    kernel,
    customDraft,
    onCustomDraftChange,
    onApplyCustomKernel,
    onExpand,
    presentation = false,
}: {
    kernel: Kernel;
    customDraft?: CustomKernelDraft;
    onCustomDraftChange?: (draft: CustomKernelDraft) => void;
    onApplyCustomKernel?: (kernel: Kernel) => void;
    onExpand?: () => void;
    presentation?: boolean;
}) {
    const isEditingCustom =
        customDraft !== undefined &&
        onCustomDraftChange !== undefined &&
        onApplyCustomKernel !== undefined;
    const showFullMatrix =
        kernel.width <= 5 &&
        kernel.height <= 5;
    const weightSum = kernel.weights.reduce(
        (sum, weight) => sum + weight,
        0,
    );
    const isSymmetric =
        kernel.anchorX * 2 === kernel.width - 1 &&
        kernel.anchorY * 2 === kernel.height - 1 &&
        [...kernel.weights].every(
            (weight, index, weights) =>
                weight === weights[weights.length - index - 1],
        );
    const isSeparable = isKernelSeparable(kernel);
    const displayedWidth = isEditingCustom
        ? customDraft.size
        : kernel.width;
    const displayedHeight = isEditingCustom
        ? customDraft.size
        : kernel.height;

    return (
        <section
            className={styles.kernelPanelContent}
            data-presentation={presentation}
        >
            <PanelHeading
                eyebrow="Local weights"
                title="Kernel"
                accent="spatial"
                aside={
                    <span className={styles.dimension}>
                        {displayedHeight} × {displayedWidth}
                    </span>
                }
                onExpand={onExpand}
            />
            <div
                className={styles.kernelBody}
                data-editing-custom={isEditingCustom}
            >
                {isEditingCustom ? (
                    <CustomKernelEditor
                        draft={customDraft}
                        onDraftChange={onCustomDraftChange}
                        onApply={onApplyCustomKernel}
                    />
                ) : showFullMatrix ? (
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
                        <dt>{isEditingCustom ? "Applied sum" : "Sum"}</dt>
                        <dd>{weightSum.toFixed(2)}</dd>
                    </div>
                    <div>
                        <dt>Symmetric</dt>
                        <dd>{isSymmetric ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                        <dt>Separable</dt>
                        <dd>{isSeparable ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                        <dt>Boundary</dt>
                        <dd>Periodic</dd>
                    </div>
                </dl>
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
    fourierAnalysis,
    fourierStatus,
    fourierError,
    onSelectPreset,
    blurRadius,
    onBlurRadiusChange,
    gaussianSigma,
    onGaussianSigmaChange,
    customKernelDraft,
    onCustomKernelDraftChange,
    onApplyCustomKernel,
    onExpandPanel,
}: {
    activePanel: MobilePanel;
    selectedPreset: BlurPreset;
    kernel: Kernel;
    sourceBuffer: PixelBuffer | null;
    resultBuffer: PixelBuffer | null;
    selectedCoordinate: PixelCoordinate | null;
    fourierAnalysis: SpectrumAnalysisResult | null;
    fourierStatus: FourierAnalysisStatus;
    fourierError: string | null;
    onSelectPreset: (preset: BlurPreset) => void;
    blurRadius: number;
    onBlurRadiusChange: (radius: number) => void;
    gaussianSigma: number;
    onGaussianSigmaChange: (sigma: number) => void;
    customKernelDraft: CustomKernelDraft;
    onCustomKernelDraftChange: (draft: CustomKernelDraft) => void;
    onApplyCustomKernel: (kernel: Kernel) => void;
    onExpandPanel: (panel: ExpandedPanel) => void;
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
                    gaussianSigma={gaussianSigma}
                    onGaussianSigmaChange={onGaussianSigmaChange}
                    onExpand={() => onExpandPanel("blur")}
                    onExpandKernel={() => onExpandPanel("kernel")}
                />
            )}
            {activePanel === "kernel" && (
                <section className={`${styles.panel} ${styles.kernelPanel}`}>
                    <KernelPanel
                        kernel={kernel}
                        customDraft={
                            selectedPreset.id === "custom"
                                ? customKernelDraft
                                : undefined
                        }
                        onCustomDraftChange={onCustomKernelDraftChange}
                        onApplyCustomKernel={onApplyCustomKernel}
                        onExpand={() => onExpandPanel("kernel")}
                    />
                </section>
            )}
            {activePanel === "pixels" && (
                <PixelPanel
                    sourceBuffer={sourceBuffer}
                    resultBuffer={resultBuffer}
                    selectedCoordinate={selectedCoordinate}
                    onExpand={() => onExpandPanel("pixels")}
                />
            )}
            {activePanel === "fourier" && (
                <section className={`${styles.panel} ${styles.fourierPanel}`}>
                    <FourierPanel
                        analysis={fourierAnalysis}
                        status={fourierStatus}
                        error={fourierError}
                        onExpand={() => onExpandPanel("fourier")}
                    />
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
    const sourceLoadRequestRef = useRef(0);
    const [activeMobilePanel, setActiveMobilePanel] =
        useState<MobilePanel>("blur");
    const [expandedPanel, setExpandedPanel] =
        useState<ExpandedPanel | null>(null);
    const [activeTeachingPattern, setActiveTeachingPattern] =
        useState<TeachingPatternId | null>(
            INITIAL_TEACHING_PATTERN,
        );
    const [sourceBuffer, setSourceBuffer] =
        useState<PixelBuffer | null>(
            initialTeachingSource.buffer,
        );
    const [metadata, setMetadata] =
        useState<ImageMetadata | null>(
            initialTeachingSource.metadata,
        );
    const [loadError, setLoadError] = useState(false);
    const [resultBuffer, setResultBuffer] =
        useState<PixelBuffer | null>(null);
    const [selectedCoordinate, setSelectedCoordinate] =
        useState<PixelCoordinate | null>(() =>
            clampMicroscopeCenter(
                {
                    x: initialTeachingSource.buffer.width / 2,
                    y: initialTeachingSource.buffer.height / 2,
                },
                initialTeachingSource.buffer,
            ),
        );
    const [dividerPercentage, setDividerPercentage] =
        useState(50);
    const [isProcessing, setIsProcessing] = useState(true);
    const [processingError, setProcessingError] =
        useState<string | null>(null);
    const [selectedPresetId, setSelectedPresetId] =
        useState<BlurPresetId>("neighbour");
    const [blurRadius, setBlurRadius] = useState<number>(1);
    const [gaussianSigma, setGaussianSigma] = useState<number>(1);
    const [customKernelDraft, setCustomKernelDraft] =
        useState<CustomKernelDraft>(() =>
            createIdentityCustomKernelDraft(3),
        );
    const [customKernel, setCustomKernel] = useState<Kernel>(() => {
        const parsed = parseCustomKernelDraft(
            createIdentityCustomKernelDraft(3),
        );

        if (!parsed.ok) {
            throw new Error("The initial custom kernel is invalid.");
        }

        return parsed.kernel;
    });
    const selectedPreset = getPreset(selectedPresetId);
    const selectedKernel = useMemo(
        () => {
            switch (selectedPresetId) {
                case "neighbour":
                    return createHorizontalNeighbourBlurKernel(blurRadius);
                case "box":
                    return createBoxBlurKernel(blurRadius);
                case "gaussian":
                    return createGaussianBlurKernel(gaussianSigma);
                case "custom":
                    return customKernel;
            }
        },
        [blurRadius, customKernel, gaussianSigma, selectedPresetId],
    );
    const {
        analysis: fourierAnalysis,
        status: fourierStatus,
        error: fourierError,
    } = useFourierAnalysis({
        sourceBuffer,
        kernel: selectedKernel,
    });

    const activateSource = useCallback((
        buffer: PixelBuffer,
        nextMetadata: ImageMetadata,
        teachingPattern: TeachingPatternId | null,
    ) => {
        setResultBuffer(null);
        setProcessingError(null);
        setIsProcessing(true);
        setLoadError(false);
        setSourceBuffer(buffer);
        setMetadata(nextMetadata);
        setActiveTeachingPattern(teachingPattern);
        setDividerPercentage(50);
        setSelectedCoordinate(
            clampMicroscopeCenter(
                {
                    x: Math.floor(buffer.width / 2),
                    y: Math.floor(buffer.height / 2),
                },
                buffer,
            ),
        );
    }, []);

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

    const changeGaussianSigma = (sigma: number) => {
        if (sigma === gaussianSigma) {
            return;
        }

        setGaussianSigma(sigma);

        if (sourceBuffer !== null) {
            setResultBuffer(null);
            setProcessingError(null);
            setIsProcessing(true);
        }
    };

    const applyCustomKernel = (kernel: Kernel) => {
        setCustomKernel(kernel);

        if (sourceBuffer !== null && selectedPresetId === "custom") {
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

    const openImagePicker = () => fileInputRef.current?.click();
    const openImageFromPresentation = () => {
        setExpandedPanel(null);
        window.setTimeout(openImagePicker, 0);
    };

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextFile = event.currentTarget.files?.[0] ?? null;
        const requestId = sourceLoadRequestRef.current + 1;

        sourceLoadRequestRef.current = requestId;
        event.currentTarget.value = "";

        if (nextFile === null) {
            return;
        }

        setActiveTeachingPattern(null);
        setSourceBuffer(null);
        setResultBuffer(null);
        setSelectedCoordinate(null);
        setMetadata(null);
        setLoadError(false);
        setProcessingError(null);
        setIsProcessing(false);

        void decodeImageFile(nextFile)
            .then((decodedImage) => {
                if (sourceLoadRequestRef.current !== requestId) {
                    return;
                }

                const { buffer } = decodedImage;

                activateSource(
                    buffer,
                    {
                        name: nextFile.name,
                        width: buffer.width,
                        height: buffer.height,
                        sourceWidth: decodedImage.sourceWidth,
                        sourceHeight: decodedImage.sourceHeight,
                        size: nextFile.size,
                        source: "file",
                    },
                    null,
                );
            })
            .catch(() => {
                if (sourceLoadRequestRef.current !== requestId) {
                    return;
                }

                setSourceBuffer(null);
                setMetadata(null);
                setLoadError(true);
            });
    };

    const selectTeachingPattern = (id: TeachingPatternId) => {
        sourceLoadRequestRef.current += 1;

        const source = createTeachingSource(id);

        activateSource(
            source.buffer,
            source.metadata,
            id,
        );
    };

    const resetImage = () => {
        sourceLoadRequestRef.current += 1;
        setSourceBuffer(null);
        setResultBuffer(null);
        setSelectedCoordinate(null);
        setMetadata(null);
        setActiveTeachingPattern(null);
        setLoadError(false);
        setProcessingError(null);
        setIsProcessing(false);
        setDividerPercentage(50);
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

    const expandedContent =
        expandedPanel === "image" ? (
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
                dividerPercentage={dividerPercentage}
                onDividerPercentageChange={setDividerPercentage}
                onOpenImage={openImageFromPresentation}
                onSelectTeachingPattern={selectTeachingPattern}
            />
        ) : expandedPanel === "blur" ? (
            <BlurPanel
                selectedPreset={selectedPreset}
                kernel={selectedKernel}
                onSelectPreset={selectPreset}
                blurRadius={blurRadius}
                onBlurRadiusChange={changeBlurRadius}
                gaussianSigma={gaussianSigma}
                onGaussianSigmaChange={changeGaussianSigma}
                onExpandKernel={() => setExpandedPanel("kernel")}
                presentation
            />
        ) : expandedPanel === "kernel" ? (
            <section className={`${styles.panel} ${styles.kernelPanel}`}>
                <KernelPanel
                    kernel={selectedKernel}
                    customDraft={
                        selectedPresetId === "custom"
                            ? customKernelDraft
                            : undefined
                    }
                    onCustomDraftChange={setCustomKernelDraft}
                    onApplyCustomKernel={applyCustomKernel}
                    presentation
                />
            </section>
        ) : expandedPanel === "pixels" ? (
            <PixelPanel
                sourceBuffer={sourceBuffer}
                resultBuffer={resultBuffer}
                selectedCoordinate={selectedCoordinate}
                presentation
            />
        ) : expandedPanel === "fourier" ? (
            <section className={`${styles.panel} ${styles.fourierPanel}`}>
                <FourierPanel
                    analysis={fourierAnalysis}
                    status={fourierStatus}
                    error={fourierError}
                    presentation
                />
            </section>
        ) : null;

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
                activeTeachingPattern={activeTeachingPattern}
                onSelectTeachingPattern={selectTeachingPattern}
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
                    dividerPercentage={dividerPercentage}
                    onDividerPercentageChange={setDividerPercentage}
                    onExpand={() => setExpandedPanel("image")}
                    onOpenImage={openImagePicker}
                    onSelectTeachingPattern={selectTeachingPattern}
                />
                <div className={styles.desktopControls}>
                    <BlurPanel
                        selectedPreset={selectedPreset}
                        kernel={selectedKernel}
                        onSelectPreset={selectPreset}
                        blurRadius={blurRadius}
                        onBlurRadiusChange={changeBlurRadius}
                        gaussianSigma={gaussianSigma}
                        onGaussianSigmaChange={changeGaussianSigma}
                        onExpand={() => setExpandedPanel("blur")}
                        onExpandKernel={() => setExpandedPanel("kernel")}
                    />
                </div>
                <div className={styles.desktopPixel}>
                    <PixelPanel
                        sourceBuffer={sourceBuffer}
                        resultBuffer={resultBuffer}
                        selectedCoordinate={selectedCoordinate}
                        onExpand={() => setExpandedPanel("pixels")}
                    />
                </div>
                <div className={styles.desktopFourier}>
                    <section className={`${styles.panel} ${styles.fourierPanel}`}>
                        <FourierPanel
                            analysis={fourierAnalysis}
                            status={fourierStatus}
                            error={fourierError}
                            onExpand={() => setExpandedPanel("fourier")}
                        />
                    </section>
                </div>
                <MobileInspector
                    activePanel={activeMobilePanel}
                    selectedPreset={selectedPreset}
                    kernel={selectedKernel}
                    sourceBuffer={sourceBuffer}
                    resultBuffer={resultBuffer}
                    selectedCoordinate={selectedCoordinate}
                    fourierAnalysis={fourierAnalysis}
                    fourierStatus={fourierStatus}
                    fourierError={fourierError}
                    onSelectPreset={selectPreset}
                    blurRadius={blurRadius}
                    onBlurRadiusChange={changeBlurRadius}
                    gaussianSigma={gaussianSigma}
                    onGaussianSigmaChange={changeGaussianSigma}
                    customKernelDraft={customKernelDraft}
                    onCustomKernelDraftChange={setCustomKernelDraft}
                    onApplyCustomKernel={applyCustomKernel}
                    onExpandPanel={setExpandedPanel}
                />
            </main>
            <MobileNavigation
                activePanel={activeMobilePanel}
                onChange={setActiveMobilePanel}
            />
            {expandedPanel !== null && expandedContent !== null && (
                <FullscreenPanel
                    panel={expandedPanel}
                    title={expandedPanelTitles[expandedPanel]}
                    onClose={() => setExpandedPanel(null)}
                >
                    {expandedContent}
                </FullscreenPanel>
            )}
        </div>
    );
}

export default App;
