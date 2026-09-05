/**
 * Dynamic What-If Disruption Simulator UI Controller.
 * Manages modal display, injection triggers, dynamic recalculations,
 * and 1-Click Judge Demo presets.
 */

function openSimulatorModal() {
    if (typeof gisMap !== "undefined" && gisMap) {
        gisMap.closePopup();
    }
    const modal = document.getElementById("simulator-modal");
    if (modal) modal.style.display = "flex";
}

function closeSimulatorModal() {
    const modal = document.getElementById("simulator-modal");
    if (modal) modal.style.display = "none";
}

function switchSimMode(mode) {
    document.getElementById("sim-tab-train")?.classList.toggle("active", mode === "TRAIN");
    document.getElementById("sim-tab-defect")?.classList.toggle("active", mode === "DEFECT");

    document.getElementById("sim-controls-train").style.display = mode === "TRAIN" ? "block" : "none";
    document.getElementById("sim-controls-defect").style.display = mode === "DEFECT" ? "block" : "none";
    document.getElementById("sim-result-box").style.display = "none";
}

function triggerJudgePreset(presetKey) {
    if (presetKey === "FOG_RAJDHANI") {
        switchSimMode("TRAIN");
        const sel = document.getElementById("sim-train-select");
        const range = document.getElementById("sim-delay-range");
        if (sel) sel.value = "12424";
        if (range) {
            range.value = "45";
            document.getElementById("delay-val-badge").innerText = "45 Min";
        }
        runTrainDelaySimulation();
    } else if (presetKey === "RAIL_FRACTURE") {
        switchSimMode("DEFECT");
        const sec = document.getElementById("sim-defect-sec");
        const line = document.getElementById("sim-defect-line");
        const dept = document.getElementById("sim-defect-dept");
        if (sec) sec.value = "TDL - FZD";
        if (line) line.value = "DN";
        if (dept) dept.value = "ENGINEERING_TRACK";
        runDefectSimulation();
    } else if (presetKey === "OHE_SNAG") {
        switchSimMode("DEFECT");
        const sec = document.getElementById("sim-defect-sec");
        const line = document.getElementById("sim-defect-line");
        const dept = document.getElementById("sim-defect-dept");
        if (sec) sec.value = "GZB - DER";
        if (line) line.value = "UP";
        if (dept) dept.value = "TRACTION_DISTRIBUTION_OHE";
        runDefectSimulation();
    }
}

async function runTrainDelaySimulation() {
    const trainNo = document.getElementById("sim-train-select")?.value || "12424";
    const delayMin = parseInt(document.getElementById("sim-delay-range")?.value || "40");

    const resBox = document.getElementById("sim-result-box");
    resBox.style.display = "block";
    document.getElementById("sim-status-badge").innerText = "SOLVING WITH CP-SAT...";
    document.getElementById("sim-res-summary").innerText = `Injecting +${delayMin}m delay on Train ${trainNo}...`;

    try {
        const res = await fetch(`${API_BASE}/api/simulate/delay`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ train_number: trainNo, delay_minutes: delayMin })
        });
        const data = await res.json();

        document.getElementById("sim-status-badge").innerText = `RESOLVED IN ${data.solver_time_seconds}s`;
        document.getElementById("sim-res-summary").innerText = data.resolution_summary;

        if (data.updated_schedule) {
            currentScheduleData = data.updated_schedule;
            updateKPICards(currentScheduleData.metrics);
            populateMemoDropdown(currentScheduleData.scheduled_blocks);
            if (typeof renderMareyChart === "function") renderMareyChart();
            if (typeof renderGanttChart === "function") renderGanttChart();
            if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
                renderNetworkTrackDiagram(currentTopologyData);
            }
            CorridorMap.instances.forEach(m => m.refresh());
        }
    } catch (e) {
        document.getElementById("sim-status-badge").innerText = "ERROR";
        document.getElementById("sim-res-summary").innerText = `Simulation failed: ${e.message}`;
    }
}

async function runDefectSimulation() {
    const sec = document.getElementById("sim-defect-sec")?.value || "GZB - DER";
    const line = document.getElementById("sim-defect-line")?.value || "UP";
    const dept = document.getElementById("sim-defect-dept")?.value || "ENGINEERING_TRACK";

    const resBox = document.getElementById("sim-result-box");
    resBox.style.display = "block";
    document.getElementById("sim-status-badge").innerText = "INSERTING BLOCK & SOLVING...";
    document.getElementById("sim-res-summary").innerText = `Calculating emergency shadow block on ${sec} (${line})...`;

    try {
        const res = await fetch(`${API_BASE}/api/simulate/defect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: sec, line: line, km: 32.0, department: dept })
        });
        const data = await res.json();

        document.getElementById("sim-status-badge").innerText = `RESOLVED IN ${data.solver_time_seconds}s`;
        document.getElementById("sim-res-summary").innerText = data.resolution_summary;

        if (data.updated_schedule) {
            currentScheduleData = data.updated_schedule;
            updateKPICards(currentScheduleData.metrics);
            populateMemoDropdown(currentScheduleData.scheduled_blocks);
            if (typeof renderMareyChart === "function") renderMareyChart();
            if (typeof renderGanttChart === "function") renderGanttChart();
            if (typeof renderNetworkTrackDiagram === "function" && currentTopologyData) {
                renderNetworkTrackDiagram(currentTopologyData);
            }
            CorridorMap.instances.forEach(m => m.refresh());
        }
    } catch (e) {
        document.getElementById("sim-status-badge").innerText = "ERROR";
        document.getElementById("sim-res-summary").innerText = `Simulation failed: ${e.message}`;
    }
}
