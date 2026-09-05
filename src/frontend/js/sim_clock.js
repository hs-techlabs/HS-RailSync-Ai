/**
 * Shared Simulator Clock & Notification Engine.
 *
 * Loaded by the Central OCC desk and all three department portals so every
 * screen reads the same accelerated corridor clock and the same event stream.
 *
 * The clock is polled every 5s but rendered every second by interpolating
 * locally with the server's multiplier - polling alone would make the badge
 * jump ~6.7 simulated minutes at a time instead of ticking.
 */

const SIM_CLOCK_POLL_MS = 5000;

let simClockBaseMs = null;      // server sim time at last sync (epoch ms)
let simClockSyncedAt = null;    // performance.now() at last sync
let simClockMultiplier = 1;
let simClockTargets = [];

function _renderSimClock() {
    if (simClockBaseMs === null) return;
    const realElapsed = performance.now() - simClockSyncedAt;
    const simNow = new Date(simClockBaseMs + realElapsed * simClockMultiplier);
    const text = simNow.toLocaleTimeString("en-IN", { hour12: false });

    simClockTargets.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) el.innerHTML = t.prefix + text + t.suffix;
    });
}

async function _syncSimClock() {
    try {
        const res = await fetch("/api/clock/now");
        const data = await res.json();
        simClockBaseMs = new Date(data.sim_time).getTime();
        simClockSyncedAt = performance.now();
        simClockMultiplier = data.multiplier || 1;
        _renderSimClock();
    } catch (err) {
        console.error("Sim clock sync failed:", err);
    }
}

/**
 * Renders the accelerated clock into an element.
 * @param {string} elementId  target element
 * @param {string} prefix     markup placed before the time (e.g. an icon)
 * @param {string} suffix     markup placed after the time (e.g. " IST")
 */
function initSimClock(elementId, prefix = "&#9201; ", suffix = " IST") {
    simClockTargets.push({ id: elementId, prefix: prefix, suffix: suffix });
    if (simClockTargets.length === 1) {
        _syncSimClock();
        setInterval(_syncSimClock, SIM_CLOCK_POLL_MS);
        setInterval(_renderSimClock, 1000);
    } else {
        _renderSimClock();
    }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const EVENT_ICONS = {
    REPORT_SUBMITTED: "&#128221;",
    REPORT_APPROVED: "&#9989;",
    REPORT_REJECTED: "&#10060;",
    DEMAND_SANCTIONED: "&#128203;",
    DEMAND_DEFERRED: "&#9203;",
    BLOCK_STARTED: "&#128679;",
    BLOCK_COMPLETED: "&#127937;",
    BLOCK_CANCELLED: "&#128680;"
};

let notifyDepartment = "ALL";
let notifyLastSeq = 0;
let notifyPrimed = false;
let notifyOnEvents = null;

function _ensureToastStack() {
    let stack = document.getElementById("toast-stack");
    if (!stack) {
        stack = document.createElement("div");
        stack.id = "toast-stack";
        stack.className = "toast-stack";
        document.body.appendChild(stack);
    }
    return stack;
}

function showToast(severity, title, message, icon) {
    const stack = _ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-${severity || "info"}`;
    toast.innerHTML = `
        <div class="toast-icon">${icon || "&#128276;"}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;
    toast.querySelector(".toast-close").onclick = () => toast.remove();
    stack.prepend(toast);

    // Keep the stack readable; drop the oldest once it gets deep.
    while (stack.children.length > 5) stack.lastElementChild.remove();
    setTimeout(() => {
        toast.classList.add("toast-leaving");
        setTimeout(() => toast.remove(), 400);
    }, 9000);
}

async function pollNotifications() {
    try {
        const res = await fetch(
            `/api/events/feed?department=${encodeURIComponent(notifyDepartment)}&after_seq=${notifyLastSeq}`
        );
        const data = await res.json();
        const events = data.events || [];

        // First poll only establishes the high-water mark. Without this a page
        // load would replay every event already in the log as a burst of toasts.
        if (!notifyPrimed) {
            notifyPrimed = true;
            notifyLastSeq = data.latest_seq || 0;
            if (typeof notifyOnEvents === "function") notifyOnEvents(events, true);
            return;
        }

        if (events.length) {
            events.forEach(ev => {
                showToast(ev.severity, ev.title, ev.message, EVENT_ICONS[ev.kind]);
                if (ev.seq > notifyLastSeq) notifyLastSeq = ev.seq;
            });
            if (typeof notifyOnEvents === "function") notifyOnEvents(events, false);
        }
        if (data.latest_seq > notifyLastSeq) notifyLastSeq = data.latest_seq;
    } catch (err) {
        console.error("Notification poll failed:", err);
    }
}

/**
 * Starts the notification feed.
 * @param {string}   department  department code, or "ALL" for the OCC desk
 * @param {function} onEvents    optional callback(events, isInitialPrime)
 */
function initNotifications(department, onEvents) {
    notifyDepartment = department || "ALL";
    notifyOnEvents = onEvents || null;
    pollNotifications();
    setInterval(pollNotifications, SIM_CLOCK_POLL_MS);
}
