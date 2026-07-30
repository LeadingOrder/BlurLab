import {
    describe,
    expect,
    it,
} from "vitest";

import {
    createSpectrumViewport,
    decibelLabel,
    frequencyLabel,
    normalizedAngularFrequency,
    spectrumCoordinateAtViewportPosition,
    spectrumCoordinatePositionInViewport,
    spectrumSliceLength,
    spectrumSliceValue,
    spectrumViewportContains,
    type SpectrumAxis,
} from "../src/spectrumProfiles.ts";

const values = new Float32Array([
    0, 1,
    2, 3,
    4, 5,
]);
const width = 2;
const height = 3;
const coordinate = { x: 1, y: 1 };

function readSlice(axis: SpectrumAxis): number[] {
    return Array.from(
        {
            length: spectrumSliceLength(
                axis,
                width,
                height,
            ),
        },
        (_, index) =>
            spectrumSliceValue(
                values,
                width,
                coordinate,
                axis,
                index,
            ),
    );
}

describe("spectrum profiles", () => {
    it("reads the selected row as the omega-x slice", () => {
        expect(readSlice("x")).toEqual([2, 3]);
    });

    it("reads the selected column as the omega-y slice", () => {
        expect(readSlice("y")).toEqual([1, 3, 5]);
    });

    it("makes both slices intersect at the selected bin", () => {
        const selectedValue =
            values[coordinate.y * width + coordinate.x];

        expect(readSlice("x")[coordinate.x]).toBe(selectedValue);
        expect(readSlice("y")[coordinate.y]).toBe(selectedValue);
    });

    it("maps shifted FFT bins to normalized angular frequency", () => {
        expect(normalizedAngularFrequency(0, 256)).toBe(-1);
        expect(normalizedAngularFrequency(128, 256)).toBe(0);
        expect(normalizedAngularFrequency(255, 256)).toBe(
            1 - 2 / 256,
        );
    });

    it("formats frequencies and decibels without negative zero", () => {
        expect(frequencyLabel(128, 256)).toBe("0");
        expect(frequencyLabel(129, 256)).toBe("+0.01π");
        expect(decibelLabel(-0.01)).toBe("0.0 dB");
        expect(decibelLabel(-12.34)).toBe("−12.3 dB");
    });

    it("creates centred and edge-clamped zoom windows", () => {
        expect(
            createSpectrumViewport(
                256,
                256,
                { x: 128, y: 128 },
                4,
            ),
        ).toEqual({
            x: 96,
            y: 96,
            width: 64,
            height: 64,
        });
        expect(
            createSpectrumViewport(
                256,
                128,
                { x: 3, y: 126 },
                2,
            ),
        ).toEqual({
            x: 0,
            y: 64,
            width: 128,
            height: 64,
        });
    });

    it("maps display positions to exact bins with omega-y pointing up", () => {
        const viewport = {
            x: 96,
            y: 96,
            width: 64,
            height: 64,
        };

        expect(
            spectrumCoordinateAtViewportPosition(
                viewport,
                0,
                0,
            ),
        ).toEqual({ x: 96, y: 159 });
        expect(
            spectrumCoordinateAtViewportPosition(
                viewport,
                1,
                1,
            ),
        ).toEqual({ x: 159, y: 96 });
        expect(
            spectrumCoordinatePositionInViewport(
                viewport,
                { x: 128, y: 128 },
            ),
        ).toEqual({
            x: 32.5 / 64,
            y: 31.5 / 64,
        });
    });

    it("detects whether a selected bin is inside the zoom window", () => {
        const viewport = {
            x: 96,
            y: 96,
            width: 64,
            height: 64,
        };

        expect(
            spectrumViewportContains(
                viewport,
                { x: 96, y: 159 },
            ),
        ).toBe(true);
        expect(
            spectrumViewportContains(
                viewport,
                { x: 160, y: 159 },
            ),
        ).toBe(false);
    });
});
