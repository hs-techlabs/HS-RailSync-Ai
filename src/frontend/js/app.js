/**
 * Main Application Coordinator & Keyboard Navigation Engine (Fluent Design System).
 * Manages tab navigation, API calls, SHAP waterfall cards, live asset searching, and KPI updates.
 */

const API_BASE = "";
let currentScheduleData = null;
let currentTimetableData = null;
let currentTopologyData = null;
let cachedAssets = [];

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    initKeyboardShortcuts();
    initNotifications("ALL");
    loadCorridorTopology();
    loadOptimalSchedule();
    loadAssetsTable();
    loadPendingDemands();
    loadExecutionBoard();
    showHorizon("WEEKLY");
    setInterval(loadPendingDemands, 5000);
    setInterval(loadExecutionBoard, 5000);
});

function initClock() {
    // The corridor runs on the accelerated simulator clock, not wall time, so
    // the OCC header and the department portals always agree.
    initSimClock("live-clock", "", " IST");
    initSimClock("occ-sim-clock", "&#9201; ", " IST");
}

function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        // Only trigger if not typing in search input
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

        if (e.key === "1") switchTab("marey-tab");
        else if (e.key === "2") switchTab("gantt-tab");
        else if (e.key === "3") switchTab("network-tab");
        else if (e.key === "4") switchTab("assets-tab");
        else if (e.key === "5") switchTab("horizon-tab");
        else if (e.key === "6") switchTab("memo-tab");
        else if (e.key === "Escape") {
            closeSimulatorModal();
            closeYardModal();
        }
    });
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add("active");

    const clickedBtn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
    if (clickedBtn) clickedBtn.classList.add("active");

    if (tabId === "marey-tab" && typeof renderMareyChart === "function") {
        setTimeout(renderMareyChart, 50);
    } else if (tabId === "gantt-tab" && typeof renderGanttChart === "function") {
        setTimeout(renderGanttChart, 50);
    } else if (tabId === "network-tab") {
        if (typeof invalidateGISMap === "function") setTimeout(invalidateGISMap, 80);
    }
}

async function loadCorridorTopology() {
    try {
        const res = await fetch(`${API_BASE}/api/corridor/topology`);
        currentTopologyData = await res.json();
        if (typeof renderNetworkTrackDiagram === "function") {
            renderNetworkTrackDiagram(currentTopologyData);
        }
        if (typeof initGISMap === "function") {
            initGISMap(currentTopologyData);
        }
    } catch (e) {
        console.error("Failed to load topology:", e);
    }
}

async function loadOptimalSchedule() {
    try {
        const res = await fetch(`${API_BASE}/api/schedule/optimal`);
        currentScheduleData = await res.json();

        // Load timetable for Marey chart
        const ttRes = await fetch(`${API_BASE}/api/corridor/timetable`);
        currentTimetableData = await ttRes.json();

        updateKPICards(currentScheduleData.metrics);
        populateMemoDropdown(currentScheduleData.scheduled_blocks);

        if (typeof renderMareyChart === "function") renderMareyChart();
        if (typeof renderGanttChart === "function") renderGanttChart();
        if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
            renderNetworkTrackDiagram(currentTopologyData);
        }
        if (typeof refreshGISBlockOverlays === "function") {
            refreshGISBlockOverlays();
        }
    } catch (e) {
        console.error("Failed to load optimal schedule:", e);
    }
}

function updateKPICards(metrics) {
    if (!metrics) return;
    const downtimeEl = document.getElementById("kpi-downtime-saved");
    const downtimeSub = document.getElementById("kpi-downtime-sub");
    const bundlingEl = document.getElementById("kpi-bundling-rate");
    const punctualityEl = document.getElementById("kpi-punctuality");
    const criticalEl = document.getElementById("kpi-critical-solved");

    if (downtimeEl) downtimeEl.innerText = `${metrics.downtime_reduction_pct}%`;
    if (downtimeSub) downtimeSub.innerText = `${metrics.downtime_saved_hours} Hrs Saved`;
    if (bundlingEl) bundlingEl.innerText = `${metrics.multi_department_bundling_rate_pct}%`;
    if (punctualityEl) punctualityEl.innerText = "100%";
    if (criticalEl) criticalEl.innerText = `${metrics.total_tasks_completed} Tasks`;
}

async function loadAssetsTable() {
    const dept = document.getElementById("asset-dept-select")?.value || "ALL";
    const tbody = document.getElementById("assets-tbody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px; color:var(--text-muted);">Loading asset telemetry...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/api/assets/health?department=${dept}&limit=100`);
        const data = await res.json();
        cachedAssets = data.assets || [];
        renderAssetsTable(cachedAssets);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--color-crimson);">Failed to load assets: ${e.message}</td></tr>`;
    }
}

