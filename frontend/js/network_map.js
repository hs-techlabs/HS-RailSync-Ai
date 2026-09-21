/**
 * Indian Railways Centralized Traffic Control (CTC) Corridor Track Map.
 * Renders the 440 KM New Delhi - Kanpur Central trunk line with separate UP & DN lines,
 * station junctions, speed limits, chainage markers, and station yard interlocking drill-down.
 */

function renderNetworkTrackDiagram(topology) {
    const container = document.getElementById("corridor-track-diagram");
    if (!container || !topology || !topology.stations) return;

    const stations = topology.stations;
    const scheduledBlocks = (currentScheduleData && currentScheduleData.scheduled_blocks) ? currentScheduleData.scheduled_blocks : [];

    let html = `
        <div class="ctc-corridor-board">
            <div class="ctc-legend">
                <div class="ctc-legend-title">
                    <!-- Fluent Board 18 Regular -->
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                    NDLS &ndash; CNB High-Density Trunk Route (440.0 KM) &bull; CTC Control Board
                </div>
                <div class="ctc-legend-items">
                    <span class="ctc-line-indicator"><span class="ctc-dot" style="background:#2563eb;"></span> DN Line (To Kanpur)</span>
                    <span class="ctc-line-indicator"><span class="ctc-dot" style="background:#4f46e5;"></span> UP Line (To New Delhi)</span>
                    <span class="ctc-line-indicator"><span class="ctc-dot" style="background:#dc2626;"></span> Active Shadow Block</span>
                    <span class="ctc-line-indicator"><span class="ctc-dot" style="background:#059669;"></span> Normal Operation</span>
                </div>
            </div>

            <div class="track-schematic-grid">
                <!-- DOWN TRACK (NDLS -> CNB) -->
                <div class="track-row">
                    <div class="track-header-tag dn-tag">DN LINE &rarr;</div>
                    <div class="track-rail-segments">
    `;

    // Render segments for DN track
    for (let i = 0; i < stations.length - 1; i++) {
        const sFrom = stations[i];
        const sTo = stations[i + 1];
        const secLabel = `${sFrom.code} - ${sTo.code}`;

        const block = scheduledBlocks.find(b => b.line === "DN" && (b.section.includes(sFrom.code) && b.section.includes(sTo.code)));

        if (block) {
            html += `
                <div class="rail-segment-box active-block" onclick="inspectBlock('${block.schedule_id}')" title="Block ${block.schedule_id} on DN Line (${secLabel}): ${block.duration_min}m">
                    <span class="block-tag-badge">&#9881; ${block.schedule_id} (${block.duration_min}m)</span>
                </div>
            `;
        } else {
            html += `
                <div class="rail-segment-box" onclick="inspectSection('${secLabel}', 'DN', ${sFrom.km}, ${sTo.km})" title="DN Line: ${secLabel} (${sFrom.km}k - ${sTo.km}k) &bull; Clear">
                    <span style="font-size: 0.68rem; color: var(--text-muted);">&bull;&bull;&bull;</span>
                </div>
            `;
        }
    }

    html += `
                    </div>
                </div>

                <!-- STATION NODES ROW -->
                <div class="station-node-row">
    `;

    stations.forEach(st => {
        html += `
            <div class="station-pill-item" onclick="inspectStation('${st.code}')" ondblclick="openYardSchematic('${st.code}')" title="Click to inspect ${st.name} (${st.code}) &mdash; Double click for Interlocking Schematic">
                <div class="station-badge-bubble">${st.code}</div>
                <span class="station-name-text">${st.name}</span>
                <span class="station-km-text">${st.km} KM</span>
            </div>
        `;
    });

    html += `
                </div>

                <!-- UP TRACK (CNB -> NDLS) -->
                <div class="track-row">
                    <div class="track-header-tag up-tag">&larr; UP LINE</div>
                    <div class="track-rail-segments">
    `;

    // Render segments for UP track
    for (let i = 0; i < stations.length - 1; i++) {
        const sFrom = stations[i];
        const sTo = stations[i + 1];
        const secLabel = `${sFrom.code} - ${sTo.code}`;

        const block = scheduledBlocks.find(b => b.line === "UP" && (b.section.includes(sFrom.code) && b.section.includes(sTo.code)));

        if (block) {
            html += `
                <div class="rail-segment-box active-block" onclick="inspectBlock('${block.schedule_id}')" title="Block ${block.schedule_id} on UP Line (${secLabel}): ${block.duration_min}m">
                    <span class="block-tag-badge">&#9881; ${block.schedule_id} (${block.duration_min}m)</span>
                </div>
            `;
        } else {
            html += `
                <div class="rail-segment-box" onclick="inspectSection('${secLabel}', 'UP', ${sFrom.km}, ${sTo.km})" title="UP Line: ${secLabel} (${sFrom.km}k - ${sTo.km}k) &bull; Clear">
                    <span style="font-size: 0.68rem; color: var(--text-muted);">&bull;&bull;&bull;</span>
                </div>
            `;
        }
    }

    html += `
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Default inspect Tundla (major junction)
    inspectStation("TDL");
}

function inspectStation(stCode) {
    if (!currentTopologyData) return;
    const st = currentTopologyData.stations.find(s => s.code === stCode);
    if (!st) return;

    const pane = document.getElementById("station-detail-pane");
    if (!pane) return;

    const depotsHtml = st.depots.map(d => `<span class="badge-accent" style="margin-right: 6px; padding: 4px 8px; font-size: 0.76rem;">${d}</span>`).join("");

    pane.innerHTML = `
        <div class="station-detail-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h3 style="color: var(--color-primary); font-size: 1.02rem; font-weight: 700;">${st.name} Junction (${st.code}) &mdash; KM ${st.km}</h3>
                    <span class="text-secondary" style="font-size: 0.78rem;">Division: <strong>${st.division}</strong> &bull; Max Speed Limit: <strong>${st.speed_limit_kmph} km/h</strong> &bull; Passenger Platforms: <strong>${st.platforms}</strong></span>
                </div>
                <div style="display: flex; gap: 6px;">
                    ${depotsHtml}
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 14px; font-size: 0.8rem; align-items: center;">
                <div>
                    <strong style="color: var(--text-primary); display: block; margin-bottom: 3px;">Signalling & Interlocking Standard:</strong>
                    <span style="color: var(--text-secondary);">Automatic Block Signalling (ABS) with Electronic Interlocking (EI), Track Circuit & Axle Counter Detection, 25 kV AC 50 Hz Traction.</span>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-primary" onclick="openYardSchematic('${st.code}')" style="font-size: 0.78rem; padding: 6px 12px;">
                        <!-- Fluent Search 14 Regular -->
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                        Inspect Yard Interlocking
                    </button>
                    <button class="btn-secondary" onclick="openSimulatorAtSection('${st.code}')" style="font-size: 0.78rem; padding: 6px 12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 8 4 4-4 4"/></svg>
                        Test Disruption
                    </button>
                </div>
            </div>
        </div>
    `;
}

function inspectSection(secName, line, kmStart, kmEnd) {
    const pane = document.getElementById("station-detail-pane");
    if (!pane) return;

    pane.innerHTML = `
        <div class="station-detail-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h3 style="color: var(--color-primary); font-size: 1.02rem; font-weight: 700;">Track Section: ${secName} &bull; ${line} Line</h3>
                    <span class="text-secondary" style="font-size: 0.78rem;">Chainage: KM ${kmStart} to KM ${kmEnd} (Length: ${(kmEnd - kmStart).toFixed(1)} KM)</span>
                </div>
                <span class="badge-success">&#10003; Clear for Traffic</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Normal train headway maintenance window available. Zero active Temporary Speed Restrictions (TSR).</p>
        </div>
    `;
}

function inspectBlock(schedId) {
    if (!currentScheduleData) return;
    const b = currentScheduleData.scheduled_blocks.find(x => x.schedule_id === schedId);
    if (!b) return;

    const pane = document.getElementById("station-detail-pane");
    if (!pane) return;

    const depts = b.departments.map(d => d.replace("_", " ")).join(" + ");
    const tasksHtml = b.descriptions.map((d, i) => `<li style="margin-bottom: 4px;"><strong>[Task ${i+1}]</strong> ${d}</li>`).join("");

    pane.innerHTML = `
        <div class="station-detail-card" style="border-left: 4px solid var(--color-indigo);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h3 style="color: var(--color-indigo); font-size: 1.02rem; font-weight: 700;">${b.schedule_id}: ${b.section} (${b.line} Line)</h3>
                    <span class="text-secondary" style="font-size: 0.78rem;">Approved Window: <strong>${b.start_time} to ${b.end_time}</strong> (${b.duration_min} Minutes) &bull; KM Range: ${b.km_range}</span>
                </div>
                <span class="badge-accent" style="background:#f5f3ff; color:#4f46e5; border-color:#ddd6fe;">${b.is_multi_department ? 'SHADOW BUNDLED' : 'SINGLE BLOCK'}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
                <strong>Participating Departments:</strong> ${depts}<br>
                <strong>Power Cut (TRD):</strong> ${b.power_block_required ? 'MANDATORY 25kV OHE Isolation' : 'Not Required'} &bull; <strong>Downtime Saved:</strong> ${b.downtime_saved_min} Minutes
            </div>
            <ul style="font-size: 0.78rem; color: var(--text-primary); padding-left: 18px;">
                ${tasksHtml}
            </ul>
        </div>
    `;
}

function openSimulatorAtSection(stCode) {
    openSimulatorModal();
    const select = document.getElementById("sim-defect-sec");
    if (select) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value.includes(stCode)) {
                select.selectedIndex = i;
                break;
            }
        }
    }
}
