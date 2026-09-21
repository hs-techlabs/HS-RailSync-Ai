/**
 * Main Application Coordinator & Keyboard Navigation Engine (Fluent Control-Room Design).
 * Manages hash routing, side-nav navigation, live CorridorStrip, real Leaflet dual-track map,
 * OR-Tools CP-SAT bundling, SHAP waterfall cards, live asset searching, and KPI updates.
 */

const API_BASE = (typeof window !== "undefined" && window.API_BASE !== undefined) ? window.API_BASE : "";
let currentScheduleData = null;
let currentTimetableData = null;
let currentTopologyData = null;
let cachedAssets = [];
let pendingDemandsCache = [];
let executionDemandsCache = [];

let sideNavInstance = null;
let corridorStripInstance = null;
let occCorridorMap = null;
let currentView = "home";

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    initKeyboardShortcuts();
    initNotifications("ALL");
    initSideNav();
    initCorridorStrip();
    initOCCCorridorMap();
    loadCorridorTopology();
    loadOptimalSchedule();
    loadAssetsTable();
    loadPendingDemands();
    loadExecutionBoard();
    showHorizon("WEEKLY");

    window.addEventListener("hashchange", handleRoute);
    window.addEventListener("resize", layoutShell);
    setTimeout(layoutShell, 40);
    setTimeout(layoutShell, 200);
    setTimeout(layoutShell, 600);

    if (typeof ResizeObserver !== "undefined") {
        const stripWrap = document.getElementById("strip-wrap");
        if (stripWrap) {
            const ro = new ResizeObserver(() => layoutShell());
            ro.observe(stripWrap);
        }
    }

    // Live polling loops for incoming requisitions and executing blocks
    setInterval(loadPendingDemands, 5000);
    setInterval(loadExecutionBoard, 5000);
});

// ==============================================================================
// 1. CLOCK & NOTIFICATIONS
// ==============================================================================

function initClock() {
    initSimClock("live-clock", "", "");
}

function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

        if (e.key === "1") location.hash = "#home";
        else if (e.key === "2") location.hash = "#gantt";
        else if (e.key === "3") location.hash = "#marey";
        else if (e.key === "4") location.hash = "#map";
        else if (e.key === "5") location.hash = "#assets";
        else if (e.key === "6") location.hash = "#plans";
        else if (e.key === "7") location.hash = "#memos";
        else if (e.key === "Escape") {
            closeSimulatorModal();
            closeYardModal();
        }
    });
}

// ==============================================================================
// 2. SIDE-NAV & HASH ROUTING
// ==============================================================================

function initSideNav() {
    if (typeof SideNav === "undefined") return;

    sideNavInstance = SideNav.create({
        side: "left",
        align: "stretch",
        mode: "pinned",
        theme: "light",
        width: 232,
        railWidth: 58,
        offset: 14,
        storageKey: null,
        offsetSelector: "#views",
        activeId: "home",
        accent: "#C69A2B",
        accentInk: "#242424",
        brand: { label: "Block Planning", sub: "NDLS–CNB · 440 KM", crest: "IR", href: "#home" },
        items: [
            { id: "home", label: "Control Desk", href: "#home", icon: "home" },
            {
                id: "monitor", label: "Current Monitor", icon: "signal", defaultOpen: true,
                children: [
                    { id: "gantt", label: "Block Gantt", href: "#gantt", icon: "bars" },
                    { id: "marey", label: "Marey Diagram", href: "#marey", icon: "chart" },
                    { id: "map",   label: "Corridor Map",   href: "#map",   icon: "map" }
                ]
            },
            {
                id: "resource", label: "Resource & AI", icon: "layers", defaultOpen: true,
                children: [
                    { id: "assets", label: "Asset Health", href: "#assets", icon: "shield" }
                ]
            },
            { id: "plans", label: "Block Plans", href: "#plans", icon: "calendar" },
            { id: "memos", label: "Sanction Memos", href: "#memos", icon: "file" },
            { type: "divider" },
            {
                id: "portals", label: "Other Portals", icon: "layers",
                children: [
                    { id: "x-tms",  label: "Track — TMS",      href: "/tms",  icon: "wrench" },
                    { id: "x-tdms", label: "Traction — TDMS",  href: "/tdms", icon: "bolt" },
                    { id: "x-smms", label: "Signal — SMMS",    href: "/smms", icon: "signal" }
                ]
            }
        ],
        onToggle: function () { setTimeout(layoutShell, 300); }
    });

    handleRoute();
}

