/**
 * Traction Distribution Management System (TDMS) Portal Controller.
 *
 * The officer reviews field reports submitted by TRD linemen gangs (shared
 * console in portal_review.js) and approves them onward to the Central OCC.
 * This file keeps only what is specific to TDMS: the requisitions table with its
 * 25 kV power-permit column, and the power block sanction memo.
 */

const API_BASE = "";

document.addEventListener("DOMContentLoaded", () => {
    initSimClock("tdms-sim-clock");
    initNotifications("TRACTION_DISTRIBUTION_OHE");
    initPortalReview({
        department: "TRACTION_DISTRIBUTION_OHE",
        prefix: "tdms",
        onChange: loadTDMSDemands
    });

    loadTDMSDemands();
    setInterval(loadTDMSDemands, 5000);
});

async function loadTDMSDemands() {
    try {
        const res = await fetch(`${API_BASE}/api/demand/status/TRACTION_DISTRIBUTION_OHE`);
        const data = await res.json();
        renderTDMSDemandsTable(data.demands || []);
    } catch (err) {
        console.error("TDMS load error:", err);
    }
}

function renderTDMSDemandsTable(demands) {
    const tbody = document.getElementById("tdms-demands-tbody");
    if (!tbody) return;

    if (!demands || demands.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">
                    No active OHE requisitions. Approve a field report on the left to forward one to the Central OCC.
                </td>
            </tr>
        `;
        return;
    }

    let rows = "";
    demands.forEach(d => {
        const sanctioned = ["APPROVED_SHADOW_BLOCK", "IN_PROGRESS", "COMPLETED"].includes(d.status);

        let permitHtml;
        if (d.status === "CANCELLED") {
            permitHtml = `<span style="font-size:0.70rem; color:var(--color-crimson); font-weight:700;">&#9889; PERMIT REVOKED</span>`;
        } else if (sanctioned) {
            permitHtml = `<span style="display:inline-block; font-size:0.70rem; font-weight:700; color:#065f46; background:#d1fae5; border:1px solid #a7f3d0; padding:2px 6px; border-radius:3px;">&#9889; 25kV ISOLATION PERMIT GRANTED</span>`;
        } else {
            permitHtml = `<span style="font-size:0.70rem; color:#92400e;">&#9889; Isolation Queued</span>`;
        }

        const actionHtml = sanctioned && d.sanction_memo_id
            ? `<button class="btn-portal-back" style="padding:3px 8px; font-size:0.72rem; color:#b45309;" onclick="inspectMemo('${d.sanction_memo_id}')">&#128196; View Power Permit</button>`
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
                <td>${permitHtml}</td>
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
        document.getElementById("memo-modal-title").innerText = `Official BDMS 25 kV Power Block Sanction Order: ${scheduleId}`;
        document.getElementById("memo-modal-text").innerText = data.memo_formatted_text;
        document.getElementById("memo-view-modal").style.display = "flex";
    } catch (err) {
        showToast("danger", "Power permit unavailable", err.message);
    }
}
