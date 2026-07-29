import {
    ActionIcon,
    Button,
    createTheme,
    Modal,
    Paper,
    rem,
    type CSSVariablesResolver,
    type MantineColorsTuple,
} from "@mantine/core";

import {
    chartreusePalette,
    cyanPalette,
    elevation,
    magentaPalette,
    motion,
    neutralPalette,
    radius,
    size,
    spacing,
    typography,
    violetPalette,
} from "./foundations";

import {
    blurLabColors,
    blurLabSelection,
    blurLabSpectrum,
} from "./semanticTokens";

function toMantineTuple(
    palette: Record<
        50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900,
        string
    >,
): MantineColorsTuple {
    return [
        palette[50],
        palette[100],
        palette[200],
        palette[300],
        palette[400],
        palette[500],
        palette[600],
        palette[700],
        palette[800],
        palette[900],
    ];
}

export const blurLabTheme = createTheme({
    primaryColor: "blurViolet",
    primaryShade: 5,

    colors: {
        blurViolet: toMantineTuple(violetPalette),
        blurCyan: toMantineTuple(cyanPalette),
        blurMagenta: toMantineTuple(magentaPalette),
        blurChartreuse: toMantineTuple(chartreusePalette),
    },

    white: neutralPalette.textPrimary,
    black: neutralPalette.appBackground,

    fontFamily: typography.family.sans,
    fontFamilyMonospace: typography.family.mono,

    fontSizes: {
        xs: rem(typography.size.caption),
        sm: rem(typography.size.caption),
        md: rem(typography.size.body),
        lg: rem(typography.size.heading),
        xl: rem(typography.size.display),
    },

    lineHeights: {
        xs: rem(typography.lineHeight.caption),
        sm: rem(typography.lineHeight.caption),
        md: rem(typography.lineHeight.body),
        lg: rem(typography.lineHeight.heading),
        xl: rem(typography.lineHeight.display),
    },

    headings: {
        fontFamily: typography.family.sans,
        fontWeight: String(typography.weight.semibold),

        sizes: {
            h1: {
                fontSize: rem(typography.size.display),
                lineHeight: rem(typography.lineHeight.display),
            },

            h2: {
                fontSize: rem(typography.size.heading),
                lineHeight: rem(typography.lineHeight.heading),
            },

            h3: {
                fontSize: rem(typography.size.body),
                lineHeight: rem(typography.lineHeight.body),
            },

            h4: {
                fontSize: rem(typography.size.body),
                lineHeight: rem(typography.lineHeight.body),
            },

            h5: {
                fontSize: rem(typography.size.caption),
                lineHeight: rem(typography.lineHeight.caption),
            },

            h6: {
                fontSize: rem(typography.size.caption),
                lineHeight: rem(typography.lineHeight.caption),
            },
        },
    },

    spacing: {
        xs: rem(spacing.tight),
        sm: rem(spacing.normal),
        md: rem(spacing.section),
        lg: rem(spacing.major),
        xl: rem(spacing.large),
    },

    radius: {
        xs: rem(radius.small),
        sm: rem(radius.control),
        md: rem(radius.card),
        lg: rem(radius.sheet),
        xl: rem(radius.sheet),
    },

    shadows: {
        xs: elevation.subtle,
        sm: elevation.floating,
        md: elevation.panel,
        lg: elevation.panel,
        xl: elevation.panel,
    },

    defaultRadius: "sm",
    focusRing: "auto",
    respectReducedMotion: true,
    cursorType: "pointer",

    components: {
        ActionIcon: ActionIcon.extend({
            defaultProps: {
                size: size.touchTarget,
                radius: "sm",
                variant: "subtle",
            },
        }),

        Button: Button.extend({
            defaultProps: {
                h: size.touchTarget,
                radius: "sm",
                fw: typography.weight.semibold,
            },
        }),

        Paper: Paper.extend({
            defaultProps: {
                radius: "md",
            },
        }),

        Modal: Modal.extend({
            defaultProps: {
                radius: "lg",
                centered: true,
            },
        }),
    },
});