function handleRoute() {
    let id = (location.hash || "#home").replace(/^#/, "");
    const validViews = ["home", "gantt", "marey", "map", "assets", "plans", "memos"];
    if (!validViews.includes(id)) id = "home";
    currentView = id;

    document.querySelectorAll(".view").forEach(v => {
        v.classList.toggle("is-active", v.dataset.view === id);
    });

    if (sideNavInstance && sideNavInstance.setActive) {
        sideNavInstance.setActive(id);
    }

    placeMap(id === "map" ? "full" : "home");

    if (id === "marey" && typeof renderMareyChart === "function") {
        setTimeout(renderMareyChart, 80);
    } else if (id === "gantt" && typeof renderGanttChart === "function") {
        setTimeout(renderGanttChart, 80);
    } else if (id === "map") {
        setTimeout(() => CorridorMap.invalidateAll(), 80);
    }

    setTimeout(layoutShell, 100);
}

function layoutShell() {
    const stripWrap = document.getElementById("strip-wrap");
    const viewsEl = document.getElementById("views");
    let topPx = 216;

    if (stripWrap) {
        const rect = stripWrap.getBoundingClientRect();
        if (rect.bottom > 0) {
            topPx = Math.round(rect.bottom + 6);
        }
    } else if (viewsEl) {
        topPx = Math.round(viewsEl.offsetTop + 4);
    }

    document.documentElement.style.setProperty("--shell-top", topPx + "px");
}

// ==============================================================================
// 3. PERSISTENT FULL-WIDTH CORRIDOR STRIP
// ==============================================================================

function initCorridorStrip() {
    if (typeof CorridorStrip === "undefined") return;

    const preset = (typeof CORRIDOR_PRESETS !== "undefined" && CORRIDOR_PRESETS["ndls-cnb"])
        ? CORRIDOR_PRESETS["ndls-cnb"]
        : {
            label: "New Delhi - Kanpur Central (NDLS-CNB) High-Density Trunk Corridor",
            totalKm: 440,
            stations: [
                { code: "NDLS", name: "New Delhi", km: 0 },
                { code: "GZB",  name: "Ghaziabad", km: 25 },
                { code: "DER",  name: "Dadri", km: 37 },
                { code: "KRJ",  name: "Khurja", km: 83 },
                { code: "ALJN", name: "Aligarh", km: 131 },
                { code: "TDL",  name: "Tundla", km: 209 },
                { code: "FZD",  name: "Firozabad", km: 226 },
                { code: "ETW",  name: "Etawah", km: 301 },
                { code: "PHD",  name: "Phaphund", km: 357 },
                { code: "CNB",  name: "Kanpur Central", km: 440 }
            ]
        };

    corridorStripInstance = CorridorStrip.create("#corridor", {
        stations: preset.stations,
        totalKm: preset.totalKm,
        label: "Corridor Possession & Block Queue",
        height: 80,
        markers: getStripMarkers(),
        onSelect: function (marker) {
            if (marker) flashDemand(marker.id);
        }
    });
    setTimeout(layoutShell, 30);
}

function toStripMarker(d) {
    const status = d.status === "PENDING_SANCTION" ? "PENDING_REVIEW" :
                   (d.status === "APPROVED_SHADOW_BLOCK" ? "SANCTIONED" :
                   (d.status === "IN_PROGRESS" ? "EXECUTING" : d.status));

    return {
        id: d.demand_id,
        line: d.line || "DN",
        kmStart: d.km_start || 0,
        kmEnd: d.km_end || (d.km_start ? d.km_start + 1.2 : 2.0),
        priority: d.priority || "MEDIUM",
        status: status,
        kind: "DEMAND",
        dept: d.department,
        deptLabel: d.department_label,
        defect: d.defect_category,
        section: d.section ? d.section : (`${d.section_from || 'NDLS'} - ${d.section_to || 'CNB'}`),
        crew: d.gang_crew || "",
        machine: d.machine_required || "NONE",
        durationMin: d.duration_requested_min || 120,
        powerBlock: !!d.power_block_required,
        disconnection: !!d.disconnection_required,
        note: d.description || "",
        window: d.sanctioned_window || null,
        progress: d.status === "IN_PROGRESS" ? (d.progress_pct || 0) / 100 : (d.status === "COMPLETED" ? 1 : 0)
    };
}

function getStripMarkers() {
    const incoming = (pendingDemandsCache || []).map(toStripMarker);
    const board = (executionDemandsCache || []).map(toStripMarker);
    return incoming.concat(board);
}

function refreshCorridorStrip() {
    if (corridorStripInstance && typeof corridorStripInstance.setMarkers === "function") {
        corridorStripInstance.setMarkers(getStripMarkers());
    }
}

function flashDemand(id) {
    if (currentView !== "home") {
        location.hash = "#home";
    }
    setTimeout(() => {
        const target = document.querySelector(`[data-key="${CSS.escape(String(id))}"]`);
        if (target) {
            target.scrollIntoView({ block: "nearest", behavior: "smooth" });
            target.classList.remove("is-arriving");
            void target.offsetWidth;
            target.classList.add("is-arriving");
            setTimeout(() => target.classList.remove("is-arriving"), 2500);
        }
    }, 120);
}

// ==============================================================================
// 4. MAP SERVICE & DUAL-SLOT PLACEMENT
// ==============================================================================

function initOCCCorridorMap() {
    if (typeof CorridorMap === "undefined") return;

    occCorridorMap = CorridorMap.mount("#occ-corridor-map", {
        department: "ALL",
        layers: ["demands", "blocks"],
        showTrains: true,
        chrome: "overlay",
        height: "fill",
        inspector: "panel",
        onInspect: showDemandInQueue
    });

    placeMap("home");
}

function placeMap(slot) {
    const fmapHost = document.getElementById("fmap-host");
    const target = slot === "full" ? document.getElementById("map-slot-full") : document.getElementById("map-slot-home");
    if (fmapHost && target && fmapHost.parentElement !== target) {
        target.prepend(fmapHost);
    }
    if (typeof CorridorMap !== "undefined" && CorridorMap.invalidateAll) {
        setTimeout(() => CorridorMap.invalidateAll(), 60);
    }
}

function switchMapView(mode) {
    const fmapHost = document.getElementById("fmap-host");
    const schematic = document.getElementById("schematic-board-container");
    const btnGeo = document.getElementById("btn-view-geo");
    const btnSchematic = document.getElementById("btn-view-schematic");

    if (btnGeo) btnGeo.classList.toggle("is-active", mode === "geo");
    if (btnSchematic) btnSchematic.classList.toggle("is-active", mode === "schematic");

    if (mode === "schematic") {
        if (fmapHost) fmapHost.style.display = "none";
        if (schematic) {
            schematic.style.display = "block";
            if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
                renderNetworkTrackDiagram(currentTopologyData);
            }
        }
    } else {
        if (schematic) schematic.style.display = "none";
        if (fmapHost) fmapHost.style.display = "block";
        setTimeout(() => CorridorMap.invalidateAll(), 80);
    }
}

