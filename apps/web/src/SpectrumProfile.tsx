import {
    useCallback,
    useEffect,
    useRef,
} from "react";

import styles from "./FourierPanel.module.css";
import {
    decibelLabel,
    frequencyLabel,
    spectrumSliceLength,
    spectrumSliceValue,
    type SpectrumAxis,
    type SpectrumCoordinate,
} from "./spectrumProfiles";

function drawSpectrumProfile(
    canvas: HTMLCanvasElement,
    values: Float32Array,
    width: number,
    height: number,
    decibelFloor: number,
    color: readonly [number, number, number],
    selectedCoordinate: SpectrumCoordinate,
    axis: SpectrumAxis,
): void {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (displayWidth === 0 || displayHeight === 0) {
        return;
    }

    const pixelRatio = window.devicePixelRatio;
    const renderWidth = Math.max(
        1,
        Math.round(displayWidth * pixelRatio),
    );
    const renderHeight = Math.max(
        1,
        Math.round(displayHeight * pixelRatio),
    );

    if (
        canvas.width !== renderWidth ||
        canvas.height !== renderHeight
    ) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
    }

    const context = canvas.getContext("2d");

    if (context === null) {
        return;
    }

    context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
    );
    context.clearRect(0, 0, displayWidth, displayHeight);

    const inset = 3;
    const plotWidth = displayWidth - 2 * inset;
    const plotHeight = displayHeight - 2 * inset;
    const sliceLength = spectrumSliceLength(
        axis,
        width,
        height,
    );
    const xAt = (index: number) =>
        inset +
        (index + 0.5) / sliceLength *
            plotWidth;
    const yAt = (decibels: number) => {
        const normalized = Math.min(
            1,
            Math.max(
                0,
                (decibels - decibelFloor) /
                    -decibelFloor,
            ),
        );

        return inset + (1 - normalized) * plotHeight;
    };

    context.save();
    context.lineWidth = 1;
    context.setLineDash([2, 4]);
    context.strokeStyle = "rgba(255, 255, 255, 0.10)";

    for (const decibels of [0, -20, -40, decibelFloor]) {
        const y = yAt(
            Math.max(decibelFloor, decibels),
        );

        context.beginPath();
        context.moveTo(inset, y);
        context.lineTo(displayWidth - inset, y);
        context.stroke();
    }

    const dcIndex = Math.floor(sliceLength / 2);

    context.strokeStyle = "rgba(255, 255, 255, 0.18)";
    context.beginPath();
    context.moveTo(xAt(dcIndex), inset);
    context.lineTo(xAt(dcIndex), displayHeight - inset);
    context.stroke();
    context.restore();

    const seriesColor =
        `rgb(${color[0]} ${color[1]} ${color[2]})`;

    context.save();
    context.beginPath();

    for (let index = 0; index < sliceLength; index += 1) {
        const x = xAt(index);
        const y = yAt(
            spectrumSliceValue(
                values,
                width,
                selectedCoordinate,
                axis,
                index,
            ),
        );

        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }

    context.lineWidth = 1.5;
    context.lineJoin = "round";
    context.strokeStyle = seriesColor;
    context.shadowBlur = 8;
    context.shadowColor = seriesColor;
    context.stroke();
    context.restore();

    const selectedIndex =
        axis === "x"
            ? selectedCoordinate.x
            : selectedCoordinate.y;
    const selectedValue = spectrumSliceValue(
        values,
        width,
        selectedCoordinate,
        axis,
        selectedIndex,
    );
    const selectedX = xAt(selectedIndex);
    const selectedY = yAt(selectedValue);

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(selectedX, inset);
    context.lineTo(selectedX, displayHeight - inset);
    context.stroke();
    context.fillStyle = seriesColor;
    context.shadowBlur = 9;
    context.shadowColor = seriesColor;
    context.beginPath();
    context.arc(selectedX, selectedY, 2.5, 0, 2 * Math.PI);
    context.fill();
    context.restore();
}

export function SpectrumProfile({
    values,
    width,
    height,
    decibelFloor,
    color,
    selectedCoordinate,
    axis,
    seriesLabel,
}: {
    values: Float32Array;
    width: number;
    height: number;
    decibelFloor: number;
    color: readonly [number, number, number];
    selectedCoordinate: SpectrumCoordinate;
    axis: SpectrumAxis;
    seriesLabel: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const varyingCoordinate =
        axis === "x"
            ? selectedCoordinate.x
            : selectedCoordinate.y;
    const fixedCoordinate =
        axis === "x"
            ? selectedCoordinate.y
            : selectedCoordinate.x;
    const varyingDimension =
        axis === "x" ? width : height;
    const fixedDimension =
        axis === "x" ? height : width;
    const selectedValue = spectrumSliceValue(
        values,
        width,
        selectedCoordinate,
        axis,
        varyingCoordinate,
    );
    const draw = useCallback(() => {
        const canvas = canvasRef.current;

        if (canvas === null) {
            return;
        }

        drawSpectrumProfile(
            canvas,
            values,
            width,
            height,
            decibelFloor,
            color,
            selectedCoordinate,
            axis,
        );
    }, [
        axis,
        color,
        decibelFloor,
        height,
        selectedCoordinate,
        values,
        width,
    ]);
    const latestDrawRef = useRef(draw);

    useEffect(() => {
        latestDrawRef.current = draw;
        draw();
    }, [draw]);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (canvas === null) {
            return;
        }

        const observer = new ResizeObserver(() => {
            latestDrawRef.current();
        });

        observer.observe(canvas);

        return () => observer.disconnect();
    }, []);

    return (
        <div className={styles.profile}>
            <div className={styles.profileHeading}>
                <span className={styles.profileLabel}>
                    ω{axis} slice
                </span>
                <small>
                    ω{axis === "x" ? "y" : "x"} ={" "}
                    {frequencyLabel(
                        fixedCoordinate,
                        fixedDimension,
                    )}
                </small>
                <span className={styles.profileValue}>
                    {decibelLabel(selectedValue)}
                </span>
            </div>
            <div className={styles.profileChart}>
                <div
                    className={styles.profileDecibelAxis}
                    aria-hidden="true"
                >
                    <span>0</span>
                    <span>{decibelFloor}</span>
                </div>
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={`${seriesLabel} omega-${axis} magnitude slice. Selected frequency ${frequencyLabel(varyingCoordinate, varyingDimension)}, ${decibelLabel(selectedValue)}.`}
                />
            </div>
            <div
                className={styles.profileFrequencyAxis}
                aria-hidden="true"
            >
                <span>−π</span>
                <span>ω{axis}</span>
                <span>+π</span>
            </div>
        </div>
    );
}
