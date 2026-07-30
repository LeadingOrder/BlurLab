import {
    useEffect,
    useRef,
    type ReactNode,
} from "react";

import styles from "./FullscreenPanel.module.css";

export type ExpandedPanel =
    | "image"
    | "blur"
    | "kernel"
    | "pixels"
    | "fourier";

export function FullscreenPanel({
    panel,
    title,
    onClose,
    children,
}: {
    panel: ExpandedPanel;
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const dialog = dialogRef.current;

        if (dialog === null) {
            return;
        }

        returnFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        dialog.showModal();

        return () => {
            if (dialog.open) {
                dialog.close();
            }

            returnFocusRef.current?.focus();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-label={`${title} presentation`}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className={styles.shell}>
                <header className={styles.toolbar}>
                    <div>
                        <span>Presentation view</span>
                        <strong>{title}</strong>
                    </div>
                    <button
                        className={styles.closeButton}
                        type="button"
                        autoFocus
                        onClick={onClose}
                    >
                        Close
                    </button>
                </header>
                <div
                    className={styles.content}
                    data-panel={panel}
                >
                    {children}
                </div>
            </div>
        </dialog>
    );
}
