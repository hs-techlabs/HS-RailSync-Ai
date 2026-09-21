import { useEffect, useRef } from 'react';
import { CorridorStrip as Core } from './strip';
import type { CorridorStripOptions } from './types';
import './styles.css';

export interface CorridorStripProps extends CorridorStripOptions {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Thin wrapper: the core owns the DOM and every frame, so React's only jobs
 * are to mount it once and push option changes through `update()`.
 *
 * Callbacks are read through a ref, so passing an inline `onSelect` does not
 * tear the strip down on every render.
 */
export function CorridorStrip({ className, style, ...options }: CorridorStripProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<Core | null>(null);
  const cbRef = useRef(options);
  cbRef.current = options;

  useEffect(() => {
    if (!hostRef.current) return;
    const core = new Core(hostRef.current, {
      ...cbRef.current,
      onSelect: (m) => cbRef.current.onSelect?.(m),
      onHover: (t) => cbRef.current.onHover?.(t),
    });
    coreRef.current = core;
    return () => {
      core.destroy();
      coreRef.current = null;
    };
    // Mount once; everything else flows through update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    coreRef.current?.update({
      stations: options.stations,
      markers: options.markers,
      totalKm: options.totalKm,
      label: options.label,
      height: options.height,
      magnify: options.magnify,
      bands: options.bands,
      ruler: options.ruler,
      card: options.card,
    });
  }, [
    options.stations,
    options.markers,
    options.totalKm,
    options.label,
    options.height,
    options.magnify,
    options.bands,
    options.ruler,
    options.card,
  ]);

  return <div ref={hostRef} className={className} style={style} />;
}

export type {
  CorridorStripOptions,
  HoverTarget,
  Marker,
  MarkerStatus,
  Priority,
  Station,
  TrackId,
} from './types';
