import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
} from "react";

import type { SpectrumAnalysisResult } from "@blurlab/engine";

import styles from "./FourierPanel.module.css";
import { PanelHeading } from "./PanelHeading";
import {
    createSpectrumViewport,
    decibelLabel,
    frequencyLabel,
    spectrumCoordinateAtViewportPosition,
    spectrumCoordinatePositionInViewport,
    spectrumViewportContains,
    type SpectrumCoordinate,
    type SpectrumViewport,
    type SpectrumZoom,
} from "./spectrumProfiles";
import { SpectrumProfile } from "./SpectrumProfile";
import type {
    FourierAnalysisStatus,
} from "./useFourierAnalysis";

const DEFAULT_DECIBEL_FLOOR = -60;
const ZOOM_LEVELS: readonly SpectrumZoom[] = [1, 2, 4];

const spectrumSeries = [
    {
        field: "inputDecibels",
        label: "Input",
        symbol: "X",
        detail: "source magnitude",
        color: [124, 92, 255],
        tone: "input",
    },
    {
        field: "kernelDecibels",
        label: "Kernel",
        symbol: "H",
        detail: "transfer magnitude",
        color: [255, 59, 212],
        tone: "kernel",
    },
    {
        field: "outputDecibels",
        label: "Filtered",
        symbol: "Y",
        detail: "exact product XH",
        color: [46, 235, 255],
        tone: "output",
    },
] as const;

type SpectrumField =
    typeof spectrumSeries[number]["field"];

function drawSpectrum(
    canvas: HTMLCanvasElement,
    values: Float32Array,
    sourceWidth: number,
    viewport: SpectrumViewport,
    decibelFloor: number,
    color: readonly [number, number, number],
): void {
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext("2d");

    if (context === null) {
        return;
    }

    const image = context.createImageData(
        viewport.width,
        viewport.height,
    );

    for (
        let displayY = 0;
        displayY < viewport.height;
        displayY += 1
    ) {
        const sourceY =
            viewport.y + viewport.height - displayY - 1;

        for (
            let displayX = 0;
            displayX < viewport.width;
            displayX += 1
        ) {
            const sourceX = viewport.x + displayX;
            const sourceIndex =
                sourceY * sourceWidth + sourceX;
            const normalized = Math.min(
                1,
                Math.max(
                    0,
                    (values[sourceIndex]! - decibelFloor) /
                        -decibelFloor,
                ),
            );
            const intensity = normalized ** 0.62;
            const outputOffset =
                (displayY * viewport.width + displayX) * 4;

            image.data[outputOffset] =
                Math.round(color[0] * intensity);
            image.data[outputOffset + 1] =
                Math.round(color[1] * intensity);
            image.data[outputOffset + 2] =
                Math.round(color[2] * intensity);
            image.data[outputOffset + 3] = 255;
        }
    }

    context.putImageData(image, 0, 0);
}

function moveCoordinate(
    coordinate: SpectrumCoordinate,
    key: string,
    width: number,
    height: number,
): SpectrumCoordinate | null {
    switch (key) {
        case "ArrowLeft":
            return {
                ...coordinate,
                x: (coordinate.x - 1 + width) % width,
            };
        case "ArrowRight":
            return {
                ...coordinate,
                x: (coordinate.x + 1) % width,
            };
        case "ArrowUp":
            return {
                ...coordinate,
                y: (coordinate.y - 1 + height) % height,
            };
        case "ArrowDown":
            return {
                ...coordinate,
                y: (coordinate.y + 1) % height,
            };
        case "Home":
            return {
                x: Math.floor(width / 2),
                y: Math.floor(height / 2),
            };
        default:
            return null;
    }
}

