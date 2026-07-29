import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type ReactNode,
} from "react";

import styles from "./App.module.css";

type MobilePanel = "blur" | "kernel" | "pixels" | "fourier";

type ImageMetadata = {
    name: string;
    width: number;
    height: number;
    size: number;
};

const presets = [
    "Original",
    "Neighbour",
    "Cross",
    "Box",
    "Weighted",
    "Gaussian",
] as const;

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

function drawFittedImage(
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
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
        (width - inset * 2) / image.naturalWidth,
        (height - inset * 2) / image.naturalHeight,
    );
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    const x = (width - renderedWidth) / 2;
    const y = (height - renderedHeight) / 2;

    context.drawImage(
        image,
        x,
        y,
        renderedWidth,
        renderedHeight,
    );
}

function clearCanvas(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");

    if (context !== null) {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function ImageStage({
    file,
    onOpenImage,
}: {
    file: File | null;
    onOpenImage: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (file === null) {
            imageRef.current = null;

            if (canvas !== null) {
                clearCanvas(canvas);
            }

            return;
        }

        const sourceUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            imageRef.current = image;
            setMetadata({
                name: file.name,
                width: image.naturalWidth,
                height: image.naturalHeight,
                size: file.size,
            });

            if (canvasRef.current !== null) {
                drawFittedImage(canvasRef.current, image);
            }
        };
        image.onerror = () => {
            imageRef.current = null;
            setMetadata(null);
            setLoadError(true);
        };
        image.src = sourceUrl;

        return () => {
            image.onload = null;
            image.onerror = null;
            URL.revokeObjectURL(sourceUrl);
        };
    }, [file]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = canvas?.parentElement;

        if (
            canvas === null ||
            container === null ||
            container === undefined
        ) {
            return;
        }

        const observer = new ResizeObserver(() => {
            if (imageRef.current !== null) {
                drawFittedImage(canvas, imageRef.current);
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const hasImage = metadata !== null;
    const sizeInMegabytes =
        metadata === null
            ? null
            : `${(metadata.size / 1_000_000).toFixed(1)} MB`;

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
                <div className={styles.viewSwitch} aria-label="Image view">
                    <button type="button" disabled>
                        Result
                    </button>
                    <button
                        type="button"
                        data-active="true"
                        aria-pressed="true"
                    >
                        Original
                    </button>
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
                            ? `Original image: ${metadata.name}`
                            : "No image loaded"
                    }
                />

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
                            <span>source · canvas</span>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

function BlurPanel() {
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
                        key={preset}
                        className={styles.preset}
                        type="button"
                        data-selected={preset === "Neighbour"}
                        aria-pressed={preset === "Neighbour"}
                    >
                        <span>{String(index).padStart(2, "0")}</span>
                        <strong>{preset}</strong>
                        {preset === "Neighbour" && (
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
                        <strong>Horizontal</strong>
                    </div>
                    <span className={styles.valuePill}>x-axis</span>
                </div>
                <div className={styles.segmentedControl}>
                    <button type="button" data-active="true">
                        Horizontal
                    </button>
                    <button type="button">Vertical</button>
                </div>
            </div>

            <FormulaCard />
            <KernelSummary />
        </section>
    );
}

function FormulaCard() {
    return (
        <div className={styles.formulaCard}>
            <div className={styles.formulaHeader}>
                <span>Formula</span>
                <span>normalized</span>
            </div>
            <div
                className={styles.formula}
                aria-label="y sub i equals x sub i plus x sub i plus one divided by two"
            >
                <i>y</i><sub>i</sub>
                <span>=</span>
                <span className={styles.fraction}>
                    <span>
                        <i>x</i><sub>i</sub> + <i>x</i><sub>i+1</sub>
                    </span>
                    <span>2</span>
                </span>
            </div>
            <p>
                Each output mixes one pixel with its neighbour in equal
                measure.
            </p>
        </div>
    );
}

function KernelSummary() {
    return (
        <div className={styles.kernelSummary}>
            <div>
                <span>Kernel</span>
                <strong>1 × 2 · sum 1.00</strong>
            </div>
            <div className={styles.kernelSummaryMatrix}>
                <span>0.5</span>
                <span>0.5</span>
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

function KernelPanel() {
    return (
        <section className={styles.kernelPanelContent}>
            <PanelHeading
                eyebrow="Local weights"
                title="Kernel"
                accent="spatial"
                aside={<span className={styles.dimension}>1 × 2</span>}
            />
            <div className={styles.kernelBody}>
                <div className={styles.kernelMatrix} aria-label="Kernel one half, one half">
                    <span>0.5</span>
                    <span>0.5</span>
                </div>
                <dl className={styles.kernelProperties}>
                    <div>
                        <dt>Sum</dt>
                        <dd>1.00</dd>
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
}: {
    activePanel: MobilePanel;
}) {
    return (
        <div className={styles.mobileInspector}>
            {activePanel === "blur" && <BlurPanel />}
            {activePanel === "kernel" && (
                <section className={`${styles.panel} ${styles.kernelPanel}`}>
                    <KernelPanel />
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

    const openImagePicker = () => fileInputRef.current?.click();

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextFile = event.currentTarget.files?.[0] ?? null;
        setImageFile(nextFile);
        event.currentTarget.value = "";
    };

    const resetImage = () => setImageFile(null);

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
                hasImage={imageFile !== null}
                onOpenImage={openImagePicker}
                onReset={resetImage}
            />
            <main className={styles.workspace}>
                <ImageStage
                    key={
                        imageFile === null
                            ? "empty"
                            : `${imageFile.name}-${imageFile.size}-${imageFile.lastModified}`
                    }
                    file={imageFile}
                    onOpenImage={openImagePicker}
                />
                <div className={styles.desktopControls}>
                    <BlurPanel />
                </div>
                <div className={styles.desktopPixel}>
                    <PixelPanel />
                </div>
                <div className={styles.desktopFourier}>
                    <section className={`${styles.panel} ${styles.fourierPanel}`}>
                        <FourierPanel />
                    </section>
                </div>
                <MobileInspector activePanel={activeMobilePanel} />
            </main>
            <MobileNavigation
                activePanel={activeMobilePanel}
                onChange={setActiveMobilePanel}
            />
        </div>
    );
}

export default App;
