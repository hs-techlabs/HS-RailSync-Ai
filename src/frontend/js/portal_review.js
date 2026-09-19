/**
 * Shared Department Portal Review Console.
 *
 * The TMS, TDMS and SMMS portals differ only in department code, accent colour
 * and a couple of table columns, so the whole worker-report review workflow
 * lives here once: pending queue, evidence lightbox, approve/reject, and the
 * recently-reviewed history.
 *
 * Each portal calls initPortalReview({...}) and keeps only its own requisitions
 * table and sanction-memo code.
 */

let reviewConfig = {
    department: "ALL",
    prefix: "tms",
    onChange: null      // called after an approve/reject so the portal can refresh
};

// ---------------------------------------------------------------------------
// Status rendering, shared by all three requisition tables
// ---------------------------------------------------------------------------

const DEMAND_STATUS_META = {
    PENDING_SANCTION:      { cls: "status-pending",    text: "&bull; PENDING OCC SANCTION" },
    APPROVED_SHADOW_BLOCK: { cls: "status-approved",   text: "&bull; APPROVED SHADOW BLOCK" },
    IN_PROGRESS:           { cls: "status-inprogress", text: "&bull; BLOCK IN EXECUTION" },
    COMPLETED:             { cls: "status-completed",  text: "&bull; COMPLETED" },
    CANCELLED:             { cls: "status-cancelled",  text: "&bull; WITHDRAWN BY CONTROL" },
    DEFERRED_NEXT_CYCLE:   { cls: "status-deferred",   text: "&bull; DEFERRED - NO WINDOW" }
};

function demandStatusBadge(status) {
    const meta = DEMAND_STATUS_META[status] || { cls: "status-deferred", text: status || "UNKNOWN" };
    return `<span class="status-badge ${meta.cls}">${meta.text}</span>`;
}

/** Human-readable window cell for a demand, including TODAY / TOMORROW. */
function demandWindowHtml(d) {
    if (d.status === "DEFERRED_NEXT_CYCLE") {
        return `<span style="color:#b45309; font-size:0.72rem;">${d.deferral_reason || "No window available"}</span>`;
    }
    if (d.status === "CANCELLED") {
        return `<span style="color:var(--color-crimson); font-size:0.72rem;">${d.cancellation_reason || "Withdrawn"}</span>`;
    }
    if (!d.sanctioned_window) {
        return `<span style="color:var(--text-muted); font-size:0.74rem;">Awaiting Controller Approval</span>`;
    }
    const dayTag = d.window_day_label
        ? `<span style="display:block; font-size:0.66rem; color:var(--text-muted); letter-spacing:0.4px;">${d.window_day_label}</span>`
        : "";
    return `<strong style="color:var(--color-blue); font-family:var(--font-mono); font-size:0.78rem;">${d.sanctioned_window}</strong>${dayTag}`;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function attachmentThumbHtml(att) {
    if (att.type === "image") {
        return `<img class="attachment-thumb" src="${att.url}" alt="${att.filename}"
                     onclick="openAttachmentModal('${att.url}','image','${att.filename}')">`;
    }
    return `<div class="attachment-thumb attachment-thumb-pdf" title="${att.filename}"
                 onclick="openAttachmentModal('${att.url}','pdf','${att.filename}')">&#128196;</div>`;
}

function openAttachmentModal(url, type, filename) {
    const body = document.getElementById("attachment-modal-body");
    const title = document.getElementById("attachment-modal-title");
    if (!body) return;

    if (title) title.innerText = filename ? `Field Evidence — ${filename}` : "Field Evidence";
    if (type === "image") {
        body.innerHTML = `<img src="${url}" style="max-width:100%; border-radius:6px; display:block;">`;
    } else {
        body.innerHTML = `
            <embed src="${url}" type="application/pdf" style="width:100%; height:65vh; border-radius:6px;">
            <p style="margin-top:10px; font-size:0.76rem;">
                <a href="${url}" target="_blank" rel="noopener">Open PDF in a new tab</a>
            </p>`;
    }
    document.getElementById("attachment-view-modal").style.display = "flex";
}

// ---------------------------------------------------------------------------
// Pending review queue
// ---------------------------------------------------------------------------

async function loadPendingWorkerRequests() {
    try {
        const res = await fetch(`/api/worker_requests/pending?department=${reviewConfig.department}`);
        const data = await res.json();
        renderReviewQueue(data.requests || []);

        const counter = document.getElementById(`${reviewConfig.prefix}-review-count`);
        if (counter) counter.innerText = `${data.total} Awaiting`;
    } catch (err) {
        console.error("Review queue load failed:", err);
    }
}

function renderReviewQueue(requests) {
    const container = document.getElementById(`${reviewConfig.prefix}-review-queue`);
    if (!container) return;

    if (!requests.length) {
        container.innerHTML = `<div class="review-queue-empty">
            No field reports awaiting review. Patrol gangs are still out on the corridor&hellip;
        </div>`;
        return;
    }

    container.innerHTML = requests.map(r => {
        const section = r.section_label || `${r.section_from} - ${r.section_to}`;
        const flags = [];
        if (r.power_block_required) flags.push("25 kV power block");
        if (r.disconnection_required) flags.push("S&amp;T disconnection");
        if (r.machine_required && r.machine_required !== "NONE") flags.push(r.machine_required);
        const flagHtml = flags.length
            ? `<div class="review-card-meta">Requires: ${flags.join(" &bull; ")}</div>` : "";

        return `
        <div class="review-card">
            <div class="review-card-top">
                <span class="tier-badge tier-${(r.priority || "low").toLowerCase()}">${r.priority}</span>
                <span class="review-card-id">${r.request_id}</span>
            </div>
            <div class="review-card-title">${r.defect_category}</div>
            <div class="review-card-meta">${section} (${r.line}) &bull; KM ${Number(r.km_start).toFixed(1)}
                &bull; ${r.duration_requested_min} min requested</div>
            <div class="review-card-desc">${r.description}</div>
            ${flagHtml}
            <div class="review-card-meta">Submitted by ${r.submitted_by} &bull; Asset ${r.asset_id}</div>
            <div class="review-card-attachments">
                ${(r.attachments || []).map(attachmentThumbHtml).join("")}
            </div>
            <div class="review-card-actions">
                <button class="btn-approve-demand" onclick="approveWorkerRequest('${r.request_id}', this)">
                    Approve &amp; Forward to OCC
                </button>
                <button class="btn-reject-demand" onclick="rejectWorkerRequest('${r.request_id}', this)">
                    Reject
                </button>
            </div>
        </div>`;
    }).join("");
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

function _lockCard(btn, label) {
    if (!btn) return;
    const card = btn.closest(".review-card");
    if (card) card.querySelectorAll("button").forEach(b => { b.disabled = true; });
    btn.innerText = label;
}

async function approveWorkerRequest(requestId, btn) {
    _lockCard(btn, "Forwarding…");
    try {
        const res = await fetch(`/api/worker_requests/${requestId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reason: "Site evidence verified; forwarded to Central OCC for block sanction.",
                reviewed_by: "Department Officer"
            })
        });
        const data = await res.json();
        if (data.status === "SUCCESS") {
            refreshReviewPanels();
            if (typeof reviewConfig.onChange === "function") reviewConfig.onChange();
        } else {
            showToast("danger", "Approval failed", data.detail || "Please retry.");
            loadPendingWorkerRequests();
        }
    } catch (err) {
        showToast("danger", "Approval failed", err.message);
        loadPendingWorkerRequests();
    }
}

async function rejectWorkerRequest(requestId, btn) {
    if (!confirm("Reject this field report? It will not be forwarded to the Central OCC.")) return;
    _lockCard(btn, "Rejecting…");
    try {
        const res = await fetch(`/api/worker_requests/${requestId}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reason: "Not actionable / insufficient evidence",
                reviewed_by: "Department Officer"
            })
        });
        const data = await res.json();
        if (data.status === "SUCCESS") {
            refreshReviewPanels();
        } else {
            showToast("danger", "Rejection failed", data.detail || "Please retry.");
            loadPendingWorkerRequests();
        }
    } catch (err) {
        showToast("danger", "Rejection failed", err.message);
        loadPendingWorkerRequests();
    }
}

