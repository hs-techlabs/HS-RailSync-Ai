/**
 * Signal Maintenance Management System (SMMS) Portal Controller.
 *
 * The officer reviews field reports submitted by signal maintainer gangs (shared
 * console in portal_review.js) and approves them onward to the Central OCC.
 * This file keeps only what is specific to SMMS: the requisitions table with its
 * S&T/T-351 disconnection-notice column, and the disconnection memo.
 */

const API_BASE = "";

document.addEventListener("DOMContentLoaded", () => {
    initSimClock("smms-sim-clock");
    initNotifications("SIGNAL_AND_TELECOM");
    initPortalReview({
        department: "SIGNAL_AND_TELECOM",
        prefix: "smms",
        onChange: loadSMMSDemands
    });

    loadSMMSDemands();
    setInterval(loadSMMSDemands, 5000);
});

async function loadSMMSDemands() {
    try {
        const res = await fetch(`${API_BASE}/api/demand/status/SIGNAL_AND_TELECOM`);
        const data = await res.json();
        renderSMMSDemandsTable(data.demands || []);
    } catch (err) {
        console.error("SMMS load error:", err);
    }
}

function renderSMMSDemandsTable(demands) {
    const tbody = document.getElementById("smms-demands-tbody");
    if (!tbody) return;

    if (!demands || demands.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">
                    No active S&amp;T requisitions. Approve a field report on the left to forward one to the Central OCC.
                </td>
            </tr>
        `;
        return;
    }

    let rows = "";
    demands.forEach(d => {
        const sanctioned = ["APPROVED_SHADOW_BLOCK", "IN_PROGRESS", "COMPLETED"].includes(d.status);

        let discHtml;
        if (d.status === "CANCELLED") {
            discHtml = `<span style="font-size:0.70rem; color:var(--color-crimson); font-weight:700;">MEMO WITHDRAWN</span>`;
        } else if (sanctioned) {
            discHtml = `<span style="display:inline-block; font-size:0.70rem; font-weight:700; color:#065f46; background:#d1fae5; border:1px solid #a7f3d0; padding:2px 6px; border-radius:3px;">&#10003; S&amp;T/T-351 MEMO ACCEPTED</span>`;
        } else {
            discHtml = `<span style="font-size:0.70rem; color:#92400e;">Notice Queued</span>`;
        }

        const actionHtml = sanctioned && d.sanction_memo_id
            ? `<button class="btn-portal-back" style="padding:3px 8px; font-size:0.72rem; color:#047857;" onclick="inspectMemo('${d.sanction_memo_id}')">&#128196; View Disconnection Memo</button>`
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
                    <strong>${d.gang_crew}</strong>
                    <span style="display:block; font-size:0.70rem; color:var(--text-muted);">${d.machine_required}</span>
                </td>
                <td style="font-family:var(--font-mono); font-weight:600;">${d.duration_requested_min} min</td>
                <td>${discHtml}</td>
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
        document.getElementById("memo-modal-title").innerText = `Official S&T Disconnection & Block Sanction Order: ${scheduleId}`;
        document.getElementById("memo-modal-text").innerText = data.memo_formatted_text;
        document.getElementById("memo-view-modal").style.display = "flex";
    } catch (err) {
        showToast("danger", "Disconnection memo unavailable", err.message);
    }
}