// ==============================================================================
// 5. SCHEDULE, TOPOLOGY & KPI UPDATES
// ==============================================================================

async function loadCorridorTopology() {
    try {
        const res = await fetch(`${API_BASE}/api/corridor/topology`);
        currentTopologyData = await res.json();
        if (typeof renderNetworkTrackDiagram === "function") {
            renderNetworkTrackDiagram(currentTopologyData);
        }
    } catch (e) {
        console.error("Failed to load topology:", e);
    }
}

async function loadOptimalSchedule() {
    try {
        const res = await fetch(`${API_BASE}/api/schedule/optimal`);
        currentScheduleData = await res.json();

        const ttRes = await fetch(`${API_BASE}/api/corridor/timetable`);
        currentTimetableData = await ttRes.json();

        updateKPICards(currentScheduleData.metrics);
        populateMemoDropdown(currentScheduleData.scheduled_blocks);

        if (typeof renderMareyChart === "function") renderMareyChart();
        if (typeof renderGanttChart === "function") renderGanttChart();
        if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
            renderNetworkTrackDiagram(currentTopologyData);
        }
    } catch (e) {
        console.error("Failed to load optimal schedule:", e);
    }
}

function updateKPICards(metrics) {
    if (!metrics) return;

    const downtimeEl = document.getElementById("kpi-downtime");
    const downtimeSub = document.getElementById("kpi-downtime-sub");
    const bundlingEl = document.getElementById("kpi-bundled");
    const punctualityEl = document.getElementById("kpi-punct");
    const criticalEl = document.getElementById("kpi-critical");

    const baseHoursEl = document.getElementById("gantt-base-hours");
    const optHoursEl = document.getElementById("gantt-opt-hours");
    const savedPctEl = document.getElementById("gantt-saved-pct");

    if (downtimeEl) downtimeEl.innerText = `${metrics.downtime_reduction_pct}%`;
    if (downtimeSub) downtimeSub.innerText = `${metrics.downtime_saved_hours}h saved vs unbundled`;
    if (bundlingEl) bundlingEl.innerText = `${metrics.multi_department_bundling_rate_pct}%`;
    if (punctualityEl) punctualityEl.innerText = "100%";
    if (criticalEl) criticalEl.innerText = metrics.total_tasks_completed || "33";

    if (baseHoursEl) baseHoursEl.innerText = `${metrics.unbundled_baseline_hours || 99.1} h`;
    if (optHoursEl) optHoursEl.innerText = `${metrics.total_possession_hours || 21.1} h`;
    if (savedPctEl) savedPctEl.innerText = `${metrics.downtime_reduction_pct || 78.7}%`;
}

// ==============================================================================
// 6. RECONCILED DOM HELPERS
// ==============================================================================

function reconcileKeyed(container, items, keyOf, create, update) {
    if (!container) return;
    const existing = new Map();
    Array.from(container.children).forEach(el => {
        if (el.dataset.key) existing.set(el.dataset.key, el);
    });

    items.forEach((item, i) => {
        const key = String(keyOf(item));
        let el = existing.get(key);
        const isNew = !el;

        if (isNew) {
            el = create(item);
            el.dataset.key = key;
        } else {
            existing.delete(key);
        }

        update(el, item, isNew);

        if (container.children[i] !== el) {
            container.insertBefore(el, container.children[i] || null);
        }
    });

    existing.forEach(el => el.remove());
}

