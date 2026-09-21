/**
 * Indian Railways Station Yard Interlocking Schematic Renderer (SVG).
 * Renders authentic IRSEM-compliant yard layouts with interactive S&T point switches,
 * signal aspects, layer visibility toggles, pan/zoom controls, and diagnostic telemetry.
 */

const API_BASE = (typeof window !== "undefined" && window.API_BASE !== undefined) ? window.API_BASE : "";
let currentYardData = null;
let currentZoomScale = 1.0;
let yardLayers = {
    points: true,
    signals: true,
    masts: true
};
let switchPositions = {}; // id -> 'NORMAL' | 'REVERSE'

async function openYardSchematic(stationCode) {
    const modal = document.getElementById("yard-modal");
    if (!modal) return;

    modal.style.display = "flex";
    const container = document.getElementById("yard-svg-wrapper");
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:320px; color:var(--text-muted);">
            <p>Loading IRSEM Electronic Interlocking layout for ${stationCode}...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE}/api/station/yard/${stationCode}`);
        if (!res.ok) throw new Error(`Station yard ${stationCode} not found`);
        currentYardData = await res.json();
        currentZoomScale = 1.0;
        switchPositions = {};
        renderYardSchematic(currentYardData);
    } catch (e) {
        container.innerHTML = `<div style="padding:20px; color:var(--color-crimson);">Failed to load yard schematic: ${e.message}</div>`;
    }
}

function closeYardModal() {
    const modal = document.getElementById("yard-modal");
    if (modal) modal.style.display = "none";
}

function toggleYardLayer(layerName) {
    if (yardLayers.hasOwnProperty(layerName)) {
        yardLayers[layerName] = !yardLayers[layerName];
        const btn = document.getElementById(`toggle-layer-${layerName.slice(0, 4)}`);
        if (btn) btn.classList.toggle("active", yardLayers[layerName]);
        if (currentYardData) renderYardSchematic(currentYardData);
    }
}

function zoomYardSvg(factor) {
    currentZoomScale = Math.max(0.7, Math.min(2.0, currentZoomScale * factor));
    const svgEl = document.querySelector(".yard-svg-canvas");
    if (svgEl) {
        svgEl.style.transform = `scale(${currentZoomScale})`;
        svgEl.style.transformOrigin = "top left";
    }
}

function resetYardZoom() {
    currentZoomScale = 1.0;
    const svgEl = document.querySelector(".yard-svg-canvas");
    if (svgEl) {
        svgEl.style.transform = "scale(1.0)";
    }
}

function toggleSwitchRoute(pointId) {
    switchPositions[pointId] = switchPositions[pointId] === "REVERSE" ? "NORMAL" : "REVERSE";
    if (currentYardData) {
        renderYardSchematic(currentYardData);
        inspectYardPoint(pointId);
    }
}

function renderYardSchematic(yard) {
    const headerTitle = document.getElementById("yard-modal-title");
    const headerSubtitle = document.getElementById("yard-modal-subtitle");
    const container = document.getElementById("yard-svg-wrapper");

    if (headerTitle) {
        headerTitle.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            ${yard.station_name} Junction (${yard.station_code}) &mdash; Interlocking Yard Schematic (KM ${yard.km})
        `;
    }

    if (headerSubtitle) {
        headerSubtitle.innerHTML = `
            ${yard.interlocking_type} &bull; ${yard.platform_count} Platforms &bull; ${yard.track_count} Tracks &bull; Speed: ${yard.speed_limit_kmph} km/h &bull; <span style="color:var(--text-muted); font-size:0.74rem;">${yard.layout_source}</span>
        `;
    }

    // SVG coordinate space
    const svgWidth = 1060;
    const maxTrackY = Math.max(...yard.tracks.map(t => t.y), 260);
    const svgHeight = maxTrackY + 65;

    let svg = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="yard-svg-canvas" style="transform: scale(${currentZoomScale}); transform-origin: top left;" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" stroke-width="0.8"/>
                </pattern>
                <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="115%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.06"/>
                </filter>
            </defs>

            <!-- Grid Backdrop -->
            <rect width="100%" height="100%" fill="url(#grid)" />
    `;

    // 1. Render Platform Slabs
    yard.platforms.forEach(plf => {
        const plfWidth = plf.x_end - plf.x_start;
        const plfY = plf.y - 10;
        svg += `
            <g class="yard-platform-group">
                <rect x="${plf.x_start}" y="${plfY}" width="${plfWidth}" height="20" rx="3" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1" filter="url(#card-shadow)" />
                <text x="${plf.x_start + plfWidth / 2}" y="${plfY + 14}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#475569">
                    PLATFORM ${plf.number}
                </text>
            </g>
        `;
    });

    // 2. Render Track Lines (Visible stroke: 3.5px for mainlines, 2.5px for loops)
    yard.tracks.forEach(tr => {
        const strokeColor = tr.is_main ? "#0f2b5c" : (tr.type === "branch" ? "#475569" : "#2563eb");
        const strokeWidth = tr.is_main ? "3.5" : (tr.type === "branch" ? "2.0" : "2.5");
        const strokeDash = tr.type === "siding" ? "6,4" : "none";

        svg += `
            <g class="yard-track-group" title="${tr.label}">
                <line x1="80" y1="${tr.y}" x2="980" y2="${tr.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" stroke-linecap="round" />
                <text x="70" y="${tr.y + 4}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="600" fill="#64748b">
                    ${tr.label.split(" (")[0]}
                </text>
            </g>
        `;
    });

    // 3. Render Point Turnouts (If layer enabled)
    if (yardLayers.points) {
        yard.points.forEach(pt => {
            const isReverse = switchPositions[pt.id] === "REVERSE";
            const beaconColor = pt.priority_tier === "CRITICAL" ? "#dc2626" : (pt.priority_tier === "HIGH" ? "#d97706" : (pt.priority_tier === "MEDIUM" ? "#2563eb" : "#059669"));
            const lineStroke = isReverse ? "#6366f1" : "#0f2b5c";
            const lineWidth = isReverse ? "3.5" : "2.5";

            svg += `
                <g class="yard-point-line-group" style="cursor:pointer;" onclick="inspectYardPoint('${pt.id}')">
                    <!-- Diagonal crossover line -->
                    <line x1="${pt.x1}" y1="${pt.y1}" x2="${pt.x2}" y2="${pt.y2}" stroke="${lineStroke}" stroke-width="${lineWidth}" stroke-linecap="round" />
                    
                    <!-- Hinge Beacon -->
                    <circle cx="${pt.x1}" cy="${pt.y1}" r="5" fill="${beaconColor}" stroke="#ffffff" stroke-width="1.5" />
                    
                    <!-- IRSEM Point Number Badge -->
                    <rect x="${(pt.x1 + pt.x2) / 2 - 18}" y="${(pt.y1 + pt.y2) / 2 - 8}" width="36" height="14" rx="2" fill="#ffffff" stroke="${isReverse ? '#6366f1' : beaconColor}" stroke-width="1" />
                    <text x="${(pt.x1 + pt.x2) / 2}" y="${(pt.y1 + pt.y2) / 2 + 2}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7.5" font-weight="700" fill="#0f172a">
                        ${pt.id}
                    </text>
                </g>
            `;
        });
    }

    // 4. Render Signals (If layer enabled)
    if (yardLayers.signals) {
        yard.signals.forEach(sig => {
            const isHome = sig.type === "HOME";
            const isStarter = sig.type === "STARTER";
            const headColor = isHome ? "#dc2626" : (isStarter ? "#059669" : "#2563eb");

            svg += `
                <g class="yard-signal-group" title="${sig.id} (${sig.type})">
                    <line x1="${sig.x}" y1="${sig.y - 16}" x2="${sig.x}" y2="${sig.y}" stroke="#475569" stroke-width="1.5" />
                    <circle cx="${sig.x}" cy="${sig.y - 16}" r="4" fill="${headColor}" stroke="#ffffff" stroke-width="1" />
                    <text x="${sig.x}" y="${sig.y - 20}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7.5" font-weight="700" fill="#475569">
                        ${sig.label}
                    </text>
                </g>
            `;
        });
    }

    // 5. Render OHE Masts (If layer enabled)
    if (yardLayers.masts && yard.ohe_masts) {
        yard.ohe_masts.forEach(m => {
            const mastColor = m.status === "CRITICAL" ? "#dc2626" : (m.status === "WORN" ? "#d97706" : "#64748b");
            svg += `
                <g class="yard-mast-group" title="OHE Mast ${m.id} (KM ${m.km}) &bull; Wire Wear: ${m.wear_pct}%">
                    <line x1="${m.x}" y1="${m.y - 12}" x2="${m.x}" y2="${m.y}" stroke="${mastColor}" stroke-width="1.2" stroke-dasharray="2,2" />
                    <rect x="${m.x - 3}" y="${m.y - 16}" width="6" height="4" fill="${mastColor}" rx="1" />
                    <text x="${m.x}" y="${m.y - 18}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" font-weight="600" fill="${mastColor}">
                        ${m.id}
                    </text>
                </g>
            `;
        });
    }

    svg += `</svg>`;

    // Build Active Blocks Banner if present
    let blockBannerHtml = "";
    if (yard.active_blocks && yard.active_blocks.length > 0) {
        const b = yard.active_blocks[0];
        blockBannerHtml = `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius-sm); padding:8px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:var(--color-crimson); font-size:0.82rem;">&#9888; Active Scheduled Shadow Block: ${b.schedule_id} (${b.section})</strong>
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:1px;">Window: <strong>${b.start_time} - ${b.end_time}</strong> (${b.duration_min}m) &bull; ${b.power_block_required ? '25kV OHE Power Block Active' : 'No OHE Cut'} &bull; Downtime Saved: ${b.downtime_saved_min}m</p>
                </div>
                <span class="badge-accent" style="background:#ffffff; border-color:#fca5a5; color:var(--color-crimson); font-weight:700; font-size:0.72rem;">LIVE ISOLATION</span>
            </div>
        `;
    }

    container.innerHTML = `
        ${blockBannerHtml}
        <div class="yard-schematic-scrollbox">
            ${svg}
        </div>
        <div id="yard-point-inspector" style="margin-top:12px;">
            <!-- Telemetry populated on point click -->
        </div>
    `;

    // Default inspect first point machine
    if (yard.points && yard.points.length > 0) {
        inspectYardPoint(yard.points[0].id);
    }
}

function inspectYardPoint(pointId) {
    if (!currentYardData || !currentYardData.points) return;
    const pt = currentYardData.points.find(p => p.id === pointId);
    if (!pt) return;

    const inspector = document.getElementById("yard-point-inspector");
    if (!inspector) return;

    const tierClass = `tier-${pt.priority_tier.toLowerCase()}`;
    const isReverse = switchPositions[pt.id] === "REVERSE";

    inspector.innerHTML = `
        <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:10px;">
                <div>
                    <h4 style="font-size:0.92rem; font-weight:700; color:var(--color-primary);">${pt.name} &bull; S&T Asset: ${pt.asset_id}</h4>
                    <span class="text-muted" style="font-size:0.75rem;">Route Setting: <strong>${isReverse ? 'REVERSE (Diverging Loop Line)' : 'NORMAL (Straight Mainline)'}</strong> &bull; IRSEM Spec: 4.0s - 5.0s Throw</span>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="btn-secondary" style="padding:3px 8px; font-size:0.72rem;" onclick="toggleSwitchRoute('${pt.id}')">
                        &#x21c4; Toggle Route (${isReverse ? 'Set Normal' : 'Set Reverse'})
                    </button>
                    <span class="tier-badge ${tierClass}">${pt.priority_tier}</span>
                    <button class="btn-secondary" style="padding:3px 8px; font-size:0.72rem;" onclick="closeYardModal(); switchTab('assets-tab'); explainAsset('${pt.asset_id}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Full SHAP XAI
                    </button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; font-size:0.78rem; text-align:center;">
                <div style="background:#ffffff; border:1px solid var(--border-color); padding:8px; border-radius:var(--radius-xs);">
                    <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Throw Time</span>
                    <h4 style="font-family:var(--font-mono); font-size:1.05rem; color:${pt.throw_time_sec > 5.5 ? 'var(--color-crimson)' : 'var(--color-primary)'}; margin-top:1px;">${pt.throw_time_sec} s</h4>
                    <span style="font-size:0.68rem; color:${pt.throw_time_sec > 5.5 ? 'var(--color-crimson)' : 'var(--color-emerald)'};">${pt.throw_time_sec > 5.5 ? 'Sluggish (>5.5s)' : 'Normal'}</span>
                </div>

                <div style="background:#ffffff; border:1px solid var(--border-color); padding:8px; border-radius:var(--radius-xs);">
                    <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Peak Motor Current</span>
                    <h4 style="font-family:var(--font-mono); font-size:1.05rem; color:${pt.motor_current_amps > 3.0 ? 'var(--color-crimson)' : 'var(--color-primary)'}; margin-top:1px;">${pt.motor_current_amps} A</h4>
                    <span style="font-size:0.68rem; color:${pt.motor_current_amps > 3.0 ? 'var(--color-crimson)' : 'var(--color-emerald)'};">${pt.motor_current_amps > 3.0 ? 'Friction Spike' : 'Nominal'}</span>
                </div>

                <div style="background:#ffffff; border:1px solid var(--border-color); padding:8px; border-radius:var(--radius-xs);">
                    <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Cable Insulation</span>
                    <h4 style="font-family:var(--font-mono); font-size:1.05rem; color:${pt.insulation_mohm < 2.0 ? 'var(--color-crimson)' : 'var(--color-primary)'}; margin-top:1px;">${pt.insulation_mohm} M&Omega;</h4>
                    <span style="font-size:0.68rem; color:${pt.insulation_mohm < 2.0 ? 'var(--color-crimson)' : 'var(--color-emerald)'};">${pt.insulation_mohm < 2.0 ? 'Low Insulation' : 'Safe'}</span>
                </div>

                <div style="background:#ffffff; border:1px solid var(--border-color); padding:8px; border-radius:var(--radius-xs);">
                    <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Predicted RUL</span>
                    <h4 style="font-family:var(--font-mono); font-size:1.05rem; color:var(--color-indigo); margin-top:1px;">${pt.predicted_rul_days} Days</h4>
                    <span style="font-size:0.68rem; color:var(--text-secondary);">Failure Risk: ${pt.failure_probability_pct}%</span>
                </div>
            </div>
        </div>
    `;
}