export const blurLabCssVariablesResolver: CSSVariablesResolver = () => ({
    variables: {
        "--blurlab-color-app":
            blurLabColors.background.app,

        "--blurlab-color-surface":
            blurLabColors.background.surface,

        "--blurlab-color-surface-raised":
            blurLabColors.background.raised,

        "--blurlab-color-surface-strong":
            blurLabColors.background.strong,

        "--blurlab-color-surface-pressed":
            blurLabColors.background.pressed,

        "--blurlab-color-surface-glass":
            blurLabColors.background.glass,

        "--blurlab-color-stage":
            blurLabColors.background.stage,

        "--blurlab-color-ink":
            blurLabColors.text.primary,

        "--blurlab-color-ink-muted":
            blurLabColors.text.secondary,

        "--blurlab-color-ink-disabled":
            blurLabColors.text.disabled,

        "--blurlab-color-primary":
            blurLabColors.interaction.primary,

        "--blurlab-color-on-primary":
            blurLabColors.text.onPrimary,

        "--blurlab-color-primary-hover":
            blurLabColors.interaction.primaryHover,

        "--blurlab-color-primary-pressed":
            blurLabColors.interaction.primaryPressed,

        "--blurlab-color-selected":
            blurLabColors.interaction.selectedForeground,

        "--blurlab-color-selected-background":
            blurLabColors.interaction.selectedBackground,

        "--blurlab-color-selected-background-strong":
            blurLabColors.interaction.selectedBackgroundStrong,

        "--blurlab-color-line":
            blurLabColors.border.subtle,

        "--blurlab-color-line-strong":
            blurLabColors.border.strong,

        "--blurlab-color-spatial":
            blurLabColors.spatial.foreground,

        "--blurlab-color-spatial-strong":
            blurLabColors.spatial.foregroundStrong,

        "--blurlab-color-spatial-background":
            blurLabColors.spatial.background,

        "--blurlab-color-spatial-background-strong":
            blurLabColors.spatial.backgroundStrong,

        "--blurlab-color-spatial-glow":
            blurLabColors.spatial.glow,

        "--blurlab-color-frequency":
            blurLabColors.frequency.foreground,

        "--blurlab-color-frequency-strong":
            blurLabColors.frequency.foregroundStrong,

        "--blurlab-color-frequency-background":
            blurLabColors.frequency.background,

        "--blurlab-color-frequency-background-strong":
            blurLabColors.frequency.backgroundStrong,

        "--blurlab-color-frequency-glow":
            blurLabColors.frequency.glow,

        "--blurlab-color-pixel":
            blurLabColors.pixel.foreground,

        "--blurlab-color-pixel-strong":
            blurLabColors.pixel.foregroundStrong,

        "--blurlab-color-pixel-background":
            blurLabColors.pixel.background,

        "--blurlab-color-pixel-background-strong":
            blurLabColors.pixel.backgroundStrong,

        "--blurlab-color-pixel-glow":
            blurLabColors.pixel.glow,

        "--blurlab-gradient-spectrum":
            `linear-gradient(90deg, ${blurLabSpectrum.gradient})`,

        "--blurlab-font-family":
            typography.family.sans,

        "--blurlab-font-family-mono":
            typography.family.mono,

        "--blurlab-font-size-caption":
            rem(typography.size.caption),

        "--blurlab-font-size-body":
            rem(typography.size.body),

        "--blurlab-font-size-heading":
            rem(typography.size.heading),

        "--blurlab-font-size-display":
            rem(typography.size.display),

        "--blurlab-font-weight-regular":
            String(typography.weight.regular),

        "--blurlab-font-weight-semibold":
            String(typography.weight.semibold),

        "--blurlab-space-micro":
            rem(spacing.micro),

        "--blurlab-space-tight":
            rem(spacing.tight),

        "--blurlab-space-normal":
            rem(spacing.normal),

        "--blurlab-space-section":
            rem(spacing.section),

        "--blurlab-space-major":
            rem(spacing.major),

        "--blurlab-space-large":
            rem(spacing.large),

        "--blurlab-space-structural":
            rem(spacing.structural),

        "--blurlab-radius-small":
            rem(radius.small),

        "--blurlab-radius-control":
            rem(radius.control),

        "--blurlab-radius-card":
            rem(radius.card),

        "--blurlab-radius-sheet":
            rem(radius.sheet),

        "--blurlab-radius-pill":
            `${radius.pill}px`,

        "--blurlab-touch-target":
            rem(size.touchTarget),

        "--blurlab-shadow-panel":
            elevation.panel,

        "--blurlab-shadow-floating":
            elevation.floating,

        "--blurlab-shadow-subtle":
            elevation.subtle,

        "--blurlab-shadow-primary-glow":
            elevation.primaryGlow,

        "--blurlab-shadow-spatial-glow":
            elevation.spatialGlow,

        "--blurlab-shadow-frequency-glow":
            elevation.frequencyGlow,

        "--blurlab-shadow-pixel-glow":
            elevation.pixelGlow,

        "--blurlab-duration-press":
            `${motion.duration.press}ms`,

        "--blurlab-duration-control":
            `${motion.duration.control}ms`,

        "--blurlab-duration-panel":
            `${motion.duration.panel}ms`,

        "--blurlab-duration-canvas":
            `${motion.duration.canvas}ms`,

        "--blurlab-easing-standard":
            motion.easing.standard,

        "--blurlab-easing-enter":
            motion.easing.enter,

        "--blurlab-easing-exit":
            motion.easing.exit,

        "--blurlab-feedback-pressed-scale":
            String(motion.feedback.pressedScale),

        "--blurlab-feedback-pressed-opacity":
            String(motion.feedback.pressedOpacity),

        "--blurlab-selection-ring":
            blurLabSelection.ring,

        "--blurlab-focus-ring":
            blurLabSelection.focusRing,
    },

    light: {},
    dark: {},
});