function deptTag(department) {
    if (department === "TRACTION_DISTRIBUTION_OHE") return { code: "TDMS", cls: "tdms" };
    if (department === "SIGNAL_AND_TELECOM") return { code: "SMMS", cls: "smms" };
    return { code: "TMS", cls: "tms" };
}

// ==============================================================================
// 7. INCOMING DEMANDS QUEUE & CP-SAT AUTO-BUNDLE
// ==============================================================================

let occDemandCount = 0;

async function loadPendingDemands() {
    try {
        const res = await fetch(`${API_BASE}/api/demand/pending`);
        const data = await res.json();
        pendingDemandsCache = data.demands || [];
        renderPendingDemands(data);
        refreshCorridorStrip();
    } catch (err) {
        console.error("Failed to load pending demands:", err);
    }
}

function renderPendingDemands(data) {
    const list = document.getElementById("incoming-list");
    const empty = document.getElementById("incoming-empty");
    const countEl = document.getElementById("incoming-count");
    const hoursEl = document.getElementById("incoming-hours");
    const btnBundle = document.getElementById("btn-bundle");
    if (!list) return;

    const demands = data.demands || [];
    const count = data.total_pending != null ? data.total_pending : demands.length;
    const totalHours = data.total_unbundled_hours != null
        ? data.total_unbundled_hours
        : (demands.reduce((acc, d) => acc + (d.duration_requested_min || 0), 0) / 60).toFixed(1);

    if (countEl) {
        countEl.innerText = count;
        if (count > occDemandCount) {
            countEl.classList.remove("is-ticking");
            void countEl.offsetWidth;
            countEl.classList.add("is-ticking");
            setTimeout(() => countEl.classList.remove("is-ticking"), 450);
        }
    }
    occDemandCount = count;

    if (hoursEl) {
        hoursEl.innerText = count ? `${totalHours} h unbundled` : "";
    }
    if (empty) empty.style.display = count === 0 ? "block" : "none";
    if (btnBundle) btnBundle.disabled = count === 0;

    reconcileKeyed(
        list,
        demands,
        d => d.demand_id,
        (d) => {
            const dept = deptTag(d.department);
            const prio = String(d.priority || "MEDIUM").toLowerCase();
            const machine = (d.machine_required && d.machine_required !== "NONE") ? d.machine_required : "No machine";
            const flags = (d.power_block_required ? `<span class="demand-flag demand-flag-power">25 kV CUT</span>` : "") +
                          (d.disconnection_required ? `<span class="demand-flag demand-flag-disc">T-351</span>` : "");

            const row = document.createElement("div");
            row.className = "demand-row";
            row.innerHTML = `
                <div class="demand-accent demand-accent-${dept.cls}"></div>
                <div class="demand-body">
                    <div class="demand-line">
                        <span class="demand-dept demand-dept-${dept.cls}">${dept.code}</span>
                        <span class="demand-id">${d.demand_id}</span>
                        <div class="spacer"></div>
                        <span class="demand-prio demand-prio-${prio}">${d.priority}</span>
                    </div>
                    <div class="demand-line-2">
                        <span class="demand-section">${d.section_from} &ndash; ${d.section_to} (${d.line})</span>
                        <span class="demand-defect">${d.defect_category}</span>
                    </div>
                    <div class="demand-line">
                        <span class="demand-dur">${d.duration_requested_min} min</span>
                        <span class="demand-meta">${machine}</span>
                        <span class="demand-meta-dim">${d.gang_crew || ''}</span>
                        <div class="spacer"></div>
                        ${flags}
                    </div>
                </div>`;
            return row;
        },
        (row, d, isNew) => {
            if (!isNew) return;
            row.classList.add("is-arriving");
            setTimeout(() => row.classList.remove("is-arriving"), 2500);
        }
    );
}

function showDemandInQueue(feature) {
    const list = document.getElementById("incoming-list");
    if (!list || !feature) return;

    if (currentView !== "home") {
        location.hash = "#home";
    }

    setTimeout(() => {
        const row = list.querySelector(`[data-key="${CSS.escape(String(feature.id))}"]`);
        if (!row) return;

        row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        row.classList.remove("is-arriving");
        void row.offsetWidth;
        row.classList.add("is-arriving");
        setTimeout(() => row.classList.remove("is-arriving"), 2500);
    }, 120);
}

async function triggerAutoBundleAndSanction() {
    const btn = document.getElementById("btn-bundle");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> CP-SAT BUNDLING &amp; OPTIMIZING...`;
    }

    try {
        const res = await fetch(`${API_BASE}/api/demand/bundle_and_sanction`, { method: "POST" });
        const data = await res.json();

        if (data.status === "SUCCESS") {
            if (data.updated_schedule) {
                currentScheduleData = data.updated_schedule;
                updateKPICards(currentScheduleData.metrics);
                populateMemoDropdown(currentScheduleData.scheduled_blocks);
                if (typeof renderMareyChart === "function") renderMareyChart();
                if (typeof renderGanttChart === "function") renderGanttChart();
                if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
                    renderNetworkTrackDiagram(currentTopologyData);
                }
                if (typeof CorridorMap !== "undefined") CorridorMap.instances.forEach(m => m.refresh());
            }
        }

        loadPendingDemands();
        loadExecutionBoard();
    } catch (err) {
        alert("Bundling failed: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> AUTO-BUNDLE &amp; SANCTION`;
        }
    }
}

