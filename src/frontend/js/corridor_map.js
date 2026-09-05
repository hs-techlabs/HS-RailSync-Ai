/**
 * Corridor Map Service - drop-in dual-track geospatial map.
 *
 * One implementation shared by the Central OCC desk and the three department
 * portals. A page mounts it with:
 *
 *     CorridorMap.mount("#corridor-map", {
 *         department: "ENGINEERING_TRACK",
 *         layers: ["issues", "blocks", "routines"],
 *         onInspect: openBlockRequestForm
 *     });
 *
 * Everything else - geometry, polling, marker lifecycle, popups - is handled
 * here. The module is namespaced and holds all state per instance, so more than
 * one map can live on a page.
 *
 * THE UP/DN OFFSET
 * The API returns the corridor CENTRELINE plus a bearing at each vertex, never
 * pre-offset coordinates. The two rails are computed here, per render, from the
 * current zoom: 5 metres of real track spacing is invisible at zoom 8 and
 * correct at zoom 17, so the separation has to be a screen-space decision. We
 * hold it at ~6 px and clamp the resulting metres, which keeps two clearly
 * distinct lines on the corridor overview and converges on realistic spacing as
 * you zoom into a section.
 */

const CorridorMap = (function () {
    "use strict";

    const API = {
        geometry: "/api/map/geometry",
        layers: "/api/map/layers",
        trains: "/api/map/trains"
    };

    const TILES = {
        satellite: {
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attribution: '&copy; <a href="https://www.esri.com/">ESRI</a> World Imagery &bull; Indian Railways RTIS',
            maxZoom: 18
        },
        dark: {
            url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            attribution: '&copy; <a href="https://carto.com/">CARTO</a> Dark Matter &bull; OpenStreetMap',
            maxZoom: 19
        }
    };

    // Rail styling, matched to the CTC schematic legend in network_map.js so the
    // two views of the corridor never disagree about which colour is which line.
    const RAIL = {
        DN: { color: "#2563eb", label: "DN Line (to Kanpur)" },
        UP: { color: "#4f46e5", label: "UP Line (to New Delhi)" }
    };

    const SEVERITY_COLOR = {
        CRITICAL: "#dc2626",
        HIGH: "#d97706",
        MEDIUM: "#2563eb",
        LOW: "#059669"
    };

    const LAYER_META = {
        issues:    { label: "Reported Issues",  glyph: "!",  color: "#dc2626", kind: "point" },
        blocks:    { label: "Current Blocks",   glyph: "B",  color: "#7c3aed", kind: "span"  },
        powercuts: { label: "Power Cuts",       glyph: "P",  color: "#d97706", kind: "span"  },
        routines:  { label: "Routine Checks",   glyph: "R",  color: "#0891b2", kind: "point" },
        assets:    { label: "Asset Wear",       glyph: "W",  color: "#b45309", kind: "point" },
        health:    { label: "Track Health",     glyph: "H",  color: "#059669", kind: "span"  },
        trains:    { label: "Live Trains",      glyph: "T",  color: "#7c3aed", kind: "train" }
    };

    const EARTH_C = 156543.03392;   // metres per pixel at zoom 0 on the equator
    const TARGET_OFFSET_PX = 6;     // half-separation between the two rails

    // The clamp exists so the exaggeration cannot run away at either extreme.
    // The ceiling has to clear a whole-corridor view (~770 m/px at zoom 7.5) or
    // the two rails collapse back into one line at exactly the zoom the operator
    // opens the map at, which is the thing this map exists to avoid. 5 km of
    // apparent separation there is a deliberate schematic exaggeration; by
    // zoom 13 the clamp is no longer binding and the spacing is real.
    const MIN_OFFSET_M = 3;
    const MAX_OFFSET_M = 5000;

    let geometryCache = null;       // shared: the corridor never differs per instance
    const instances = [];

    // -----------------------------------------------------------------------
    // Geometry helpers
    // -----------------------------------------------------------------------

    /** Ground resolution in metres per pixel at a given zoom and latitude. */
    function metresPerPixel(lat, zoom) {
        return EARTH_C * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    }

    /**
     * How far off the centreline each rail should sit, in metres, so that the
     * pair reads as ~2 x TARGET_OFFSET_PX apart on screen at this zoom.
     */
    function offsetMetres(map) {
        const lat = map.getCenter().lat;
        const raw = TARGET_OFFSET_PX * metresPerPixel(lat, map.getZoom());
        return Math.min(MAX_OFFSET_M, Math.max(MIN_OFFSET_M, raw));
    }

    /** Moves a point `distance` metres along `bearing` degrees. Spherical. */
    function destination(lat, lng, bearing, distance) {
        const R = 6371008.8;
        const d = distance / R;
        const br = bearing * Math.PI / 180;
        const p1 = lat * Math.PI / 180;
        const l1 = lng * Math.PI / 180;

        const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br));
        const l2 = l1 + Math.atan2(
            Math.sin(br) * Math.sin(d) * Math.cos(p1),
            Math.cos(d) - Math.sin(p1) * Math.sin(p2)
        );
        return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI) + 540) % 360 - 180];
    }

    /**
     * Offsets a point onto one rail of the pair.
     * DN sits right of the NDLS->CNB bearing, UP sits left - the same convention
     * the server publishes in geometry.track_sides.
     */
    function railPoint(pt, line, metres) {
        const side = String(line).toUpperCase() === "UP" ? -1 : 1;
        if (String(line).toUpperCase() === "YARD") return [pt.lat, pt.lng];
        return destination(pt.lat, pt.lng, pt.bearing + 90 * side, metres);
    }

    function railPath(path, line, metres) {
        return path.map(p => railPoint(p, line, metres));
    }

    // -----------------------------------------------------------------------
    // Rendering helpers
    // -----------------------------------------------------------------------

    function esc(v) {
        return String(v === null || v === undefined ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function severityColor(sev) {
        return SEVERITY_COLOR[String(sev || "").toUpperCase()] || "#64748b";
    }

    /**
     * Flips a marker's tooltip below the pin when there is not enough room
     * above it.
     *
     * Leaflet fixes a tooltip's direction at bind time and never flips it, so a
     * card anchored above a marker near the top of the map is clipped by the
     * map's own edge - and on this corridor the markers sit wherever the rail
     * does, which is often near the top.
     *
     * This runs on `tooltipopen` rather than `mouseover` because Leaflet's own
     * open handler is registered by bindTooltip and would otherwise win the
     * race. By open time the element exists, so the decision uses the card's
     * real height instead of guessing from a fraction of the viewport.
     */
    function flipTooltipToFit(map, marker, gap) {
        marker.on("tooltipopen", function (e) {
            const tip = e.tooltip;
            const el = tip.getElement();
            const y = map.latLngToContainerPoint(marker.getLatLng()).y;
            const needed = (el ? el.offsetHeight : 200) + gap + 8;

            const direction = y < needed ? "bottom" : "top";
            if (tip.options.direction === direction) return;

            tip.options.direction = direction;
            tip.options.offset = direction === "bottom" ? [0, gap] : [0, -gap];
            tip.update();
        });
    }

    function row(key, value) {
        if (value === null || value === undefined || value === "") return "";
        return `<span class="cmap-card-key">${esc(key)}</span>
                <span class="cmap-card-val">${esc(value)}</span>`;
    }

    /**
     * Joins detail rows, keeping only the first `limit` populated ones.
     *
     * The compact hover card is capped at three rows for a reason: a tooltip
     * cannot flip past the edge it is already touching, so once the card grows
     * past half the canvas height there is no direction that fits and markers
     * in the middle of the map get clipped either way. Three rows keeps every
     * card comfortably under that ceiling; the full set is one click away.
     */
    function joinRows(rows, limit) {
        const populated = rows.filter(Boolean);
        return (limit ? populated.slice(0, limit) : populated).join("");
    }

    /** Attachment thumbnails. Reuses the portal's lightbox when it is present. */
    function attachmentsHtml(atts) {
        if (!atts || !atts.length) return "";
        const canOpen = typeof window.openAttachmentModal === "function";
        const thumbs = atts.map(a => {
            const click = canOpen
                ? `onclick="openAttachmentModal('${esc(a.url)}','${esc(a.type)}','${esc(a.filename)}')"`
                : `onclick="window.open('${esc(a.url)}','_blank')"`;
            return a.type === "image"
                ? `<img class="cmap-att" src="${esc(a.url)}" alt="${esc(a.filename)}" ${click}>`
                : `<div class="cmap-att cmap-att-pdf" title="${esc(a.filename)}" ${click}>&#128196;</div>`;
        }).join("");
        return `<div class="cmap-card-atts">${thumbs}</div>`;
    }

    /**
     * Builds the hover/click card for one feature.
     *
     * Layer-specific rows are chosen here rather than server-side so the card
     * speaks each department's own language - wire wear for OHE, due dates for
     * routines, a per-system table for S&T health.
     */
    function cardHtml(f, opts, compact) {
        const d = f.detail || {};
        let rows = "";
        let extra = "";

        // Rows are ordered most-important-first: the compact hover card keeps
        // only the leading three, so the first entries in each list are what an
        // officer sees at a glance.
        const limit = compact ? 3 : 0;

        if (f.layer === "issues") {
            rows = joinRows([
                row("Location", `${d.section_label || f.subtitle}`),
                row("Chainage", `KM ${Number(f.km_start).toFixed(1)} (${f.line})`),
                row("Duration", d.duration_requested_min ? `${d.duration_requested_min} min` : null),
                row("Machine", d.machine_required !== "NONE" ? d.machine_required : null),
                row("Reported by", d.submitted_by)
            ], limit);
            extra = (d.description ? `<div class="cmap-card-desc">${esc(d.description)}</div>` : "")
                  + attachmentsHtml(d.attachments);

        } else if (f.layer === "blocks" || f.layer === "powercuts") {
            rows = joinRows([
                row("Section", `${d.section} (${f.line})`),
                row("Window", d.sanctioned_window),
                row("Status", (d.status || "").replace(/_/g, " ")),
                row("Day", d.window_day_label),
                row("Progress", d.status === "IN_PROGRESS" ? `${d.progress_pct}%` : null),
                row("Department", (d.department_label || "").replace(/\s*\(.*\)/, ""))
            ], limit);

        } else if (f.layer === "routines") {
            rows = joinRows([
                row(d.is_overdue ? "Overdue by" : "Due in", `${Math.abs(d.due_in_days)} days`),
                row("Due date", d.due_date),
                row("Chainage", `KM ${Number(f.km_start).toFixed(1)} (${f.line})`),
                row("Asset", d.asset_id),
                row("Section", d.section),
                row("Periodicity", `${d.periodicity_days} days`),
                row("Last done", `${d.days_since_last_maintenance} days ago`),
                row("Est. duration", `${d.estimated_duration_min} min`)
            ], limit);

        } else if (f.layer === "assets") {
            rows = joinRows([
                row("Condition", d.wear_state),
                row("Measure", d.wear_metric),
                row("Remaining life", `${d.predicted_rul_days} days`),
                row("Asset", d.asset_id),
                row("Failure risk", `${d.failure_percentage}%`),
                row("Health index", d.health_index),
                row("Attention", d.attention_window === "NOW" ? "Required now" : "Near term"),
                row("Nearest", d.nearest_station)
            ], limit);

        } else if (f.layer === "health") {
            rows = joinRows([
                row("Section", d.section),
                row("Health index", d.health_index),
                row("At risk", `${d.at_risk_count} of ${d.asset_count} assets`),
                row("Length", `${d.length_km} KM`),
                row("Weakest", d.weakest_system)
            ], limit);
            const body = (d.systems || []).map(s => `
                <tr>
                    <td>${esc(s.system)}</td>
                    <td>${esc(s.asset_count)}</td>
                    <td>${esc(s.at_risk_count)}</td>
                    <td><span class="cmap-health-pill" style="background:${severityColor(s.grade)}">
                        ${esc(s.health_index)}</span></td>
                </tr>`).join("");
            extra = `<table class="cmap-health-table">
                        <thead><tr><th>System</th><th>Assets</th><th>Risk</th><th>Health</th></tr></thead>
                        <tbody>${body}</tbody>
                     </table>`;

        } else if (f.layer === "trains") {
            rows = joinRows([
                row("State", d.state === "HALTED" ? `Halted at ${d.from_station}` : `Running at ${d.speed_kmph} km/h`),
                row("Next stop", d.next_station),
                row("Chainage", `KM ${d.km} (${d.line})`),
                row("Class", d.class_label),
                row("Train", `${d.train_number} ${d.train_name}`)
            ], limit);
        }

        const flags = [];
        if (d.power_block_required) flags.push(`<span class="cmap-flag is-power">25 kV power block</span>`);
        if (d.disconnection_required) flags.push(`<span class="cmap-flag is-disc">S&amp;T disconnection</span>`);
        const flagHtml = flags.length ? `<div class="cmap-card-flags">${flags.join("")}</div>` : "";

        // Hover is a glance, click is the full record.
        //
        // A Leaflet tooltip is anchored above its marker and cannot flip, so a
        // tall card is clipped by the top edge of the map for any marker in the
        // upper half - and every marker on this corridor is somewhere near the
        // line, not conveniently low. The compact variant therefore drops the
        // evidence strip and the action bar, both of which belong to the popup:
        // popups auto-pan themselves into view, so the full card is always
        // readable there, and attachments need a click to be useful anyway.
        if (compact) {
            return `
                <div class="cmap-card is-compact">
                    <div class="cmap-card-head">
                        <div>
                            <h4 class="cmap-card-title">${esc(f.title)}</h4>
                            <span class="cmap-card-sub">${esc(f.subtitle)}</span>
                        </div>
                        <span class="cmap-card-sev" style="background:${severityColor(f.severity)}">
                            ${esc(f.severity)}
                        </span>
                    </div>
                    <div class="cmap-card-body">
                        <div class="cmap-card-rows">${rows}</div>
                        ${flagHtml}
                        <div class="cmap-card-hint">Click for evidence and actions</div>
                    </div>
                </div>`;
        }

        // Only a live field report can be turned into a block request.
        const canInspect = f.layer === "issues" && typeof opts.onInspect === "function";
        const actions = canInspect
            ? `<div class="cmap-card-actions">
                   <button class="cmap-action is-primary"
                           onclick="CorridorMap._inspect('${esc(opts.instanceId)}','${esc(f.id)}')">
                       Inspect &amp; Raise Block
                   </button>
               </div>`
            : "";

        return `
            <div class="cmap-card">
                <div class="cmap-card-head">
                    <div>
                        <h4 class="cmap-card-title">${esc(f.title)}</h4>
                        <span class="cmap-card-sub">${esc(f.subtitle)}</span>
                    </div>
                    <span class="cmap-card-sev" style="background:${severityColor(f.severity)}">
                        ${esc(f.severity)}
                    </span>
                </div>
                <div class="cmap-card-body">
                    <div class="cmap-card-rows">${rows}</div>
                    ${flagHtml}
                    ${extra}
                </div>
                ${actions}
            </div>`;
    }

    // -----------------------------------------------------------------------
    // Instance
    // -----------------------------------------------------------------------

    function CorridorMapInstance(container, options) {
        this.id = "cmap-" + instances.length;
        this.container = container;
        this.opts = Object.assign({
            department: "ALL",
            layers: null,          // null -> the department's server-side preset
            basemap: "satellite",
            pollMs: 5000,
            trainPollMs: 2000,
            tall: false,
            showTrains: false,
            onInspect: null
        }, options || {});

        this.opts.instanceId = this.id;
        this.map = null;
        this.tileLayer = null;
        this.geometry = null;
        this.activeLayers = new Set();
        this.featureData = {};      // layer -> [feature]
        this.featureIndex = {};     // feature id -> feature
        this.layerGroups = {};      // layer -> L.featureGroup
        this.railGroup = null;
        this.stationGroup = null;
        this.trainMarkers = {};     // train id -> L.marker, reused so motion is smooth
        this.timers = [];
    }

    CorridorMapInstance.prototype.boot = async function () {
        this.buildChrome();

        try {
            if (!geometryCache) {
                const res = await fetch(API.geometry);
                geometryCache = await res.json();
            }
            this.geometry = geometryCache;
        } catch (err) {
            this.setStatus("Corridor geometry unavailable");
            console.error("[CorridorMap] geometry failed:", err);
            return;
        }

        this.initMap();
        this.drawRails();
        this.drawStations();
        this.buildChips();
        this.fitCorridor();

        await this.refresh();
        this.startPolling();
        this.setStatus(null);
    };

    /** Builds the toolbar, canvas, chip rail and legend around the map. */
    CorridorMapInstance.prototype.buildChrome = function () {
        const wanted = this.opts.layers
            || (this.geometry ? null : null)
            || ["issues"];   // replaced after the first refresh reveals the preset

        this.container.classList.add("cmap-shell");
        this.container.innerHTML = `
            <div class="cmap-toolbar">
                <div class="cmap-toolbar-group" data-role="basemaps">
                    <button class="cmap-btn is-active" data-basemap="satellite">Satellite</button>
                    <button class="cmap-btn" data-basemap="dark">Dark GIS</button>
                </div>
                <div class="cmap-toolbar-sep"></div>
                <div class="cmap-toolbar-group" data-role="layers"></div>
                <div class="cmap-toolbar-sep"></div>
                <button class="cmap-btn" data-role="fit">Fit Corridor</button>
            </div>
            <div class="cmap-chip-rail" data-role="chips"></div>
            <div class="cmap-canvas${this.opts.tall ? " is-tall" : ""}" data-role="canvas"></div>
            <div class="cmap-legend" data-role="legend"></div>
            <div class="cmap-status" data-role="status">Loading corridor&hellip;</div>
        `;

        const self = this;
        this.container.querySelectorAll("[data-basemap]").forEach(btn => {
            btn.addEventListener("click", () => self.setBasemap(btn.dataset.basemap));
        });
        this.container.querySelector("[data-role=fit]")
            .addEventListener("click", () => self.fitCorridor());

        void wanted;
    };

    CorridorMapInstance.prototype.setStatus = function (text) {
        const el = this.container.querySelector("[data-role=status]");
        if (!el) return;
        if (!text) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = text;
    };

    CorridorMapInstance.prototype.initMap = function () {
        const canvas = this.container.querySelector("[data-role=canvas]");
        const self = this;

        this.map = L.map(canvas, {
            center: [27.55, 78.8],
            zoom: 8,
            zoomSnap: 0.5,
            scrollWheelZoom: false,      // don't hijack page scroll
            attributionControl: true
        });

        this.setBasemap(this.opts.basemap);

        this.railGroup = L.featureGroup().addTo(this.map);
        this.stationGroup = L.featureGroup().addTo(this.map);

        // The rails and every marker are offset in screen space, so they must be
        // recomputed whenever the zoom changes.
        this.map.on("zoomend", () => {
            self.drawRails();
            self.renderAllLayers();
            self.renderTrains(self.featureData.trains || []);
        });

        this.map.on("click", () => self.map.scrollWheelZoom.enable());
    };

    CorridorMapInstance.prototype.setBasemap = function (mode) {
        const cfg = TILES[mode];
        if (!cfg || !this.map) return;

        if (this.tileLayer) this.map.removeLayer(this.tileLayer);
        this.tileLayer = L.tileLayer(cfg.url, {
            attribution: cfg.attribution,
            maxZoom: cfg.maxZoom
        }).addTo(this.map);

        this.container.querySelectorAll("[data-basemap]").forEach(b => {
            b.classList.toggle("is-active", b.dataset.basemap === mode);
        });

        // Tiles are added on top of existing panes; push the corridor back up.
        if (this.railGroup) this.railGroup.bringToFront();
        Object.values(this.layerGroups).forEach(g => g.bringToFront());
        if (this.stationGroup) this.stationGroup.bringToFront();
    };

    // -------------------------------------------------------------------
    // The two rails
    // -------------------------------------------------------------------

    CorridorMapInstance.prototype.drawRails = function () {
        if (!this.map || !this.geometry) return;
        this.railGroup.clearLayers();

        const metres = offsetMetres(this.map);
        const centre = this.geometry.centreline;

        // A dark casing under both rails so they stay legible over satellite
        // imagery, which is otherwise busy enough to swallow a thin line. Kept
        // narrow enough that the two casings never merge into one band at the
        // tightest separation the clamp allows.
        ["DN", "UP"].forEach(line => {
            const pts = railPath(centre, line, metres);
            L.polyline(pts, {
                color: "#0f172a", weight: 5.5, opacity: 0.5,
                lineCap: "round", lineJoin: "round"
            }).addTo(this.railGroup);
        });

        ["DN", "UP"].forEach(line => {
            const pts = railPath(centre, line, metres);
            L.polyline(pts, {
                color: RAIL[line].color, weight: 3, opacity: 0.95,
                lineCap: "round", lineJoin: "round"
            }).addTo(this.railGroup).bindTooltip(
                `${RAIL[line].label} &bull; ${this.geometry.total_distance_km} KM`,
                { sticky: true, className: "cmap-tooltip-plain" }
            );
        });
    };

    /**
     * Station beacons sit on the centreline, with a tick bridging both rails so
     * it reads as one station serving the pair rather than two separate nodes.
     */
    CorridorMapInstance.prototype.drawStations = function () {
        if (!this.map || !this.geometry) return;
        this.stationGroup.clearLayers();
        this.stationMarkers = {};

        const self = this;
        this.geometry.stations.forEach(st => {
            const icon = L.divIcon({
                html: `<div class="cmap-station"><div class="cmap-station-core">${esc(st.code)}</div></div>`,
                className: "cmap-station-icon",
                iconSize: [40, 18],
                iconAnchor: [20, 9],
                popupAnchor: [0, -10]
            });

            const marker = L.marker([st.lat, st.lng], { icon: icon, zIndexOffset: 500 })
                .addTo(this.stationGroup);

            marker.bindTooltip(
                `<div class="cmap-card" style="width:auto;padding:6px 9px;">
                    <strong>${esc(st.name)}</strong> (${esc(st.code)})<br>
                    <span style="color:#94a3b8;font-size:.66rem;">
                        KM ${st.km} &bull; ${esc(st.division || "")}
                    </span>
                 </div>`,
                { direction: "top", className: "cmap-tooltip", offset: [0, -8] }
            );
            flipTooltipToFit(this.map, marker, 8);

            const depots = (st.depots || [])
                .map(d => `<span class="cmap-flag">${esc(d)}</span>`).join("");
            const yardBtn = typeof window.openYardSchematic === "function"
                ? `<div class="cmap-card-actions">
                       <button class="cmap-action" onclick="openYardSchematic('${esc(st.code)}')">
                           Inspect Yard Interlocking
                       </button>
                   </div>`
                : "";

            marker.bindPopup(`
                <div class="cmap-card">
                    <div class="cmap-card-head">
                        <div>
                            <h4 class="cmap-card-title">${esc(st.name)}</h4>
                            <span class="cmap-card-sub">${esc(st.division || "")} &bull; KM ${st.km}</span>
                        </div>
                        <span class="cmap-card-sev" style="background:#0f172a">${esc(st.code)}</span>
                    </div>
                    <div class="cmap-card-body">
                        <div class="cmap-card-rows">
                            ${row("Platforms", st.platforms)}
                            ${row("Max speed", st.speed_limit_kmph ? st.speed_limit_kmph + " km/h" : null)}
                            ${row("Traction", "25 kV AC 50 Hz")}
                        </div>
                        ${depots ? `<div class="cmap-card-flags">${depots}</div>` : ""}
                    </div>
                    ${yardBtn}
                </div>`, { className: "cmap-popup", maxWidth: 300 });

            self.stationMarkers[st.code] = marker;
        });
    };

    CorridorMapInstance.prototype.buildChips = function () {
        const rail = this.container.querySelector("[data-role=chips]");
        if (!rail || !this.geometry) return;
        const self = this;

        rail.innerHTML = this.geometry.stations
            .map(st => `<button class="cmap-chip" data-station="${esc(st.code)}">${esc(st.code)}</button>`)
            .join("");

        rail.querySelectorAll("[data-station]").forEach(btn => {
            btn.addEventListener("click", () => self.jumpTo(btn.dataset.station));
        });
    };

    CorridorMapInstance.prototype.jumpTo = function (code) {
        const st = (this.geometry.stations || []).find(s => s.code === code);
        if (!st || !this.map) return;

        this.container.querySelectorAll("[data-station]")
            .forEach(b => b.classList.toggle("is-active", b.dataset.station === code));

        this.map.flyTo([st.lat, st.lng], 13, { duration: 1.1 });
        const marker = this.stationMarkers[code];
        if (marker) setTimeout(() => marker.openPopup(), 1150);
    };

    CorridorMapInstance.prototype.fitCorridor = function () {
        if (!this.map || !this.geometry) return;
        this.container.querySelectorAll("[data-station]")
            .forEach(b => b.classList.remove("is-active"));
        const pts = this.geometry.centreline.map(p => [p.lat, p.lng]);
        this.map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 10 });

        // Only a fit performed against a real, measured container counts. See
        // invalidate() for why.
        if (this.map.getSize().y > 0) this.hasFittedVisible = true;
    };

    // -------------------------------------------------------------------
    // Layers
    // -------------------------------------------------------------------

    CorridorMapInstance.prototype.refresh = async function () {
        const params = new URLSearchParams({ department: this.opts.department });
        const requested = (this.opts.layers || []).filter(n => n !== "trains");
        if (requested.length) params.set("layers_csv", requested.join(","));

        try {
            const res = await fetch(`${API.layers}?${params}`);
            const data = await res.json();

            Object.keys(data.layers || {}).forEach(name => {
                this.featureData[name] = data.layers[name];
            });

            // First response tells us which layers the server actually returned,
            // which is how a portal gets its preset without hardcoding it.
            if (!this.opts.layers) {
                this.opts.layers = Object.keys(data.layers || {});
            }
            if (!this.activeLayers.size) {
                this.opts.layers.forEach(n => this.activeLayers.add(n));
                if (this.opts.showTrains) this.activeLayers.add("trains");
            }

            this.buildLayerToggles();
            this.renderAllLayers();
            this.renderLegend();
        } catch (err) {
            console.error("[CorridorMap] layer refresh failed:", err);
        }
    };

    CorridorMapInstance.prototype.buildLayerToggles = function () {
        const host = this.container.querySelector("[data-role=layers]");
        if (!host) return;

        const names = (this.opts.layers || []).slice();
        if (this.opts.showTrains && !names.includes("trains")) names.push("trains");

        // Rebuild only when the layer set itself changed, so a poll does not
        // wipe the officer's toggle state mid-interaction.
        const signature = names.join(",");
        if (host.dataset.signature === signature) {
            names.forEach(n => {
                const btn = host.querySelector(`[data-layer="${n}"]`);
                if (btn) btn.classList.toggle("is-active", this.activeLayers.has(n));
            });
            return;
        }
        host.dataset.signature = signature;

        const self = this;
        host.innerHTML = names.map(n => {
            const meta = LAYER_META[n] || { label: n, color: "#64748b" };
            return `<button class="cmap-btn${self.activeLayers.has(n) ? " is-active" : ""}"
                            data-layer="${esc(n)}" style="color:${meta.color}">
                        <span class="cmap-layer-dot"></span>${esc(meta.label)}
                    </button>`;
        }).join("");

        host.querySelectorAll("[data-layer]").forEach(btn => {
            btn.addEventListener("click", () => {
                const name = btn.dataset.layer;
                if (self.activeLayers.has(name)) self.activeLayers.delete(name);
                else self.activeLayers.add(name);
                btn.classList.toggle("is-active", self.activeLayers.has(name));
                self.renderAllLayers();
                self.renderLegend();
                if (name === "trains") self.renderTrains(self.featureData.trains || []);
            });
        });
    };

    CorridorMapInstance.prototype.renderAllLayers = function () {
        (this.opts.layers || []).forEach(name => this.renderLayer(name));
    };

    CorridorMapInstance.prototype.renderLayer = function (name) {
        if (!this.map) return;

        if (!this.layerGroups[name]) {
            this.layerGroups[name] = L.featureGroup().addTo(this.map);
        }
        const group = this.layerGroups[name];
        group.clearLayers();

        if (!this.activeLayers.has(name)) return;

        const meta = LAYER_META[name] || { glyph: "*", kind: "point" };
        const metres = offsetMetres(this.map);
        const self = this;

        (this.featureData[name] || []).forEach(f => {
            self.featureIndex[f.id] = f;
            const colour = severityColor(f.severity);

            // Spans (blocks, power cuts, health) get a stroked stretch of rail;
            // health is drawn wider and softer because it describes a condition
            // over a length rather than a possession on it.
            if (meta.kind === "span" && f.path && f.path.length > 1) {
                const line = railPath(f.path, f.line, metres);
                const isHealth = name === "health";
                L.polyline(line, {
                    color: colour,
                    weight: isHealth ? 9 : 6,
                    opacity: isHealth ? 0.4 : 0.85,
                    dashArray: name === "powercuts" ? "9,7" : null,
                    lineCap: "round"
                }).addTo(group)
                  .bindTooltip(cardHtml(f, self.opts, true),
                      { sticky: true, className: "cmap-tooltip" })
                  .bindPopup(cardHtml(f, self.opts), {
                      className: "cmap-popup", maxWidth: 300, autoPan: true,
                      autoPanPadding: [24, 24]
                  });
            }

            const anchor = railPoint(f, f.line, metres);
            const running = f.detail && f.detail.status === "IN_PROGRESS";

            const marker = L.marker(anchor, {
                icon: L.divIcon({
                    html: `<div class="cmap-marker cmap-sev-${String(f.severity).toLowerCase()}${running ? " is-running" : ""}"
                                style="background:${colour}">${esc(meta.glyph)}</div>`,
                    className: "cmap-marker-icon",
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                    popupAnchor: [0, -11]
                })
            }).addTo(group);

            marker.bindTooltip(cardHtml(f, self.opts, true),
                { direction: "top", className: "cmap-tooltip", offset: [0, -12] });
            marker.bindPopup(cardHtml(f, self.opts),
                { className: "cmap-popup", maxWidth: 300, autoPan: true,
                  autoPanPadding: [24, 24] });
            flipTooltipToFit(self.map, marker, 12);
        });

        if (this.stationGroup) this.stationGroup.bringToFront();
    };

    CorridorMapInstance.prototype.renderLegend = function () {
        const host = this.container.querySelector("[data-role=legend]");
        if (!host) return;

        const rails = ["DN", "UP"].map(l =>
            `<span class="cmap-legend-item">
                <span class="cmap-legend-rail" style="background:${RAIL[l].color}"></span>${RAIL[l].label}
             </span>`).join("");

        const sev = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s =>
            `<span class="cmap-legend-item">
                <span class="cmap-layer-dot" style="color:${SEVERITY_COLOR[s]}"></span>${s}
             </span>`).join("");

        const total = Array.from(this.activeLayers)
            .reduce((n, l) => n + ((this.featureData[l] || []).length), 0);

        host.innerHTML = rails + sev +
            `<span class="cmap-legend-count">${total} features plotted</span>`;
    };

    // -------------------------------------------------------------------
    // Trains
    // -------------------------------------------------------------------

    CorridorMapInstance.prototype.refreshTrains = async function () {
        if (!this.activeLayers.has("trains")) return;
        try {
            const res = await fetch(API.trains);
            const data = await res.json();
            this.featureData.trains = data.trains || [];
            this.renderTrains(this.featureData.trains);
        } catch (err) {
            console.error("[CorridorMap] train refresh failed:", err);
        }
    };

    /**
     * Moves trains rather than redrawing them.
     *
     * Recreating the markers each poll would make trains blink and teleport;
     * calling setLatLng on an existing marker lets the CSS transform transition
     * in corridor_map.css carry it smoothly to the new position, so a 2-second
     * poll reads as continuous movement.
     */
    CorridorMapInstance.prototype.renderTrains = function (trains) {
        if (!this.map) return;

        if (!this.layerGroups.trains) {
            this.layerGroups.trains = L.featureGroup().addTo(this.map);
        }
        const group = this.layerGroups.trains;

        if (!this.activeLayers.has("trains")) {
            group.clearLayers();
            this.trainMarkers = {};
            return;
        }

        const metres = offsetMetres(this.map);
        const seen = new Set();
        const self = this;

        (trains || []).forEach(t => {
            seen.add(t.id);
            const pos = railPoint(t, t.line, metres);
            let marker = self.trainMarkers[t.id];

            if (!marker) {
                marker = L.marker(pos, {
                    icon: L.divIcon({
                        html: `<div class="cmap-train ${esc(t.class_cls)}${t.state === "HALTED" ? " is-halted" : ""}">&#9679;</div>`,
                        className: "cmap-train-icon",
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                        popupAnchor: [0, -10]
                    }),
                    zIndexOffset: 400
                }).addTo(group);
                self.trainMarkers[t.id] = marker;
                flipTooltipToFit(self.map, marker, 11);
            } else {
                marker.setLatLng(pos);
            }

            marker.bindTooltip(cardHtml(t, self.opts, true),
                { direction: "top", className: "cmap-tooltip", offset: [0, -11] });
        });

        // Trains that have terminated since the last poll.
        Object.keys(this.trainMarkers).forEach(id => {
            if (!seen.has(id)) {
                group.removeLayer(this.trainMarkers[id]);
                delete this.trainMarkers[id];
            }
        });
    };

    // -------------------------------------------------------------------
    // Polling
    // -------------------------------------------------------------------

    CorridorMapInstance.prototype.startPolling = function () {
        const self = this;
        if (this.opts.pollMs > 0) {
            this.timers.push(setInterval(() => self.refresh(), this.opts.pollMs));
        }
        if (this.opts.trainPollMs > 0) {
            this.timers.push(setInterval(() => self.refreshTrains(), this.opts.trainPollMs));
        }
        if (this.opts.showTrains) this.refreshTrains();
    };

    CorridorMapInstance.prototype.destroy = function () {
        this.timers.forEach(clearInterval);
        this.timers = [];
        if (this.map) this.map.remove();
        this.map = null;
    };

    /**
     * Re-measures the map after its container becomes visible.
     *
     * A map mounted inside a hidden tab measures zero, so the fitBounds during
     * boot resolves against an empty viewport and leaves the corridor off to
     * one side once the tab is finally shown. The first invalidation that finds
     * a real container therefore re-fits and redraws, which is exactly the case
     * on the OCC desk where the map lives behind Tab 3.
     */
    CorridorMapInstance.prototype.invalidate = function () {
        if (!this.map) return;
        this.map.invalidateSize();

        if (!this.hasFittedVisible && this.map.getSize().y > 0) {
            this.fitCorridor();
            this.drawRails();
            this.renderAllLayers();
        }
    };

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------

    return {
        /**
         * Mounts a corridor map into `target` (selector or element).
         * Returns the instance, whose `invalidate()` should be called whenever
         * the map is revealed inside a tab that was previously hidden.
         */
        mount: function (target, options) {
            const el = typeof target === "string" ? document.querySelector(target) : target;
            if (!el) {
                console.warn("[CorridorMap] mount target not found:", target);
                return null;
            }
            if (typeof L === "undefined") {
                console.error("[CorridorMap] Leaflet is not loaded.");
                return null;
            }

            const inst = new CorridorMapInstance(el, options);
            instances.push(inst);
            inst.boot();
            return inst;
        },

        /** All mounted instances, used by pages that need to invalidate on tab switch. */
        instances: instances,

        invalidateAll: function () {
            instances.forEach(i => i.invalidate());
        },

        /** Internal: popup Inspect button bridge. */
        _inspect: function (instanceId, featureId) {
            const inst = instances.find(i => i.id === instanceId);
            if (!inst) return;
            const feature = inst.featureIndex[featureId];
            if (feature && typeof inst.opts.onInspect === "function") {
                if (inst.map) inst.map.closePopup();
                inst.opts.onInspect(feature, inst);
            }
        }
    };
})();
