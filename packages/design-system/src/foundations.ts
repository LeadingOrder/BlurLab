/**
 * Blur Lab design foundations.
 *
 * These values preserve Tessel's structural system—spacing, typography,
 * radii, touch targets, and motion—while replacing its light teal visual
 * language with Blur Lab's dark UV-spectrum identity.
 */

export const violetPalette = {
    50: "#f4f1ff",
    100: "#e5ddff",
    200: "#cbbcff",
    300: "#ad96ff",
    400: "#9274ff",
    500: "#7c5cff",
    600: "#6841f2",
    700: "#5531cf",
    800: "#462aa8",
    900: "#392582",
    950: "#21134f",
} as const;

export const cyanPalette = {
    50: "#eafbff",
    100: "#c9f8ff",
    200: "#96f1ff",
    300: "#63eaff",
    400: "#40e5ff",
    500: "#2eebff",
    600: "#12c6dc",
    700: "#089fb4",
    800: "#0b7f90",
    900: "#106775",
    950: "#063f49",
} as const;

export const magentaPalette = {
    50: "#fff0fb",
    100: "#ffd8f5",
    200: "#ffadeb",
    300: "#ff7fe2",
    400: "#ff58da",
    500: "#ff3bd4",
    600: "#e51fba",
    700: "#bd1699",
    800: "#961579",
    900: "#77155f",
    950: "#4a0739",
} as const;

export const chartreusePalette = {
    50: "#f7ffe9",
    100: "#ecffcb",
    200: "#dcff9e",
    300: "#cbff70",
    400: "#c0ff54",
    500: "#b7ff3c",
    600: "#94dc1e",
    700: "#72b112",
    800: "#598a12",
    900: "#486d15",
    950: "#263d06",
} as const;

export const spectralPalette = {
    primary: violetPalette[500],
    spatial: magentaPalette[500],
    frequency: cyanPalette[500],
    pixel: chartreusePalette[500],
} as const;

/**
 * Dark application colours.
 *
 * The image itself may contain pure black or white. Application surfaces use
 * slightly lifted blacks so borders, shadows, and translucent panels remain
 * visible against the workspace.
 */
export const neutralPalette = {
    appBackground: "#030305",
    surface: "#08090d",
    surfaceRaised: "#0f1118",
    surfaceStrong: "#151824",
    surfacePressed: "#1a1d2a",
    surfaceGlass: "rgba(15, 17, 24, 0.78)",

    stage: "#000000",

    textPrimary: "#f5f5fa",
    textSecondary: "#a2a4b2",
    textDisabled: "#656876",

    line: "rgba(255, 255, 255, 0.09)",
    lineStrong: "rgba(255, 255, 255, 0.16)",

    overlay: "rgba(0, 0, 0, 0.68)",
} as const;

export const typography = {
    family: {
        sans: [
            "\"Manrope\"",
            "-apple-system",
            "BlinkMacSystemFont",
            "\"Segoe UI\"",
            "sans-serif",
        ].join(", "),

        mono: [
            "\"SF Mono\"",
            "SFMono-Regular",
            "ui-monospace",
            "Menlo",
            "Monaco",
            "Consolas",
            "monospace",
        ].join(", "),
    },

    size: {
        caption: 13,
        body: 17,
        heading: 22,
        display: 32,
    },

    lineHeight: {
        caption: 20,
        body: 24,
        heading: 28,
        display: 40,
    },

    weight: {
        regular: 400,
        semibold: 600,
    },
} as const;

export const spacing = {
    micro: 4,
    tight: 8,
    normal: 16,
    section: 24,
    major: 32,
    large: 48,
    structural: 64,
} as const;

export const radius = {
    small: 8,
    control: 12,
    card: 16,
    sheet: 24,
    pill: 999,
} as const;

export const size = {
    touchTarget: 48,
    icon: 24,
    iconSmall: 20,

    topBarHeight: 64,
    navigationHeight: 64,

    selectionBorder: 2,
    selectionHalo: 4,
} as const;

export const elevation = {
    panel: "0 18px 50px rgba(0, 0, 0, 0.34)",
    floating: "0 12px 36px rgba(0, 0, 0, 0.46)",
    subtle: "0 6px 20px rgba(0, 0, 0, 0.28)",

    primaryGlow: [
        "0 0 10px rgba(124, 92, 255, 0.56)",
        "0 0 34px rgba(124, 92, 255, 0.30)",
    ].join(", "),
    spatialGlow: [
        "0 0 10px rgba(255, 59, 212, 0.52)",
        "0 0 34px rgba(255, 59, 212, 0.27)",
    ].join(", "),
    frequencyGlow: [
        "0 0 10px rgba(46, 235, 255, 0.50)",
        "0 0 34px rgba(46, 235, 255, 0.25)",
    ].join(", "),
    pixelGlow: [
        "0 0 9px rgba(183, 255, 60, 0.52)",
        "0 0 30px rgba(183, 255, 60, 0.26)",
    ].join(", "),
} as const;

export const motion = {
    duration: {
        press: 120,
        control: 180,
        panel: 240,
        canvas: 280,
        confirmation: 320,
    },

    easing: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        enter: "cubic-bezier(0, 0, 0.2, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
    },

    feedback: {
        pressedScale: 0.97,
        pressedOpacity: 0.88,
        selectedLift: -1,
    },
} as const;