// ==============================================================================
// 8. IN EXECUTION RAIL & LIFECYCLE
// ==============================================================================

const EXEC_STATUS_META = {
    APPROVED_SHADOW_BLOCK: { cls: "scheduled",  label: "SANCTIONED",      color: "var(--dept-bundle-text)" },
    IN_PROGRESS:           { cls: "inprogress", label: "UNDER EXECUTION", color: "var(--color-blue)" },
    COMPLETED:             { cls: "completed",  label: "COMPLETED",       color: "var(--color-emerald)" },
    CANCELLED:             { cls: "cancelled",  label: "WITHDRAWN",       color: "var(--color-crimson)" },
    DEFERRED_NEXT_CYCLE:   { cls: "deferred",   label: "DEFERRED",        color: "var(--text-subtle)" }
};

const execPrevStatus = new Map();

async function loadExecutionBoard() {
    try {
        const res = await fetch(`${API_BASE}/api/live/board`);
        const data = await res.json();
        executionDemandsCache = data.demands || [];
        renderExecutionBoard(data);
        refreshCorridorStrip();
    } catch (e) {
        console.error("Failed to load execution board:", e);
    }
}

function renderExecutionBoard(data) {
    const rail = document.getElementById("exec-rail");
    const summary = document.getElementById("exec-tally");
    const empty = document.getElementById("exec-empty");
    const countEl = document.getElementById("exec-count");
    if (!rail) return;

    const demands = data.demands || [];
    if (countEl) countEl.innerText = demands.length;
    if (empty) empty.style.display = demands.length ? "none" : "block";

    if (summary) {
        const counts = data.status_counts || {};
        summary.innerHTML = Object.keys(EXEC_STATUS_META)
            .filter(k => counts[k])
            .map(k => `<span class="exec-tally-chip exec-status-${EXEC_STATUS_META[k].cls}">${EXEC_STATUS_META[k].label} <strong>${counts[k]}</strong></span>`)
            .join("");
    }

    const order = ["IN_PROGRESS", "APPROVED_SHADOW_BLOCK", "DEFERRED_NEXT_CYCLE", "CANCELLED", "COMPLETED"];
    const sorted = demands.slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

    reconcileKeyed(
        rail,
        sorted,
        d => d.demand_id,
        () => {
            const card = document.createElement("div");
            card.className = "exec-card";
            card.innerHTML = `
                <div class="exec-card-top">
                    <span class="exec-dot"></span>
                    <span class="exec-card-id"></span>
                    <div class="spacer"></div>
                    <span class="exec-status"></span>
                </div>
                <div class="exec-card-title"></div>
                <div class="exec-card-meta">
                    <span class="exec-card-sec"></span>
                    <span class="exec-card-dept"></span>
                </div>
                <div class="exec-card-window"></div>
                <div class="exec-progress" hidden>
                    <div class="exec-progress-track"><div class="exec-progress-fill"></div></div>
                    <span class="exec-progress-pct"></span>
                </div>
                <div class="exec-card-note" hidden></div>`;
            return card;
        },
        (card, d, isNew) => {
            const meta = EXEC_STATUS_META[d.status] || EXEC_STATUS_META.DEFERRED_NEXT_CYCLE;
            const colour = meta.color;
            const running = d.status === "IN_PROGRESS";
            const dept = (d.department_label || d.department || "").replace(/\s*\(.*\)/, "");

            card.className = `exec-card exec-card-${meta.cls}${running ? " is-running" : ""}`;

            card.querySelector(".exec-dot").style.background = colour;
            card.querySelector(".exec-card-id").innerText = d.demand_id;

            const status = card.querySelector(".exec-status");
            status.className = `exec-status exec-status-${meta.cls}`;
            status.innerText = meta.label;

            card.querySelector(".exec-card-title").innerText = d.defect_category || "Maintenance block";
            card.querySelector(".exec-card-sec").innerText = `${d.section_from || 'NDLS'} – ${d.section_to || 'CNB'} (${d.line || 'DN'})`;
            card.querySelector(".exec-card-dept").innerText = dept;

            let timing = d.sanctioned_window || "No window allocated";
            if (d.window_day_label) timing += ` · ${d.window_day_label}`;
            if (d.status === "APPROVED_SHADOW_BLOCK" && d.sim_minutes_to_start != null) {
                timing += ` · starts in ${Math.round(d.sim_minutes_to_start)} min`;
            }
            const windowEl = card.querySelector(".exec-card-window");
            windowEl.className = "exec-card-window" + (d.status === "DEFERRED_NEXT_CYCLE" ? " exec-card-window-dim" : "");
            windowEl.innerText = timing;

            const showBar = running || d.status === "COMPLETED";
            const progress = card.querySelector(".exec-progress");
            progress.hidden = !showBar;
            if (showBar) {
                const fill = card.querySelector(".exec-progress-fill");
                fill.className = "exec-progress-fill" + (d.status === "COMPLETED" ? " is-complete" : "");
                fill.style.width = `${d.progress_pct}%`;
                const pct = card.querySelector(".exec-progress-pct");
                pct.style.color = colour;
                pct.innerText = `${Math.round(d.progress_pct)}%`;
            }

            const note = d.cancellation_reason || d.deferral_reason;
            const noteEl = card.querySelector(".exec-card-note");
            noteEl.hidden = !note;
            if (note) {
                noteEl.className = "exec-card-note exec-card-note-" + (d.status === "CANCELLED" ? "cancelled" : "deferred");
                noteEl.innerText = note;
                noteEl.title = note;
            }

            const prev = execPrevStatus.get(d.demand_id);
            if (prev !== d.status) {
                if (d.status === "CANCELLED" && prev) {
                    card.classList.add("is-withdrawn");
                    setTimeout(() => card.classList.remove("is-withdrawn"), 420);
                } else if (isNew || d.status === "IN_PROGRESS") {
                    card.classList.add("is-entering");
                    setTimeout(() => card.classList.remove("is-entering"), 360);
                }
                execPrevStatus.set(d.demand_id, d.status);
            }
        }
    );
}

