import { useId } from "react";

type BlurLabLogoProps = {
    className?: string;
    decorative?: boolean;
};

/**
 * Inline version of the Blur Lab kernel mark.
 *
 * Every visual group exposes a stable `data-layer` name and every kernel
 * sample exposes a stable `data-cell` name, so future motion can target
 * whole weight classes or individual samples without changing the SVG.
 */
export function BlurLabLogo({
    className,
    decorative = false,
}: BlurLabLogoProps) {
    const instanceId = useId().replaceAll(":", "");
    const ids = {
        tileFill: `${instanceId}-tile-fill`,
        violetMagenta: `${instanceId}-violet-magenta`,
        cyanViolet: `${instanceId}-cyan-violet`,
        centreFill: `${instanceId}-centre-fill`,
        centreHighlight: `${instanceId}-centre-highlight`,
        cellGlow: `${instanceId}-cell-glow`,
        centreGlow: `${instanceId}-centre-glow`,
        title: `${instanceId}-title`,
        description: `${instanceId}-description`,
    };

    return (
        <svg
            className={className}
            viewBox="0 0 512 512"
            role={decorative ? undefined : "img"}
            aria-hidden={decorative || undefined}
            aria-labelledby={
                decorative
                    ? undefined
                    : `${ids.title} ${ids.description}`
            }
            focusable="false"
        >
            {!decorative && (
                <>
                    <title id={ids.title}>
                        Blur Lab convolution-kernel logo
                    </title>
                    <desc id={ids.description}>
                        A three-by-three blur kernel whose weights glow
                        outward from a bright centre sample.
                    </desc>
                </>
            )}

            <defs>
                <linearGradient
                    id={ids.tileFill}
                    x1="76"
                    y1="58"
                    x2="436"
                    y2="466"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#10121B" />
                    <stop offset="1" stopColor="#06070B" />
                </linearGradient>
                <linearGradient
                    id={ids.violetMagenta}
                    x1="130"
                    y1="130"
                    x2="382"
                    y2="382"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#7C5CFF" />
                    <stop offset="1" stopColor="#FF3BD4" />
                </linearGradient>
                <linearGradient
                    id={ids.cyanViolet}
                    x1="166"
                    y1="130"
                    x2="346"
                    y2="382"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#2EEBFF" />
                    <stop offset="1" stopColor="#7C5CFF" />
                </linearGradient>
                <radialGradient
                    id={ids.centreFill}
                    cx="0"
                    cy="0"
                    r="1"
                    gradientTransform="translate(244 238) rotate(48.2) scale(88.3)"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#F7FFE9" />
                    <stop offset="0.22" stopColor="#DCFF9E" />
                    <stop offset="1" stopColor="#B7FF3C" />
                </radialGradient>
                <linearGradient
                    id={ids.centreHighlight}
                    x1="236"
                    y1="228"
                    x2="272"
                    y2="274"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#FFFFFF" stopOpacity="0.72" />
                    <stop
                        offset="1"
                        stopColor="#FFFFFF"
                        stopOpacity="0"
                    />
                </linearGradient>
                <filter
                    id={ids.cellGlow}
                    x="-90%"
                    y="-90%"
                    width="280%"
                    height="280%"
                    colorInterpolationFilters="sRGB"
                >
                    <feGaussianBlur stdDeviation="15" />
                </filter>
                <filter
                    id={ids.centreGlow}
                    x="-110%"
                    y="-110%"
                    width="320%"
                    height="320%"
                    colorInterpolationFilters="sRGB"
                >
                    <feGaussianBlur stdDeviation="22" />
                </filter>
            </defs>

            <g data-layer="background">
                <rect
                    x="40"
                    y="40"
                    width="432"
                    height="432"
                    rx="120"
                    fill="#030305"
                />
                <rect
                    x="40.5"
                    y="40.5"
                    width="431"
                    height="431"
                    rx="119.5"
                    fill={`url(#${ids.tileFill})`}
                    stroke="#7C5CFF"
                    strokeOpacity="0.28"
                />
            </g>

            <g
                data-layer="glow"
                filter={`url(#${ids.cellGlow})`}
                opacity="0.68"
            >
                <rect data-cell="north-west" x="130" y="130" width="72" height="72" rx="22" fill="#FF3BD4" />
                <rect data-cell="north" x="220" y="130" width="72" height="72" rx="22" fill="#7C5CFF" />
                <rect data-cell="north-east" x="310" y="130" width="72" height="72" rx="22" fill="#FF3BD4" />
                <rect data-cell="west" x="130" y="220" width="72" height="72" rx="22" fill="#2EEBFF" />
                <rect data-cell="east" x="310" y="220" width="72" height="72" rx="22" fill="#2EEBFF" />
                <rect data-cell="south-west" x="130" y="310" width="72" height="72" rx="22" fill="#FF3BD4" />
                <rect data-cell="south" x="220" y="310" width="72" height="72" rx="22" fill="#7C5CFF" />
                <rect data-cell="south-east" x="310" y="310" width="72" height="72" rx="22" fill="#FF3BD4" />
            </g>

            <g
                data-layer="centre-glow"
                filter={`url(#${ids.centreGlow})`}
                opacity="0.66"
            >
                <rect x="220" y="220" width="72" height="72" rx="22" fill="#B7FF3C" />
            </g>

            <g data-layer="corner-cells">
                <rect data-cell="north-west" x="130" y="130" width="72" height="72" rx="22" fill={`url(#${ids.violetMagenta})`} />
                <rect data-cell="north-east" x="310" y="130" width="72" height="72" rx="22" fill={`url(#${ids.violetMagenta})`} />
                <rect data-cell="south-west" x="130" y="310" width="72" height="72" rx="22" fill={`url(#${ids.violetMagenta})`} />
                <rect data-cell="south-east" x="310" y="310" width="72" height="72" rx="22" fill={`url(#${ids.violetMagenta})`} />
            </g>

            <g data-layer="edge-cells">
                <rect data-cell="north" x="220" y="130" width="72" height="72" rx="22" fill={`url(#${ids.cyanViolet})`} />
                <rect data-cell="west" x="130" y="220" width="72" height="72" rx="22" fill={`url(#${ids.cyanViolet})`} />
                <rect data-cell="east" x="310" y="220" width="72" height="72" rx="22" fill={`url(#${ids.cyanViolet})`} />
                <rect data-cell="south" x="220" y="310" width="72" height="72" rx="22" fill={`url(#${ids.cyanViolet})`} />
            </g>

            <g data-layer="centre-cell">
                <rect data-cell="centre" x="220" y="220" width="72" height="72" rx="22" fill={`url(#${ids.centreFill})`} />
            </g>

            <g data-layer="centre-highlight" opacity="0.75">
                <path
                    d="M236 231C246 223 265 222 277 230C265 228 250 231 241 241C235 248 232 258 233 270C226 255 227 239 236 231Z"
                    fill={`url(#${ids.centreHighlight})`}
                />
            </g>
        </svg>
    );
}