// ---------------------------------------------------------------------------
// Recently reviewed
// ---------------------------------------------------------------------------

async function loadReviewHistory() {
    const container = document.getElementById(`${reviewConfig.prefix}-review-history`);
    if (!container) return;

    try {
        const res = await fetch(`/api/worker_requests/history?department=${reviewConfig.department}`);
        const data = await res.json();
        const requests = data.requests || [];

        if (!requests.length) {
            container.innerHTML = `<div class="review-queue-empty">No reports reviewed yet.</div>`;
            return;
        }

        container.innerHTML = requests.map(r => {
            const approved = r.status === "APPROVED_FORWARDED";
            const badge = approved
                ? `<span class="status-badge status-approved">&#10003; APPROVED</span>`
                : `<span class="status-badge status-rejected">&times; REJECTED</span>`;
            const reviewedAt = r.reviewed_at
                ? new Date(r.reviewed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "--:--";
            return `
            <div class="review-history-item">
                ${badge}
                <div class="review-history-main">
                    <div class="review-history-title">${r.defect_category}
                        <span style="font-family:var(--font-mono); font-weight:400; color:var(--text-muted);">
                            &bull; ${r.request_id}</span>
                    </div>
                    <div class="review-history-note">${r.review_note || ""}</div>
                    <div class="review-history-note">
                        ${r.reviewed_by || "Officer"} at ${reviewedAt} corridor time
                    </div>
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        console.error("Review history load failed:", err);
    }
}

function refreshReviewPanels() {
    loadPendingWorkerRequests();
    loadReviewHistory();
}

/**
 * Boots the review console for one department portal.
 * @param {object} cfg  { department, prefix, onChange }
 */
function initPortalReview(cfg) {
    reviewConfig = Object.assign(reviewConfig, cfg);
    refreshReviewPanels();
    setInterval(refreshReviewPanels, 5000);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const modal = document.getElementById("attachment-view-modal");
            if (modal) modal.style.display = "none";
        }
    });
}