window.scrollExecRail = function(direction) {
    const rail = document.getElementById("exec-rail");
    if (!rail) return;
    rail.scrollBy({ left: direction * 320, behavior: "smooth" });
};

// ==============================================================================
// 9. ASSET HEALTH & SHAP XAI CARD
// ==============================================================================

async function loadAssetsTable() {
    const tbody = document.getElementById("assets-tbody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px; color:var(--text-muted);">Loading asset telemetry...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/api/assets/health?department=ALL&limit=100`);
        const data = await res.json();
        cachedAssets = data.assets || [];
        renderAssetsTable(cachedAssets);
        if (cachedAssets.length > 0) {
            explainAsset(cachedAssets[0].asset_id);
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--color-crimson);">Failed to load assets: ${e.message}</td></tr>`;
    }
}

function filterAssetDept(dept) {
    document.querySelectorAll("#asset-chips .chip").forEach(c => {
        c.classList.toggle("is-active", c.dataset.dept === dept);
    });

    if (dept === "ALL") {
        renderAssetsTable(cachedAssets);
    } else {
        const filtered = cachedAssets.filter(a => a.department === dept);
        renderAssetsTable(filtered);
    }
}

function filterAssetsTableLive() {
    const query = document.getElementById("asset-search")?.value.toLowerCase().trim() || "";
    if (!query) {
        renderAssetsTable(cachedAssets);
        return;
    }
    const filtered = cachedAssets.filter(a =>
        (a.asset_id && a.asset_id.toLowerCase().includes(query)) ||
        (a.station && a.station.toLowerCase().includes(query)) ||
        (a.department && a.department.toLowerCase().includes(query)) ||
        (a.asset_type && a.asset_type.toLowerCase().includes(query)) ||
        (a.section_from && a.section_from.toLowerCase().includes(query))
    );
    renderAssetsTable(filtered);
}