function SpectrumHeatmap({
    analysis,
    field,
    label,
    symbol,
    detail,
    tone,
    color,
    selectedCoordinate,
    viewport,
    zoom,
    onSelectedCoordinateChange,
}: {
    analysis: SpectrumAnalysisResult;
    field: SpectrumField;
    label: string;
    symbol: string;
    detail: string;
    tone: string;
    color: readonly [number, number, number];
    selectedCoordinate: SpectrumCoordinate;
    viewport: SpectrumViewport;
    zoom: SpectrumZoom;
    onSelectedCoordinateChange:
        (coordinate: SpectrumCoordinate) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const values = analysis[field];
    const selectedValue =
        values[
            selectedCoordinate.y * analysis.width +
                selectedCoordinate.x
        ]!;

    useEffect(() => {
        const canvas = canvasRef.current;

        if (canvas === null) {
            return;
        }

        drawSpectrum(
            canvas,
            values,
            analysis.width,
            viewport,
            analysis.decibelFloor,
            color,
        );
    }, [
        analysis.decibelFloor,
        analysis.height,
        analysis.width,
        color,
        values,
        viewport,
    ]);

    const selectFromPointer = (
        event: PointerEvent<HTMLButtonElement>,
    ) => {
        const bounds =
            event.currentTarget.getBoundingClientRect();
        const coordinate =
            spectrumCoordinateAtViewportPosition(
                viewport,
                (event.clientX - bounds.left) /
                    bounds.width,
                (event.clientY - bounds.top) /
                    bounds.height,
            );

        onSelectedCoordinateChange(coordinate);
    };
    const selectedPosition =
        spectrumCoordinatePositionInViewport(
            viewport,
            selectedCoordinate,
        );
    const zeroFrequency = {
        x: Math.floor(analysis.width / 2),
        y: Math.floor(analysis.height / 2),
    };
    const showZeroFrequency =
        spectrumViewportContains(
            viewport,
            zeroFrequency,
        );
    const zeroFrequencyPosition =
        spectrumCoordinatePositionInViewport(
            viewport,
            zeroFrequency,
        );
    const horizontalAxisLabels =
        zoom === 1
            ? ["−π", "0", "π"]
            : [
                frequencyLabel(
                    viewport.x,
                    analysis.width,
                ),
                frequencyLabel(
                    viewport.x +
                        Math.floor(viewport.width / 2),
                    analysis.width,
                ),
                frequencyLabel(
                    viewport.x + viewport.width - 1,
                    analysis.width,
                ),
            ];
    const verticalAxisLabels =
        zoom === 1
            ? ["π", "0", "−π"]
            : [
                frequencyLabel(
                    viewport.y + viewport.height - 1,
                    analysis.height,
                ),
                frequencyLabel(
                    viewport.y +
                        Math.floor(viewport.height / 2),
                    analysis.height,
                ),
                frequencyLabel(
                    viewport.y,
                    analysis.height,
                ),
            ];

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
    ) => {
        const next = moveCoordinate(
            selectedCoordinate,
            event.key,
            analysis.width,
            analysis.height,
        );

        if (next === null) {
            return;
        }

        event.preventDefault();
        onSelectedCoordinateChange(next);
    };

    return (
        <figure
            className={styles.spectrumFigure}
            data-tone={tone}
        >
            <figcaption>
                <span>{label}</span>
                <strong>{symbol}</strong>
                <small>{detail}</small>
            </figcaption>
            <div className={styles.heatmapGroup}>
                <button
                    className={styles.heatmap}
                    type="button"
                    style={{
                        aspectRatio:
                            `${viewport.width} / ${viewport.height}`,
                    }}
                    aria-label={`${label} spectrum at ${zoom} times zoom, showing ${viewport.width} by ${viewport.height} bins. Selected bin ${decibelLabel(selectedValue)}. Click or drag to select a frequency; use arrow keys to refine the selection; Home selects zero frequency.`}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(
                            event.pointerId,
                        );
                        selectFromPointer(event);
                    }}
                    onPointerMove={(event) => {
                        if (event.buttons !== 0) {
                            selectFromPointer(event);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                >
                    <canvas ref={canvasRef} aria-hidden="true" />
                    <span
                        className={styles.verticalCrosshair}
                        style={{
                            left:
                                `${selectedPosition.x * 100}%`,
                        }}
                        aria-hidden="true"
                    />
                    <span
                        className={styles.horizontalCrosshair}
                        style={{
                            top:
                                `${selectedPosition.y * 100}%`,
                        }}
                        aria-hidden="true"
                    />
                    <span
                        className={styles.selectedBin}
                        style={{
                            left:
                                `${selectedPosition.x * 100}%`,
                            top:
                                `${selectedPosition.y * 100}%`,
                            width:
                                `max(${100 / viewport.width}%, 5px)`,
                            height:
                                `max(${100 / viewport.height}%, 5px)`,
                        }}
                        aria-hidden="true"
                    />
                    {showZeroFrequency && (
                        <span
                            className={styles.dcMarker}
                            style={{
                                left:
                                    `${zeroFrequencyPosition.x * 100}%`,
                                top:
                                    `${zeroFrequencyPosition.y * 100}%`,
                            }}
                            aria-hidden="true"
                        />
                    )}
                </button>
                <div
                    className={styles.horizontalAxis}
                    aria-hidden="true"
                >
                    {horizontalAxisLabels.map((axisLabel, index) => (
                        <span key={`${index}-${axisLabel}`}>
                            {axisLabel}
                        </span>
                    ))}
                </div>
                <div
                    className={styles.verticalAxis}
                    aria-hidden="true"
                >
                    {verticalAxisLabels.map((axisLabel, index) => (
                        <span key={`${index}-${axisLabel}`}>
                            {axisLabel}
                        </span>
                    ))}
                </div>
            </div>
            <div
                className={styles.profileStack}
                role="group"
                aria-label={`${label} selected frequency slices`}
            >
                <SpectrumProfile
                    values={values}
                    width={analysis.width}
                    height={analysis.height}
                    decibelFloor={analysis.decibelFloor}
                    color={color}
                    selectedCoordinate={selectedCoordinate}
                    axis="x"
                    seriesLabel={label}
                />
                <SpectrumProfile
                    values={values}
                    width={analysis.width}
                    height={analysis.height}
                    decibelFloor={analysis.decibelFloor}
                    color={color}
                    selectedCoordinate={selectedCoordinate}
                    axis="y"
                    seriesLabel={label}
                />
            </div>
        </figure>
    );
}

export function FourierPanel({
    analysis,
    status,
    error,
    onExpand,
    presentation = false,
}: {
    analysis: SpectrumAnalysisResult | null;
    status: FourierAnalysisStatus;
    error: string | null;
    onExpand?: () => void;
    presentation?: boolean;
}) {
    const [selectedCoordinate, setSelectedCoordinate] =
        useState<SpectrumCoordinate | null>(null);
    const [zoom, setZoom] =
        useState<SpectrumZoom>(1);
    const [viewportCenter, setViewportCenter] =
        useState<SpectrumCoordinate | null>(null);
    const pendingCoordinateRef =
        useRef<SpectrumCoordinate | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const statusLabel =
        status === "empty"
            ? "Load an image"
            : status === "analyzing"
                ? "Analyzing full image"
                : status === "error"
                    ? error ?? "Spectrum unavailable"
                    : analysis === null
                        ? "Spectrum unavailable"
                        : `Full image · ${analysis.width} × ${analysis.height} FFT`;
    const activeCoordinate = useMemo(
        () =>
            analysis === null
                ? null
                : selectedCoordinate !== null &&
                    selectedCoordinate.x < analysis.width &&
                    selectedCoordinate.y < analysis.height
                    ? selectedCoordinate
                    : {
                        x: Math.floor(
                            analysis.width / 2,
                        ),
                        y: Math.floor(
                            analysis.height / 2,
                        ),
                    },
        [analysis, selectedCoordinate],
    );
    const validViewportCenter =
        analysis !== null &&
        viewportCenter !== null &&
        viewportCenter.x < analysis.width &&
        viewportCenter.y < analysis.height
            ? viewportCenter
            : activeCoordinate;
    const viewportAnchorX =
        zoom === 1
            ? 0
            : validViewportCenter?.x ?? 0;
    const viewportAnchorY =
        zoom === 1
            ? 0
            : validViewportCenter?.y ?? 0;
    const activeViewport = useMemo(
        () =>
            analysis === null
                ? null
                : createSpectrumViewport(
                    analysis.width,
                    analysis.height,
                    {
                        x: viewportAnchorX,
                        y: viewportAnchorY,
                    },
                    zoom,
                ),
        [
            analysis,
            viewportAnchorX,
            viewportAnchorY,
            zoom,
        ],
    );
    const selectCoordinate = useCallback(
        (coordinate: SpectrumCoordinate) => {
            pendingCoordinateRef.current = coordinate;

            if (animationFrameRef.current !== null) {
                return;
            }

            animationFrameRef.current =
                window.requestAnimationFrame(() => {
                    animationFrameRef.current = null;
                    const pending =
                        pendingCoordinateRef.current;

                    if (pending === null) {
                        return;
                    }

                    pendingCoordinateRef.current = null;
                    if (
                        activeViewport !== null &&
                        !spectrumViewportContains(
                            activeViewport,
                            pending,
                        )
                    ) {
                        const outsideHorizontal =
                            pending.x < activeViewport.x ||
                            pending.x >=
                                activeViewport.x +
                                    activeViewport.width;
                        const outsideVertical =
                            pending.y < activeViewport.y ||
                            pending.y >=
                                activeViewport.y +
                                    activeViewport.height;

                        setViewportCenter({
                            x: outsideHorizontal
                                ? pending.x
                                : activeViewport.x +
                                    Math.floor(
                                        activeViewport.width / 2,
                                    ),
                            y: outsideVertical
                                ? pending.y
                                : activeViewport.y +
                                    Math.floor(
                                        activeViewport.height / 2,
                                    ),
                        });
                    }

                    setSelectedCoordinate((current) =>
                        current?.x === pending.x &&
                        current.y === pending.y
                            ? current
                            : pending,
                    );
                });
        },
        [activeViewport],
    );
    const changeZoom = useCallback(
        (nextZoom: SpectrumZoom) => {
            if (activeCoordinate === null) {
                return;
            }

            setViewportCenter(activeCoordinate);
            setZoom(nextZoom);
        },
        [activeCoordinate],
    );

    useEffect(
        () => () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(
                    animationFrameRef.current,
                );
            }

            animationFrameRef.current = null;
            pendingCoordinateRef.current = null;
        },
        [],
    );

    return (
        <section
            className={styles.panelContent}
            data-presentation={presentation}
        >
            <PanelHeading
                eyebrow="Frequency response"
                title="Fourier scope"
                accent="frequency"
                aside={
                    <span className={styles.equationBadge}>
                        X × H = Y
                    </span>
                }
                onExpand={onExpand}
            />

            <div className={styles.statusRow}>
                <span aria-live="polite">{statusLabel}</span>
                <div
                    className={styles.zoomControls}
                    role="group"
                    aria-label="Fourier heatmap bin zoom"
                >
                    <span>Bin zoom</span>
                    {ZOOM_LEVELS.map((level) => (
                        <button
                            key={level}
                            type="button"
                            data-selected={zoom === level}
                            aria-pressed={zoom === level}
                            aria-label={`${level} times Fourier bin zoom`}
                            title={
                                zoom === level
                                    ? `Recenter ${level}× view on the selected bin`
                                    : `Show the ${level}× frequency view`
                            }
                            disabled={analysis === null}
                            onClick={() => changeZoom(level)}
                        >
                            {level}×
                        </button>
                    ))}
                </div>
                <span>magnitude · logarithmic</span>
            </div>

            <div
                className={styles.spectrumGrid}
                aria-label="Input, kernel, and filtered two-dimensional Fourier magnitudes"
            >
                {analysis !== null &&
                activeCoordinate !== null &&
                activeViewport !== null ? (
                    spectrumSeries.map((series) => (
                        <SpectrumHeatmap
                            key={series.field}
                            analysis={analysis}
                            field={series.field}
                            label={series.label}
                            symbol={series.symbol}
                            detail={series.detail}
                            tone={series.tone}
                            color={series.color}
                            selectedCoordinate={activeCoordinate}
                            viewport={activeViewport}
                            zoom={zoom}
                            onSelectedCoordinateChange={
                                selectCoordinate
                            }
                        />
                    ))
                ) : (
                    <div className={styles.emptySpectrum}>
                        <span>{statusLabel}</span>
                    </div>
                )}
            </div>

            {analysis !== null && activeCoordinate !== null && (
                <div
                    className={styles.binReadout}
                >
                    <span>
                        ωx{" "}
                        {frequencyLabel(
                            activeCoordinate.x,
                            analysis.width,
                        )}
                    </span>
                    <span>
                        ωy{" "}
                        {frequencyLabel(
                            activeCoordinate.y,
                            analysis.height,
                        )}
                    </span>
                    {spectrumSeries.map((series) => (
                        <span
                            key={series.field}
                            data-tone={series.tone}
                        >
                            {series.symbol}{" "}
                            {decibelLabel(
                                analysis[series.field][
                                    activeCoordinate.y *
                                        analysis.width +
                                        activeCoordinate.x
                                ]!,
                            )}
                        </span>
                    ))}
                </div>
            )}

            <div className={styles.scale}>
                <span>
                    {analysis?.decibelFloor ??
                        DEFAULT_DECIBEL_FLOOR} dB
                </span>
                <span aria-hidden="true" />
                <span>0 dB</span>
            </div>

            <div className={styles.boundaryNote}>
                <span>Periodic boundary</span>
                <p>
                    Complete-image magnitude · DC is centred ·
                    filtered spectrum is the exact complex product XH.
                </p>
            </div>
        </section>
    );
}
