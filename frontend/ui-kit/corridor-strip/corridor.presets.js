/* ==========================================================================
   UI-KIT · CORRIDOR STRIP · presets  (corridor.presets.js)
   --------------------------------------------------------------------------
   THE FILE THE TEAM EDITS.

   1. CORRIDOR_PRESETS — one entry per corridor: label, length, station list.
      Station order must be ascending by km. Only code/name/km/platforms
      affect the plot; division/speedLimit/depots show on the station card.

   2. CORRIDOR_MAP — turns the raw objects the API already returns
      (worker_requests.json, pending_demands.json) into the marker shape the
      strip plots. Pass the raw record; only these six fields matter to the
      plot — id, line, kmStart, kmEnd, priority, status — the rest is card
      content and is carried through as-is.

   Usage:
     var preset = CORRIDOR_PRESETS['ndls-cnb'];
     CorridorStrip.create('#corridor', {
       stations: preset.stations,
       totalKm:  preset.totalKm,
       label:    preset.label,
       markers:  requests.map(CORRIDOR_MAP.request)
                   .concat(demands.map(CORRIDOR_MAP.demand))
     });
   ========================================================================== */

var CORRIDOR_PRESETS = {
    'ndls-cnb': {
        label: "New Delhi - Kanpur Central (NDLS-CNB) High-Density Trunk Corridor",
        totalKm: 440,
        stations: [
        {"code":"NDLS","name":"New Delhi","km":0,"platforms":16,"division":"Delhi (NR)","speedLimit":110,"depots":["Civil P-Way Depot","S&T Signal Depot"]},
        {"code":"GZB","name":"Ghaziabad Junction","km":25,"platforms":6,"division":"Delhi (NR)","speedLimit":130,"depots":["TRD Tower Wagon Depot","S&T Signal Depot","Civil P-Way Gang Base"]},
        {"code":"DER","name":"Dadri (DFC Junction)","km":37,"platforms":4,"division":"Prayagraj (NCR)","speedLimit":130,"depots":["Freight Container Yard","Civil P-Way Sub-depot"]},
        {"code":"KRJ","name":"Khurja Junction","km":83,"platforms":5,"division":"Prayagraj (NCR)","speedLimit":130,"depots":["Civil P-Way Gang Base"]},
        {"code":"ALJN","name":"Aligarh Junction","km":131,"platforms":7,"division":"Prayagraj (NCR)","speedLimit":160,"depots":["TRD Tower Wagon Depot","S&T Signal Depot","Civil P-Way Base"]},
        {"code":"TDL","name":"Tundla Junction","km":209,"platforms":5,"division":"Prayagraj (NCR)","speedLimit":160,"depots":["Major Tamping Machine Base","Crew Change Depot","TRD PSI Sub-station"]},
        {"code":"FZD","name":"Firozabad","km":226,"platforms":4,"division":"Prayagraj (NCR)","speedLimit":160,"depots":["Civil P-Way Sub-depot"]},
        {"code":"ETW","name":"Etawah Junction","km":301,"platforms":5,"division":"Prayagraj (NCR)","speedLimit":160,"depots":["TRD Tower Wagon Depot","S&T Signal Depot","Civil P-Way Gang Base"]},
        {"code":"PHD","name":"Phaphund","km":357,"platforms":4,"division":"Prayagraj (NCR)","speedLimit":160,"depots":["Civil P-Way Sub-depot"]},
        {"code":"CNB","name":"Kanpur Central","km":440,"platforms":10,"division":"Prayagraj (NCR)","speedLimit":110,"depots":["Major Electric Loco Shed","TRD Tower Wagon Depot","S&T Divisional Lab","Heavy Track Machine Base"]}
        ]
    }
};

var CORRIDOR_MAP = {
    /* worker_requests.json -> Marker. Status is always PENDING_REVIEW there. */
    request: function (r) {
        return {
            id: r.request_id,
            line: r.line,
            kmStart: r.km_start,
            kmEnd: r.km_end,
            priority: r.priority,
            status: r.status || 'PENDING_REVIEW',

            kind: 'REQUEST',
            dept: r.department,
            deptLabel: r.department_label,
            defect: r.defect_category,
            asset: r.asset_id || undefined,
            section: r.section_label || (r.section_from + ' - ' + r.section_to),
            crew: r.gang_crew,
            machine: r.machine_required,
            durationMin: r.duration_requested_min,
            powerBlock: !!r.power_block_required,
            disconnection: !!r.disconnection_required,
            note: r.description,
            failurePct: r.failure_percentage != null ? r.failure_percentage : null,
            attachments: (r.attachments || []).length
        };
    },

    /* pending_demands.json -> Marker. PENDING_SANCTION plots as SANCTIONED;
       add an EXECUTING flag from the simulator if a block is live. */
    demand: function (d) {
        var status = d.status === 'PENDING_SANCTION' ? 'SANCTIONED' : d.status;
        return {
            id: d.demand_id,
            line: d.line,
            kmStart: d.km_start,
            kmEnd: d.km_end,
            priority: d.priority,
            status: status,

            kind: 'DEMAND',
            dept: d.department,
            deptLabel: d.department_label,
            defect: d.defect_category,
            asset: d.asset_id || undefined,
            section: d.section_from + ' - ' + d.section_to,
            crew: d.gang_crew,
            machine: d.machine_required,
            durationMin: d.duration_requested_min,
            powerBlock: !!d.power_block_required,
            disconnection: !!d.disconnection_required,
            note: d.description,
            window: d.sanctioned_window,
            memo: d.sanction_memo_id || null,
            progress: status === 'COMPLETED' ? 1 : 0
        };
    }
};

if (typeof module === 'object' && module.exports) {
    module.exports = { CORRIDOR_PRESETS: CORRIDOR_PRESETS, CORRIDOR_MAP: CORRIDOR_MAP };
}