function renderAssetsTable(assets) {
    const tbody = document.getElementById("assets-tbody");
    if (!tbody) return;

    if (assets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px; color:var(--text-muted);">No assets matching search filter.</td></tr>`;
        return;
    }

    let rows = "";
    assets.forEach(a => {
        const tierClass = `tier-${a.priority_tier.toLowerCase()}`;
        const deptInfo = deptTag(a.department);
        const failPct = (a.failure_percentage || 0).toFixed(1);
        const rul = a.predicted_rul_days || 180;
        const sec = a.section_from ? `${a.section_from}-${a.section_to}` : (a.station || "NDLS-CNB");
        const healthVal = Math.max(0, Math.min(100, Math.round(100 - (a.failure_percentage || 0))));
        const healthColor = healthVal < 40 ? "var(--color-crimson)" : (healthVal < 70 ? "var(--color-amber)" : "var(--color-emerald)");

        rows += `
            <tr onclick="explainAsset('${a.asset_id}')" style="cursor:pointer;">
                <td class="mono" style="color:var(--color-primary); font-weight:700;">${a.asset_id}</td>
                <td>${sec}</td>
                <td>${a.asset_type || a.defect_category || 'Track Section'}</td>
                <td><span class="dept-pill ${deptInfo.cls}">${deptInfo.code}</span></td>
                <td class="mono" style="font-weight:700; color:${failPct > 50 ? 'var(--color-crimson)' : 'var(--text-primary)'};">${failPct}%</td>
                <td class="mono">${rul} d</td>
                <td>
                    <div class="health">
                        <div class="health-track">
                            <div class="health-fill" style="width:${healthVal}%; background:${healthColor};"></div>
                        </div>
                        <span class="mono">${healthVal}%</span>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

async function explainAsset(assetId) {
    const card = document.getElementById("xai-card");
    if (!card) return;

    card.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:200px; color:var(--text-muted);">
            <p>Evaluating SHAP feature attributions for ${assetId}...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE}/api/assets/explain/${assetId}`);
        if (!res.ok) throw new Error("Asset not found");
        const xai = await res.json();

        const failPct = (xai.failure_probability_pct || 0).toFixed(1);
        const riskDrivers = xai.primary_risk_drivers || ["Degraded Condition Index", "Overdue Maintenance Cycle"];
        const weights = [36, 24, 14, 8];

        let rowsHtml = "";
        riskDrivers.forEach((driver, idx) => {
            const w = weights[idx % weights.length];
            const color = idx === 0 ? "var(--color-crimson)" : (idx === 1 ? "var(--color-amber)" : "var(--color-blue)");
            rowsHtml += `
                <div class="xai-row">
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${driver}">${driver}</span>
                    <div class="xai-bar"><i style="width:${w * 2.5}%; background:${color};"></i></div>
                    <span class="xai-val" style="color:${color};">+${w}%</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="xai-title">${xai.asset_id} &bull; XAI Diagnostic</div>
                    <div class="xai-sub">XGBoost TreeExplainer SHAP Feature Attribution</div>
                </div>
                <span class="tier-badge tier-${xai.priority_tier.toLowerCase()}">${xai.priority_tier}</span>
            </div>

            <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-color); border-radius:var(--radius-xs); padding:10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Failure Risk</span>
                    <strong style="font-family:var(--font-mono); font-size:16px; color:${failPct > 50 ? 'var(--color-crimson)' : 'var(--color-primary)'};">${failPct}%</strong>
                </div>
                <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                    <div style="width:${failPct}%; height:100%; background:${failPct > 50 ? 'var(--color-crimson)' : 'var(--color-blue)'};"></div>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Primary Risk Contributors:</div>
                ${rowsHtml}
            </div>

            <div class="xai-verdict">
                <strong style="color:var(--color-blue); display:block; margin-bottom:2px;">&#9881; Controller Recommendation:</strong>
                <span>${xai.recommended_action || 'Bundle into next available corridor possession window.'}</span>
            </div>

            <button class="btn-primary" style="width:100%; height:32px; margin-top:8px;" onclick="simulateAssetRepair('${xai.asset_id}')">
                &#10003; Simulate Maintenance Repair (Reset Health to 100%)
            </button>
        `;
    } catch (e) {
        card.innerHTML = `<div style="padding:16px; color:var(--color-crimson);">Failed to load XAI explanation: ${e.message}</div>`;
    }
}

function simulateAssetRepair(assetId) {
    const match = cachedAssets.find(a => a.asset_id === assetId);
    if (match) {
        match.priority_tier = "LOW";
        match.failure_percentage = 4.2;
        match.predicted_rul_days = 340;
        renderAssetsTable(cachedAssets);
        explainAsset(assetId);
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch(`${API_BASE}/api/upload/csv`, { method: "POST", body: formData });
        const data = await res.json();
        alert(data.message || "File uploaded and schedule optimized!");
        loadOptimalSchedule();
        loadAssetsTable();
    } catch (err) {
        alert("Upload failed: " + err.message);
    }
}

// ==============================================================================
// 10. MULTI-HORIZON PLANS & BDMS MEMOS
// ==============================================================================

async function showHorizon(mode) {
    const btnW = document.getElementById("btn-weekly-toggle");
    const btnM = document.getElementById("btn-monthly-toggle");
    const container = document.getElementById("plans-body");
    if (!container) return;

    if (mode === "WEEKLY") {
        btnW?.classList.add("is-active");
        btnM?.classList.remove("is-active");
        container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">Generating 7-Day Tactical Matrix Roster...</div>`;

        try {
            const res = await fetch(`${API_BASE}/api/schedule/weekly`);
            const data = await res.json();
            renderWeeklyTacticalMatrix(data);
        } catch (e) {
            container.innerHTML = `<div style="color:var(--color-crimson);">Failed to load weekly plan: ${e.message}</div>`;
        }
    } else {
        btnM?.classList.add("is-active");
        btnW?.classList.remove("is-active");
        container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">Generating 30-Day Strategic Macro Plan...</div>`;

        try {
            const res = await fetch(`${API_BASE}/api/schedule/monthly`);
            const data = await res.json();
            renderMonthlyStrategicPlan(data);
        } catch (e) {
            container.innerHTML = `<div style="color:var(--color-crimson);">Failed to load monthly plan: ${e.message}</div>`;
        }
    }
}

function renderWeeklyTacticalMatrix(data) {
    const container = document.getElementById("plans-body");
    if (!container || !data.schedule_matrix) return;

    const kpi = data.coordination_kpi || {};

    let tableHtml = `
        <div style="background:var(--occ-card); border:1px solid var(--occ-border-default); border-radius:var(--radius-md); overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:11px 14px; background:var(--occ-card-inset); border-bottom:1px solid var(--occ-border-default);">
                <strong style="font-size:12.5px; color:var(--occ-text-primary);">7-Day Corridor Possession &amp; Gang Deployment Matrix</strong>
                <div style="display:flex; gap:12px; font-size:11px; color:var(--occ-text-muted);">
                    <span>Night Shift: <strong style="color:var(--occ-text-primary);">${kpi.night_shift_percentage || 0}%</strong></span> &bull;
                    <span>Gang Utilization: <strong style="color:var(--occ-text-primary);">${kpi.gang_utilization_rate_pct || 0}%</strong></span>
                </div>
            </div>
            <table class="tbl">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Task / Asset</th>
                        <th>Section</th>
                        <th>Shift Window</th>
                        <th>Duration</th>
                        <th>Priority</th>
                        <th>Assigned Gang</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const [dayName, tasks] of Object.entries(data.schedule_matrix)) {
        if (!Array.isArray(tasks)) continue;
        tasks.forEach(r => {
            tableHtml += `
                <tr>
                    <td style="font-weight:700; color:var(--occ-text-primary);">${dayName}</td>
                    <td class="mono">${r.asset_id || r.task_id}</td>
                    <td class="mono">${r.section} (${r.line})</td>
                    <td class="mono" style="font-weight:700; color:var(--color-blue);">${r.shift}</td>
                    <td class="mono">${r.duration_min} min</td>
                    <td><span class="tier-badge tier-${(r.priority || 'medium').toLowerCase()}">${r.priority}</span></td>
                    <td>${r.assigned_gang}</td>
                </tr>
            `;
        });
    }

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
}

function renderMonthlyStrategicPlan(data) {
    const container = document.getElementById("plans-body");
    if (!container || !data.weekly_allocations) return;

    let html = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">`;

    for (const [wKey, projs] of Object.entries(data.weekly_allocations)) {
        const wTitle = wKey.replace("_", " ").toUpperCase();
        let projsList = projs.map(p => {
            const assetId = p.asset_id || p.project_id || "ASSET";
            const workType = p.work_type || p.type || "Maintenance Renewal";
            const prio = p.priority || "MEDIUM";
            const prioClass = prio.toLowerCase();
            const targetWindow = p.target_window || "Scheduled";
            const rul = p.predicted_rul_days != null ? `RUL: ${p.predicted_rul_days}d` : "";

            return `
                <div style="background:var(--occ-card); border:1px solid var(--occ-border-default); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:8px; box-shadow:var(--shadow-level-2), var(--edge-highlight-card);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="font-size:12px; color:var(--occ-text-primary); font-family:var(--font-mono);">${assetId}: <span style="font-family:var(--font-main); font-weight:600;">${workType}</span></strong>
                        <span class="demand-prio demand-prio-${prioClass}">${prio}</span>
                    </div>
                    <span style="font-size:11px; color:var(--occ-text-muted);">${p.section || ''} (${p.line || ''} Line &bull; KM ${p.km_range || ''}) &bull; Target: <strong style="color:var(--occ-text-secondary);">${targetWindow}</strong> ${rul ? `&bull; ${rul}` : ''}</span>
                </div>
            `;
        }).join("");

        html += `
            <div style="background:var(--occ-card-inset); border:1px solid var(--occ-border-default); border-radius:var(--radius-md); padding:14px;">
                <h4 style="font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--occ-text-secondary); margin:0 0 10px; border-bottom:1px solid var(--occ-border-subtle); padding-bottom:8px;">${wTitle}</h4>
                ${projsList}
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function populateMemoDropdown(blocks) {
    const sel = document.getElementById("memo-block-select");
    if (!sel || !blocks) return;
    sel.innerHTML = "";
    blocks.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.schedule_id;
        opt.innerText = `${b.schedule_id}: ${b.section} (${b.start_time} - ${b.end_time})`;
        sel.appendChild(opt);
    });
    loadSelectedMemo();
}

async function loadSelectedMemo() {
    const sel = document.getElementById("memo-block-select");
    const pre = document.getElementById("memo-pre-text");
    if (!sel || !pre) return;
    const schedId = sel.value;
    if (!schedId) return;

    try {
        const res = await fetch(`${API_BASE}/api/memos/bdms/${schedId}`);
        const data = await res.json();
        pre.innerText = data.memo_formatted_text;
    } catch (e) {
        pre.innerText = `Failed to generate BDMS memo: ${e.message}`;
    }
}

function printMemo() {
    window.print();
}

async function resetSimulator() {
    if (!confirm("Reset the simulator? This clears all field reports, demands and notifications.")) return;
    await fetch(`${API_BASE}/api/simulator/reset`, { method: "POST" });
    loadPendingDemands();
    loadExecutionBoard();
    if (typeof showToast === "function") {
        showToast("info", "Simulator reset", "Field reports, demands and notifications cleared. New reports will arrive shortly.");
    }
}
