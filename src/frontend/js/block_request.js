/**
 * Block Request Form - the Inspect -> prefill -> Request Block flow.
 *
 * An officer clicks Inspect on a reported issue on the corridor map and gets a
 * fully prefilled block requisition: everything the field report already stated
 * is filled in, the site evidence is attached, and the only action required at
 * the end is the Request Block button.
 *
 * Nothing is fetched. The map's issue feature already carries the entire worker
 * request in `detail` - attachments included - so the form opens instantly from
 * data in hand.
 *
 * On submit this posts to the existing POST /api/worker_requests/{id}/approve.
 * Any field the officer edited travels as an optional override on that same
 * request, so this flow and the plain approve button in portal_review.js share
 * one endpoint and produce identical demand records.
 */

const BlockRequestForm = (function () {
    "use strict";

    const MODAL_ID = "block-request-modal";

    let currentFeature = null;
    let onSubmitted = null;

    function esc(v) {
        return String(v === null || v === undefined ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /** Injects the modal shell once, so any page can use this with no HTML changes. */
    function ensureModal() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = MODAL_ID;
        modal.className = "modal-overlay";
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="modal-card" style="max-width:660px;">
                <div class="modal-header">
                    <h3 id="brf-title">Block Requisition</h3>
                    <button class="modal-close" data-role="close">&times;</button>
                </div>
                <div class="modal-body" data-role="body"></div>
            </div>`;
        document.body.appendChild(modal);

        modal.querySelector("[data-role=close]").addEventListener("click", close);
        modal.addEventListener("click", e => { if (e.target === modal) close(); });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && modal.style.display === "flex") close();
        });

        return modal;
    }

    function close() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.style.display = "none";
        currentFeature = null;
    }

    function attachmentsHtml(atts) {
        if (!atts || !atts.length) {
            return `<p style="font-size:.74rem;color:var(--text-muted);margin:0;">
                        No site evidence attached to this report.</p>`;
        }
        const canOpen = typeof window.openAttachmentModal === "function";
        return `<div style="display:flex;gap:8px;flex-wrap:wrap;">` + atts.map(a => {
            const click = canOpen
                ? `onclick="openAttachmentModal('${esc(a.url)}','${esc(a.type)}','${esc(a.filename)}')"`
                : `onclick="window.open('${esc(a.url)}','_blank')"`;
            return a.type === "image"
                ? `<img src="${esc(a.url)}" title="${esc(a.filename)}" ${click}
                        style="width:92px;height:68px;object-fit:cover;border-radius:6px;
                               border:1px solid var(--border-color);cursor:pointer;">`
                : `<div ${click} title="${esc(a.filename)}"
                        style="width:92px;height:68px;display:flex;align-items:center;justify-content:center;
                               font-size:26px;border-radius:6px;border:1px solid var(--border-color);
                               background:var(--bg-surface-subtle);cursor:pointer;">&#128196;</div>`;
        }).join("") + `</div>`;
    }

    function sectionTitle(text) {
        return `<div style="font-size:.68rem;font-weight:700;text-transform:uppercase;
                            letter-spacing:.5px;color:var(--text-muted);
                            margin:16px 0 8px;padding-bottom:5px;
                            border-bottom:1px solid var(--border-color);">${esc(text)}</div>`;
    }

    /** A read-only fact, for the parts of the report an officer must not rewrite. */
    function fact(label, value) {
        return `
            <div>
                <label style="display:block;font-size:.68rem;color:var(--text-muted);margin-bottom:3px;">
                    ${esc(label)}</label>
                <div style="font-size:.8rem;font-weight:600;font-family:var(--font-mono);
                            padding:7px 9px;background:var(--bg-surface-subtle);
                            border:1px solid var(--border-color);border-radius:var(--radius-xs);">
                    ${esc(value)}</div>
            </div>`;
    }

    function grid(inner, cols) {
        return `<div style="display:grid;grid-template-columns:repeat(${cols || 3},1fr);gap:10px;">${inner}</div>`;
    }

    /**
     * Opens the prefilled requisition for one map issue feature.
     * @param {object} feature  an `issues` feature from CorridorMap
     * @param {function} done   optional callback fired after a successful submit
     */
    function open(feature, done) {
        if (!feature || !feature.detail) return;

        currentFeature = feature;
        onSubmitted = done || null;

        const d = feature.detail;
        const modal = ensureModal();
        const body = modal.querySelector("[data-role=body]");

        modal.querySelector("#brf-title").innerHTML =
            `Block Requisition &mdash; <span style="font-family:var(--font-mono);">${esc(d.request_id)}</span>`;

        const section = d.section_label || `${d.section_from} - ${d.section_to}`;
        const machine = (d.machine_required && d.machine_required !== "NONE") ? d.machine_required : "NONE";

        body.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                        background:var(--bg-surface-subtle);border:1px solid var(--border-color);
                        border-radius:var(--radius-sm);">
                <span class="tier-badge tier-${esc(String(d.priority).toLowerCase())}">${esc(d.priority)}</span>
                <div>
                    <div style="font-weight:700;font-size:.86rem;">${esc(d.defect_category)}</div>
                    <div style="font-size:.72rem;color:var(--text-muted);">
                        Reported by ${esc(d.submitted_by)} &bull; Asset ${esc(d.asset_id)}
                    </div>
                </div>
            </div>

            ${sectionTitle("Location (from the field report)")}
            ${grid(
                fact("Section", section) +
                fact("Line", d.line) +
                fact("Chainage", `KM ${Number(d.km_start).toFixed(1)} - ${Number(d.km_end).toFixed(1)}`)
            )}

            ${sectionTitle("Site evidence")}
            ${attachmentsHtml(d.attachments)}

            ${sectionTitle("Requisition details")}
            ${grid(`
                <div class="form-group" style="margin:0;">
                    <label>Duration required (min)</label>
                    <input class="form-input" type="number" min="15" max="480" step="5"
                           id="brf-duration" value="${esc(d.duration_requested_min)}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Priority</label>
                    <select class="form-select" id="brf-priority">
                        ${["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(p =>
                            `<option value="${p}"${p === d.priority ? " selected" : ""}>${p}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Machine / plant</label>
                    <input class="form-input" type="text" id="brf-machine" value="${esc(machine)}">
                </div>
            `)}

            <div class="form-group" style="margin:10px 0 0;">
                <label>Gang / crew assigned</label>
                <input class="form-input" type="text" id="brf-gang" value="${esc(d.gang_crew)}">
            </div>

            <div class="form-group" style="margin:10px 0 0;">
                <label>Work description</label>
                <textarea class="form-textarea" id="brf-description" rows="3">${esc(d.description)}</textarea>
            </div>

            ${sectionTitle("Safety interlocks")}
            <div style="display:flex;flex-direction:column;gap:8px;">
                <label style="display:flex;align-items:center;gap:8px;font-size:.78rem;cursor:pointer;">
                    <input type="checkbox" id="brf-power" ${d.power_block_required ? "checked" : ""}>
                    <span>25 kV AC traction power block / OHE isolation required</span>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:.78rem;cursor:pointer;">
                    <input type="checkbox" id="brf-disc" ${d.disconnection_required ? "checked" : ""}>
                    <span>S&amp;T / T-351 signalling disconnection required</span>
                </label>
                <p style="margin:0;font-size:.7rem;color:var(--text-muted);">
                    These are auto-enforced by department rule at the OCC - a TDMS demand always
                    carries a power block, and an SMMS demand always carries a disconnection.
                </p>
            </div>

            <div style="display:flex;align-items:center;gap:10px;margin-top:20px;padding-top:14px;
                        border-top:1px solid var(--border-color);">
                <button class="btn-approve-demand" id="brf-submit" style="flex:1;padding:10px;">
                    Request Block
                </button>
                <button class="btn-portal-back" data-role="cancel" style="padding:10px 16px;">Cancel</button>
            </div>
            <p id="brf-note" style="margin:8px 0 0;font-size:.72rem;color:var(--text-muted);">
                Submitting forwards this requisition to the Central OCC (BDMS) desk, where it is
                bundled with co-located work into a shadow block and allocated a sanctioned window.
            </p>
        `;

        body.querySelector("[data-role=cancel]").addEventListener("click", close);
        body.querySelector("#brf-submit").addEventListener("click", submit);

        modal.style.display = "flex";
        body.scrollTop = 0;
    }

    async function submit() {
        if (!currentFeature) return;

        const btn = document.getElementById("brf-submit");
        const note = document.getElementById("brf-note");
        const requestId = currentFeature.detail.request_id;

        btn.disabled = true;
        btn.innerText = "Requesting block…";

        const val = id => document.getElementById(id);
        const payload = {
            reason: "Site evidence inspected on corridor map; block requisition raised by officer.",
            reviewed_by: "Department Officer",
            duration_requested_min: parseInt(val("brf-duration").value, 10),
            priority: val("brf-priority").value,
            machine_required: val("brf-machine").value.trim() || "NONE",
            gang_crew: val("brf-gang").value.trim(),
            description: val("brf-description").value.trim(),
            power_block_required: val("brf-power").checked,
            disconnection_required: val("brf-disc").checked
        };

        try {
            const res = await fetch(`/api/worker_requests/${requestId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.status === "SUCCESS") {
                if (typeof window.showToast === "function") {
                    showToast("success", `Block requested: ${data.demand.demand_id}`,
                        "Forwarded to the Central OCC for sanction.");
                }
                close();
                if (typeof onSubmitted === "function") onSubmitted(data);
                if (typeof window.refreshReviewPanels === "function") refreshReviewPanels();
            } else {
                throw new Error(data.detail || "Request rejected by the server.");
            }
        } catch (err) {
            btn.disabled = false;
            btn.innerText = "Request Block";
            if (note) {
                note.style.color = "var(--color-crimson)";
                note.innerText = `Could not raise the block: ${err.message}`;
            }
        }
    }

    return { open: open, close: close };
})();

/** Convenience handle for CorridorMap's `onInspect` option. */
function openBlockRequestForm(feature, mapInstance) {
    BlockRequestForm.open(feature, () => {
        if (mapInstance && typeof mapInstance.refresh === "function") mapInstance.refresh();
    });
}