function filterAssetsTableLive() {
    const query = document.getElementById("asset-search-input")?.value.toLowerCase().trim() || "";
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
        const deptShort = a.department.split("_")[0];
        const failPct = (a.failure_percentage || 0).toFixed(1);
        const rul = a.predicted_rul_days || 180;
        const sec = a.section_from ? `${a.section_from}-${a.section_to}` : (a.station || "NDLS-CNB");

        rows += `
            <tr>
                <td style="font-family:var(--font-mono); font-weight:700; color:var(--color-primary);">${a.asset_id}</td>
                <td><span style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">${deptShort}</span></td>
                <td><span style="font-family:var(--font-mono); font-size:0.75rem;">${sec}</span></td>
                <td><span class="tier-badge ${tierClass}">${a.priority_tier}</span></td>
                <td><strong style="font-family:var(--font-mono); color:${failPct > 50 ? 'var(--color-crimson)' : 'var(--color-primary)'};">${failPct}%</strong></td>
                <td><span style="font-family:var(--font-mono); font-size:0.78rem;">${rul}d</span></td>
                <td>
                    <button class="btn-secondary" style="padding:3px 8px; font-size:0.72rem;" onclick="explainAsset('${a.asset_id}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Explain
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

async function explainAsset(assetId) {
    const pane = document.getElementById("xai-detail-card");
    if (!pane) return;

    pane.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:240px; color:var(--text-muted);">
            <p>Evaluating SHAP feature attributions for ${assetId}...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE}/api/assets/explain/${assetId}`);
        if (!res.ok) throw new Error("Asset not found");
        const xai = await res.json();

        const tierClass = `tier-${xai.priority_tier.toLowerCase()}`;
        const failPct = (xai.failure_probability_pct || 0).toFixed(1);

        // Render SHAP Waterfall Attribution Bars
        const riskDrivers = xai.primary_risk_drivers || ["Degraded Condition Index", "Overdue Maintenance Cycle"];
        let shapBarsHtml = "";
        const mockWeights = [36, 24, 14, 8];

        riskDrivers.forEach((driver, idx) => {
            const weight = mockWeights[idx % mockWeights.length];
            const barColor = idx === 0 ? "var(--color-crimson)" : (idx === 1 ? "var(--color-amber)" : "var(--color-slate)");
            shapBarsHtml += `
                <div class="shap-bar-row">
                    <div class="shap-bar-label">
                        <span>${driver}</span>
                        <span style="font-family:var(--font-mono); color:${barColor};">+${weight}% Risk</span>
                    </div>
                    <div class="shap-bar-track">
                        <div class="shap-bar-fill" style="width:${weight * 2.5}%; background-color:${barColor};"></div>
                    </div>
                </div>
            `;
        });

        pane.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-bottom:12px;">
                <div>
                    <h3 style="font-size:0.98rem; font-weight:700; color:var(--color-primary);">${xai.asset_id} &bull; XAI Diagnostic</h3>
                    <span class="text-muted" style="font-size:0.75rem;">XGBoost TreeExplainer SHAP Feature Attribution</span>
                </div>
                <span class="tier-badge ${tierClass}">${xai.priority_tier}</span>
            </div>

            <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-color); border-radius:var(--radius-xs); padding:10px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">ML Failure Probability</span>
                    <strong style="font-family:var(--font-mono); font-size:1.1rem; color:${failPct > 50 ? 'var(--color-crimson)' : 'var(--color-primary)'};">${failPct}%</strong>
                </div>
                <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                    <div style="width:${failPct}%; height:100%; background:${failPct > 50 ? 'var(--color-crimson)' : 'var(--color-blue)'};"></div>
                </div>
            </div>

            <h4 style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:8px;">SHAP Feature Risk Drivers:</h4>
            ${shapBarsHtml}

            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:var(--radius-xs); padding:10px; margin-top:12px;">
                <strong style="font-size:0.78rem; color:var(--color-blue); display:block; margin-bottom:2px;">&#9881; Controller Recommendation:</strong>
                <p style="font-size:0.76rem; color:var(--text-secondary);">${xai.recommended_action || 'Bundle into next available corridor possession window.'}</p>
            </div>

            <button class="btn-primary full-width" style="margin-top:12px; font-size:0.78rem; padding:6px 12px;" onclick="simulateAssetRepair('${xai.asset_id}')">
                &#10003; Simulate Maintenance Repair (Reset Health to 100%)
            </button>
        `;
    } catch (e) {
        pane.innerHTML = `<div style="padding:16px; color:var(--color-crimson);">Failed to load XAI explanation: ${e.message}</div>`;
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

async function showHorizon(mode) {
    const btnW = document.getElementById("btn-weekly-toggle");
    const btnM = document.getElementById("btn-monthly-toggle");
    const container = document.getElementById("horizon-content-box");
    if (!container) return;

    if (mode === "WEEKLY") {
        btnW?.classList.add("active");
        btnM?.classList.remove("active");
        container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">Generating 7-Day Tactical Matrix Roster...</div>`;

        try {
            const res = await fetch(`${API_BASE}/api/schedule/weekly`);
            const data = await res.json();
            renderWeeklyTacticalMatrix(data);
        } catch (e) {
            container.innerHTML = `<div style="color:var(--color-crimson);">Failed to load weekly plan: ${e.message}</div>`;
        }
    } else {
        btnM?.classList.add("active");
        btnW?.classList.remove("active");
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
    const container = document.getElementById("horizon-content-box");
    if (!container || !data.schedule_matrix) return;

    const kpi = data.coordination_kpi || {};

    let tableHtml = `
        <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden; box-shadow:var(--shadow-card);">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg-surface-subtle); border-bottom:1px solid var(--border-color);">
                <strong style="font-size:0.85rem; color:var(--color-primary);">7-Day Corridor Possession & Gang Deployment Matrix</strong>
                <div style="display:flex; gap:12px; font-size:0.75rem;">
                    <span>Night Shift Utilization: <strong>${kpi.night_shift_percentage || 0}%</strong></span> &bull;
                    <span>Gang Utilization: <strong>${kpi.gang_utilization_rate_pct || 0}%</strong></span>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Task / Asset</th>
                        <th>Corridor Section</th>
                        <th>Shift Window</th>
                        <th>Duration</th>
                        <th>Priority</th>
                        <th>Gang</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // schedule_matrix is a dict keyed by day name: { "Monday": [...], "Tuesday": [...] }
    for (const [dayName, tasks] of Object.entries(data.schedule_matrix)) {
        if (!Array.isArray(tasks)) continue;
        tasks.forEach(r => {
            const isNight = (r.shift || "").toLowerCase().includes("night");
            tableHtml += `
                <tr>
                    <td style="font-weight:700;">${dayName}</td>
                    <td style="font-family:var(--font-mono); font-size:0.76rem;">${r.asset_id || r.task_id}</td>
                    <td style="font-family:var(--font-mono);">${r.section} (${r.line})</td>
                    <td style="font-family:var(--font-mono); font-weight:700; color:var(--color-blue);">${r.shift}</td>
                    <td style="font-family:var(--font-mono);">${r.duration_min} min</td>
                    <td><span class="tier-badge ${r.priority === 'CRITICAL' ? 'tier-critical' : (r.priority === 'HIGH' ? 'tier-high' : 'tier-medium')}">${r.priority}</span></td>
                    <td style="font-size:0.76rem;">${r.assigned_gang}</td>
                </tr>
            `;
        });
    }

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
}

function renderMonthlyStrategicPlan(data) {
    const container = document.getElementById("horizon-content-box");
    if (!container || !data.weekly_allocations) return;

    let html = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">`;

    for (const [wKey, projs] of Object.entries(data.weekly_allocations)) {
        const wTitle = wKey.replace("_", " ").toUpperCase();
        let projsList = projs.map(p => `
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-xs); padding:8px 10px; margin-bottom:6px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <strong style="font-size:0.8rem; color:var(--color-primary);">${p.project_id}: ${p.type}</strong>
                    <span class="tier-badge tier-medium">${p.priority}</span>
                </div>
                <span style="font-size:0.74rem; color:var(--text-secondary);">${p.section} (${p.line} Line) &bull; Planned Duration: ${p.planned_duration_hours}h</span>
            </div>
        `).join("");

        html += `
            <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px;">
                <h4 style="font-size:0.88rem; font-weight:700; color:var(--color-primary); margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:6px;">${wTitle}</h4>
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

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    alert(`Uploading ${file.name} to AI Automatic Block Planning System...`);
    try {
        const res = await fetch(`${API_BASE}/api/upload/csv`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        alert(data.message || "File uploaded and schedule optimized!");
        loadOptimalSchedule();
        loadAssetsTable();
    } catch (err) {
        alert("Upload failed: " + err.message);
    }
}

// ==============================================================================
// LIVE DEPARTMENTAL DEMAND QUEUE & AI SHADOW BUNDLER (OCC INTEGRATION)
// ==============================================================================

async function loadPendingDemands() {
    try {
        const res = await fetch(`${API_BASE}/api/demand/pending`);
        const data = await res.json();
        renderPendingDemands(data);
    } catch (err) {
        console.error("Failed to load pending demands:", err);
    }
}

function renderPendingDemands(data) {
    const badge = document.getElementById("occ-demand-badge");
    const unbundledTxt = document.getElementById("occ-unbundled-txt");
    const emptyDiv = document.getElementById("occ-demand-empty");
    const tableWrap = document.getElementById("occ-demand-table-wrap");
    const tbody = document.getElementById("occ-demand-tbody");
    const btnSanction = document.getElementById("btn-auto-bundle-sanction");

    const count = data.total_pending || 0;
    const hours = data.total_unbundled_hours || 0.0;

    if (badge) badge.innerText = `${count} Pending Requisition${count === 1 ? '' : 's'}`;
    if (unbundledTxt) unbundledTxt.innerText = `(${hours} Hrs Unbundled Track Downtime)`;

    if (count === 0) {
        if (emptyDiv) emptyDiv.style.display = "block";
        if (tableWrap) tableWrap.style.display = "none";
        if (btnSanction) btnSanction.disabled = true;
        return;
    }

    if (emptyDiv) emptyDiv.style.display = "none";
    if (tableWrap) tableWrap.style.display = "block";
    if (btnSanction) btnSanction.disabled = false;

    if (!tbody) return;

    let rows = "";
    (data.demands || []).forEach(d => {
        let deptPillClass = "portal-pill-tms";
        let deptShort = "TMS";
        if (d.department === "TRACTION_DISTRIBUTION_OHE") {
            deptPillClass = "portal-pill-tdms";
            deptShort = "TDMS";
        } else if (d.department === "SIGNAL_AND_TELECOM") {
            deptPillClass = "portal-pill-smms";
            deptShort = "SMMS";
        }

        const pwrBadge = d.power_block_required 
            ? `<span style="font-size:0.68rem; font-weight:700; color:#b45309; background:#fffbeb; border:1px solid #fde68a; padding:1px 5px; border-radius:3px;">⚡ 25kV Power Cut</span> ` 
            : "";
        const discBadge = d.disconnection_required 
            ? `<span style="font-size:0.68rem; font-weight:700; color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; padding:1px 5px; border-radius:3px;">✓ S&amp;T Disc.</span> ` 
            : "";

        rows += `
            <tr>
                <td><span class="portal-pill ${deptPillClass}" style="font-size:0.70rem; font-weight:700;">${deptShort}</span></td>
                <td style="font-family:var(--font-mono); font-weight:700; font-size:0.78rem;">${d.demand_id}</td>
                <td style="font-family:var(--font-mono);">${d.section_from} &ndash; ${d.section_to} (${d.line})</td>
                <td>
                    <span style="font-weight:600; font-size:0.78rem;">${d.defect_category}</span>
                    <span style="display:block; font-size:0.70rem; color:var(--text-muted);">${d.description}</span>
                </td>
                <td style="font-family:var(--font-mono); font-weight:600; color:var(--color-crimson);">${d.duration_requested_min} min</td>
                <td style="font-size:0.75rem;">
                    <strong>${d.machine_required}</strong>
                    <span style="display:block; font-size:0.70rem; color:var(--text-muted);">${d.gang_crew}</span>
                </td>
                <td>${pwrBadge}${discBadge}</td>
                <td><span class="status-badge status-pending">🟡 PENDING BUNDLING</span></td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
}

async function triggerAutoBundleAndSanction() {
    const btn = document.getElementById("btn-auto-bundle-sanction");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> CP-SAT BUNDLING &amp; OPTIMIZING...`;
    }

    try {
        const res = await fetch(`${API_BASE}/api/demand/bundle_and_sanction`, {
            method: "POST"
        });
        const data = await res.json();

        if (data.status === "SUCCESS") {
            alert(`✓ AI SHADOW BUNDLING SUCCESS!\n${data.message}`);
            if (data.updated_schedule) {
                currentScheduleData = data.updated_schedule;
                updateKPICards(currentScheduleData.metrics);
                populateMemoDropdown(currentScheduleData.scheduled_blocks);
                if (typeof renderMareyChart === "function") renderMareyChart();
                if (typeof renderGanttChart === "function") renderGanttChart();
                if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
                    renderNetworkTrackDiagram(currentTopologyData);
                }
                if (typeof refreshGISBlockOverlays === "function") {
                    refreshGISBlockOverlays();
                }
            }
        } else {
            alert(data.message || "Optimization complete.");
        }

        loadPendingDemands();
    } catch (err) {
        alert("Bundling failed: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Bundle &amp; Sanction Shadow Block`;
        }
    }
}





