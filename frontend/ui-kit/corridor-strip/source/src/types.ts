export type TrackId = 'UP' | 'DN';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Lifecycle of a block request as the OCC sees it. Drives the dot treatment. */
export type MarkerStatus =
  | 'EXECUTING'
  | 'SANCTIONED'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Station {
  code: string;
  name: string;
  /** Chainage from the corridor origin. */
  km: number;
  platforms: number;
  division?: string;
  speedLimit?: number;
  depots?: string[];
}

export interface Marker {
  id: string;
  line: TrackId;
  kmStart: number;
  kmEnd: number;
  priority: Priority;
  status: MarkerStatus;

  /** Everything below is card content only — none of it affects the plot. */
  kind?: string;
  dept?: string;
  deptLabel?: string;
  defect?: string;
  asset?: string;
  section?: string;
  crew?: string;
  machine?: string;
  durationMin?: number;
  powerBlock?: boolean;
  disconnection?: boolean;
  note?: string;
  failurePct?: number | null;
  window?: string;
  memo?: string | null;
  /** 0..1. Only meaningful while EXECUTING (or 1 once COMPLETED). */
  progress?: number;
  attachments?: number;
}

/** What the strip resolved under the cursor, if anything. */
export type HoverTarget =
  | { type: 'marker'; marker: Marker }
  | { type: 'station'; station: Station }
  | null;

export interface CorridorStripOptions {
  stations: Station[];
  markers: Marker[];
  /** Corridor length. Chainages are plotted against this. */
  totalKm: number;
  /** Shown at the left of the meta rail. */
  label?: string;
  /** Total strip height. 108 fits the 12px station codes without bulking out. */
  height?: number;
  /** Peak scale directly under the cursor. 1 disables the lens. */
  magnify?: number;
  /** Alternating tint between consecutive stations. */
  bands?: boolean;
  /** Set false to drop the km ruler and save 15px. */
  ruler?: boolean;
  /** Set false to suppress the built-in hover card and drive your own from onHover. */
  card?: boolean;
  /** Fires when a dot is clicked (pinned), and with null on release. */
  onSelect?: (marker: Marker | null) => void;
  /** Fires whenever the resolved hover target changes. */
  onHover?: (target: HoverTarget) => void;
}
