import {
    useEffect,
    useMemo,
    useRef,
} from "react";

import {
    createTeachingPattern,
    type TeachingPatternId,
} from "@blurlab/engine";

import styles from "./TeachingSourcePicker.module.css";
import { teachingSources } from "./teachingSources";

function PatternThumbnail({
    id,
}: {
    id: TeachingPatternId;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const preview = useMemo(
        () => createTeachingPattern(id, 64),
        [id],
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (canvas === null || context === null || context === undefined) {
            return;
        }

        canvas.width = preview.width;
        canvas.height = preview.height;
        context.putImageData(
            new ImageData(
                new Uint8ClampedArray(preview.data),
                preview.width,
                preview.height,
            ),
            0,
            0,
        );
    }, [preview]);

    return <canvas ref={canvasRef} aria-hidden="true" />;
}

function TeachingSourceOptions({
    activeId,
    onSelect,
    onAfterSelect,
}: {
    activeId: TeachingPatternId | null;
    onSelect: (id: TeachingPatternId) => void;
    onAfterSelect?: () => void;
}) {
    return teachingSources.map((source) => (
        <button
            key={source.id}
            className={styles.option}
            type="button"
            data-selected={activeId === source.id}
            aria-pressed={activeId === source.id}
            onClick={() => {
                onSelect(source.id);
                onAfterSelect?.();
            }}
        >
            <PatternThumbnail id={source.id} />
            <strong>{source.label}</strong>
            <span>{source.detail}</span>
        </button>
    ));
}

export function TeachingSourcePicker({
    activeId,
    onSelect,
}: {
    activeId: TeachingPatternId | null;
    onSelect: (id: TeachingPatternId) => void;
}) {
    const detailsRef = useRef<HTMLDetailsElement>(null);

    return (
        <details
            ref={detailsRef}
            className={styles.picker}
            data-has-active-example={activeId !== null}
        >
            <summary>Example Images</summary>
            <div className={styles.popover}>
                <div className={styles.popoverHeader}>
                    <strong>Example Images</strong>
                    <span>exact · generated locally</span>
                </div>
                <div className={styles.options}>
                    <TeachingSourceOptions
                        activeId={activeId}
                        onSelect={onSelect}
                        onAfterSelect={() => {
                            if (detailsRef.current !== null) {
                                detailsRef.current.open = false;
                            }
                        }}
                    />
                </div>
            </div>
        </details>
    );
}

export function TeachingSourceGrid({
    onSelect,
}: {
    onSelect: (id: TeachingPatternId) => void;
}) {
    return (
        <div
            className={styles.emptyGrid}
            aria-label="Example Images"
        >
            <TeachingSourceOptions
                activeId={null}
                onSelect={onSelect}
            />
        </div>
    );
}
