import './styles.css';

export { CorridorStrip, createCorridorStrip } from './strip';
export { createCorridorStrip as create } from './strip';
export { HoverCard, MARKER_CARD_W, STATION_CARD_W } from './card';
export { makeLens, lensMap, lensInverse, damp } from './lens';
export type { Lens } from './lens';
export type {
  CorridorStripOptions,
  HoverTarget,
  Marker,
  MarkerStatus,
  Priority,
  Station,
  TrackId,
} from './types';

export const VERSION = '1.0.0';
