/**
 * Track Management System (TMS) Portal Controller.
 *
 * The officer reviews field reports submitted by P-Way patrol gangs (shared
 * console in portal_review.js) and approves them onward to the Central OCC.
 * This file keeps only what is specific to TMS: the requisitions table and the
 * BDMS sanction memo.
 */

const API_BASE = "";

document.addEventListener("DOMContentLoaded", () => {
    initSimClock("tms-sim-clock");
    initNotifications("ENGINEERING_TRACK");
    initPortalReview({
        department: "ENGINEERING_TRACK",
        prefix: "tms",
        onChange: loadTMSDemands
    });

    loadTMSDemands();
    setInterval(loadTMSDemands, 5000);
});

async function loadTMSDemands() {
    try {
        const res = await fetch(`${API_BASE}/api/demand/status/ENGINEERING_TRACK`);
        const data = await res.json();
        renderTMSDemandsTable(data.demands || []);
    } catch (err) {
        console.error("TMS load error:", err);
    }
}

function renderTMSDemandsTable(demands) {
    const tbody = document.getElementById("tms-demands-tbody");
    if (!tbody) return;

    if (!demands || demands.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
                    No active track requisitions. Approve a field report on the left to forward one to the Central OCC.
                </td>
            </tr>
        `;
        return;
    }

    let rows = "";
    demands.forEach(d => {
        const canViewMemo = d.sanction_memo_id &&
            ["APPROVED_SHADOW_BLOCK", "IN_PROGRESS", "COMPLETED"].includes(d.status);

        const actionHtml = canViewMemo
            ? `<button class="btn-portal-back" style="padding:3px 8px; font-size:0.72rem; color:var(--color-blue);" onclick="inspectMemo('${d.sanction_memo_id}')">&#128196; View Sanction Memo</button>`
            : `<span style="color:var(--text-subtle); font-size:0.72rem;">Queued</span>`;

        rows += `
            <tr>
                <td style="font-family:var(--font-mono); font-weight:700; font-size:0.78rem;">${d.demand_id}</td>
                <td style="font-family:var(--font-mono);">${d.section_from} &ndash; ${d.section_to} (${d.line})</td>
                <td>
                    <span style="font-weight:600; font-size:0.78rem;">${d.defect_category}</span>
                    <span style="display:block; font-size:0.70rem; color:var(--text-muted);">KM ${d.km_start} &bull; ${d.priority}</span>
                </td>
                <td style="font-size:0.75rem;">
                    <strong>${d.machine_required}</strong>
                    <span style="display:block; font-size:0.70rem; color:var(--text-muted);">${d.gang_crew}</span>
                </td>
                <td style="font-family:var(--font-mono); font-weight:600;">${d.duration_requested_min} min</td>
                <td>${demandStatusBadge(d.status)}</td>
                <td>${demandWindowHtml(d)}</td>
                <td>${actionHtml}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
}

async function inspectMemo(scheduleId) {
    try {
        const res = await fetch(`${API_BASE}/api/memos/bdms/${scheduleId}`);
        const data = await res.json();
        document.getElementById("memo-modal-title").innerText = `Official BDMS Sanction Order: ${scheduleId}`;
        document.getElementById("memo-modal-text").innerText = data.memo_formatted_text;
        document.getElementById("memo-view-modal").style.display = "flex";
    } catch (err) {
        showToast("danger", "Memo unavailable", err.message);
    }
}
