import {
    chartreusePalette,
    cyanPalette,
    elevation,
    magentaPalette,
    neutralPalette,
    violetPalette,
} from "./foundations";

export const blurLabColors = {
    background: {
        app: neutralPalette.appBackground,
        surface: neutralPalette.surface,
        raised: neutralPalette.surfaceRaised,
        strong: neutralPalette.surfaceStrong,
        pressed: neutralPalette.surfacePressed,
        glass: neutralPalette.surfaceGlass,
        stage: neutralPalette.stage,
    },

    text: {
        primary: neutralPalette.textPrimary,
        secondary: neutralPalette.textSecondary,
        disabled: neutralPalette.textDisabled,
        onPrimary: neutralPalette.textPrimary,
    },

    border: {
        subtle: neutralPalette.line,
        strong: neutralPalette.lineStrong,
        selected: violetPalette[400],
    },

    interaction: {
        primary: violetPalette[500],
        primaryHover: violetPalette[400],
        primaryPressed: violetPalette[600],

        selectedForeground: violetPalette[100],
        selectedBackground: "rgba(124, 92, 255, 0.14)",
        selectedBackgroundStrong: "rgba(124, 92, 255, 0.24)",

        focusRing: "rgba(173, 150, 255, 0.52)",
        feedbackHalo: "rgba(124, 92, 255, 0.20)",

        disabled: neutralPalette.textDisabled,
    },

    spatial: {
        foreground: magentaPalette[500],
        foregroundStrong: magentaPalette[300],
        background: "rgba(255, 59, 212, 0.12)",
        backgroundStrong: "rgba(255, 59, 212, 0.22)",
        glow: "rgba(255, 59, 212, 0.24)",
    },

    frequency: {
        foreground: cyanPalette[500],
        foregroundStrong: cyanPalette[300],
        background: "rgba(46, 235, 255, 0.11)",
        backgroundStrong: "rgba(46, 235, 255, 0.20)",
        glow: "rgba(46, 235, 255, 0.22)",
    },

    pixel: {
        foreground: chartreusePalette[500],
        foregroundStrong: chartreusePalette[300],
        background: "rgba(183, 255, 60, 0.11)",
        backgroundStrong: "rgba(183, 255, 60, 0.20)",
        glow: "rgba(183, 255, 60, 0.24)",
    },

    overlay: {
        modal: neutralPalette.overlay,
    },

    stage: {
        background: neutralPalette.stage,
        frame: neutralPalette.surfaceRaised,
        shadow: elevation.panel,
    },
} as const;

export const blurLabSelection = {
    border: `2px solid ${blurLabColors.border.selected}`,

    ring: [
        `0 0 0 2px ${blurLabColors.border.selected}`,
        `0 0 0 6px ${blurLabColors.interaction.feedbackHalo}`,
    ].join(", "),

    focusRing: [
        "0 0 0 2px var(--blurlab-color-surface)",
        `0 0 0 6px ${blurLabColors.interaction.focusRing}`,
    ].join(", "),
} as const;

export const blurLabSpectrum = {
    gradient: [
        blurLabColors.interaction.primary,
        blurLabColors.frequency.foreground,
        blurLabColors.pixel.foreground,
        blurLabColors.spatial.foreground,
    ].join(", "),
} as const;
