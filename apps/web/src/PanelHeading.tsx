import type { ReactNode } from "react";

import styles from "./App.module.css";

export function ExpandButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            className={styles.expandButton}
            type="button"
            aria-label={`Open ${label} in presentation view`}
            title={`Present ${label}`}
            onClick={onClick}
        >
            <span
                className={styles.expandGlyph}
                aria-hidden="true"
            >
                <span />
                <span />
                <span />
                <span />
            </span>
        </button>
    );
}

export function PanelHeading({
    eyebrow,
    title,
    accent,
    aside,
    onExpand,
}: {
    eyebrow: string;
    title: string;
    accent: "primary" | "spatial" | "pixel" | "frequency";
    aside?: ReactNode;
    onExpand?: () => void;
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
            {(aside !== undefined || onExpand !== undefined) && (
                <div className={styles.panelHeadingActions}>
                    {aside}
                    {onExpand !== undefined && (
                        <ExpandButton
                            label={title}
                            onClick={onExpand}
                        />
                    )}
                </div>
            )}
        </header>
    );
}