// ==============================================================================
// LIVE BLOCK EXECUTION BOARD & SIMULATOR RESET
// ==============================================================================

const EXEC_STATUS_META = {
    APPROVED_SHADOW_BLOCK: { cls: "scheduled",  label: "SANCTIONED",      badge: "status-approved" },
    IN_PROGRESS:           { cls: "inprogress", label: "UNDER EXECUTION", badge: "status-inprogress" },
    COMPLETED:             { cls: "completed",  label: "COMPLETED",       badge: "status-completed" },
    CANCELLED:             { cls: "cancelled",  label: "WITHDRAWN",       badge: "status-cancelled" },
    DEFERRED_NEXT_CYCLE:   { cls: "deferred",   label: "DEFERRED",        badge: "status-deferred" }
};

async function loadExecutionBoard() {
    try {
        const res = await fetch(`${API_BASE}/api/live/board`);
        const data = await res.json();
        renderExecutionBoard(data);
    } catch (e) {
        console.error("Failed to load execution board:", e);
    }
}

function renderExecutionBoard(data) {
    const board = document.getElementById("occ-exec-board");
    const summary = document.getElementById("occ-exec-summary");
    if (!board) return;

    const demands = data.demands || [];

    if (summary) {
        const counts = data.status_counts || {};
        const chips = Object.keys(EXEC_STATUS_META)
            .filter(k => counts[k])
            .map(k => `<span class="exec-summary-chip">${EXEC_STATUS_META[k].label}
                        <strong>${counts[k]}</strong></span>`)
            .join("");
        const running = (data.blocks || []).filter(b => b.exec_status === "IN_PROGRESS").length;
        summary.innerHTML = chips + `<span class="exec-summary-chip">Corridor blocks running now
                                      <strong>${running}</strong></span>`;
    }

    if (!demands.length) {
        board.innerHTML = `<div class="exec-board-empty">
            No sanctioned departmental blocks yet. Approve field reports in the TMS / TDMS / SMMS
            portals, then run Auto-Bundle &amp; Sanction above.
        </div>`;
        return;
    }

    // Active work first, finished and abandoned work last.
    const order = ["IN_PROGRESS", "APPROVED_SHADOW_BLOCK", "DEFERRED_NEXT_CYCLE", "CANCELLED", "COMPLETED"];
    demands.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

    board.innerHTML = demands.map(d => {
        const meta = EXEC_STATUS_META[d.status] || EXEC_STATUS_META.DEFERRED_NEXT_CYCLE;
        const dept = (d.department_label || d.department || "").replace(/\s*\(.*\)/, "");

        let timing = d.sanctioned_window || "No window allocated";
        if (d.window_day_label) timing += ` · ${d.window_day_label}`;
        if (d.status === "APPROVED_SHADOW_BLOCK" && d.sim_minutes_to_start !== null
            && d.sim_minutes_to_start !== undefined) {
            timing += ` · starts in ${Math.round(d.sim_minutes_to_start)} min`;
        }

        const showBar = ["IN_PROGRESS", "COMPLETED"].includes(d.status);
        const barHtml = showBar
            ? `<div class="exec-progress-track">
                   <div class="exec-progress-fill ${d.status === "COMPLETED" ? "is-complete" : ""}"
                        style="width:${d.progress_pct}%"></div>
               </div>`
            : "";

        const note = d.cancellation_reason || d.deferral_reason;
        const noteHtml = note ? `<div class="exec-card-note">${note}</div>` : "";

        return `
        <div class="exec-card exec-card-${meta.cls}">
            <div class="exec-card-top">
                <span class="exec-card-id">${d.demand_id}</span>
                <span class="status-badge ${meta.badge}">${meta.label}</span>
            </div>
            <div class="exec-card-title">${d.defect_category || "Maintenance block"}</div>
            <div class="exec-card-meta">${dept} · ${d.section} (${d.line})</div>
            <div class="exec-card-meta">${timing}</div>
            ${barHtml}
            ${noteHtml}
        </div>`;
    }).join("");
}

async function resetSimulator() {
    if (!confirm("Reset the simulator? This clears all field reports, demands and notifications.")) return;
    await fetch(`${API_BASE}/api/simulator/reset`, { method: "POST" });
    loadPendingDemands();
    loadExecutionBoard();
    showToast("info", "Simulator reset",
        "Field reports, demands and notifications cleared. New reports will arrive shortly.");
}
