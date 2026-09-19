/**
 * Interactive Marey Time-Distance String Chart (Microsoft Fluent Light Theme).
 * Standard Indian Railways Control Office diagram.
 * Shows train trajectories across 24h alongside shaded maintenance blocks and live time scrubber.
 */

let activeMareyCategory = "ALL";

function filterMareyCategory(cat) {
    activeMareyCategory = cat;
    document.querySelectorAll(".filter-chips-row .filter-chip").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`marey-chip-${cat.toLowerCase().slice(0, 4)}`);
    if (activeBtn) activeBtn.classList.add("active");
    renderMareyChart();
}

function renderMareyChart() {
    const container = document.getElementById("marey-plot-container");
    if (!container || !currentTimetableData) return;

    const dirFilter = document.getElementById("marey-dir-select")?.value || "ALL";

    const stationKms = {
        "NDLS": 0.0,
        "GZB": 25.0,
        "DER": 37.0,
        "KRJ": 83.0,
        "ALJN": 131.0,
        "TDL": 209.0,
        "FZD": 226.0,
        "ETW": 301.0,
        "PHD": 357.0,
        "CNB": 440.0
    };

    const traces = [];

    // 1. Group timetable by train and create line traces
    const trains = {};
    currentTimetableData.forEach(row => {
        if (dirFilter !== "ALL" && row.direction !== dirFilter) return;

        // Apply category filter
        const isPremium = row.train_type === "RAJDHANI" || row.train_type === "VANDE_BHARAT" || row.train_type === "SHATABDI";
        if (activeMareyCategory === "PREMIUM" && !isPremium) return;
        if (activeMareyCategory === "EXPRESS" && isPremium) return;

        if (!trains[row.train_number]) {
            trains[row.train_number] = {
                number: row.train_number,
                name: row.train_name,
                type: row.train_type,
                dir: row.direction,
                stops: []
            };
        }
        trains[row.train_number].stops.push(row);
    });

    for (const [tNo, tData] of Object.entries(trains)) {
        tData.stops.sort((a, b) => a.arrival_min_of_day - b.arrival_min_of_day);

        const timesHours = [];
        const distancesKm = [];
        const hoverTexts = [];

        tData.stops.forEach(st => {
            const h = st.arrival_min_of_day / 60.0;
            timesHours.push(h);
            distancesKm.push(st.km_location);
            hoverTexts.push(`<b>${tData.name} (${tNo})</b><br>Station: ${st.station} (KM ${st.km_location})<br>Scheduled Time: ${st.arrival_time}<br>Direction: ${tData.dir} Line`);
        });

        // High-contrast, editorial train trajectories
        let color = "#242424"; // Deep graphite for standard trains
        let width = 1.8;
        let dash = "solid";

        if (tData.type === "RAJDHANI") {
            color = "#C94F4F"; // Muted Crimson
            width = 2.2;
        } else if (tData.type === "VANDE_BHARAT") {
            color = "#2B4C6F"; // Technical Slate Blue
            width = 2.2;
        } else if (tData.type === "SHATABDI") {
            color = "#56806C"; // Muted Spruce Green
            width = 2.0;
        } else if (tData.type === "FREIGHT") {
            color = "#6D6D68"; // Technical Grey
            width = 1.4;
            dash = "dash";
        }

        traces.push({
            x: timesHours,
            y: distancesKm,
            mode: "lines+markers",
            name: `${tNo} (${tData.name.split(" ")[0]})`,
            text: hoverTexts,
            hoverinfo: "text",
            line: {
                color: color,
                width: width,
                dash: dash
            },
            marker: {
                size: 3.5,
                color: color
            },
            showlegend: false
        });
    }

    // 2. Add Shaded Maintenance Blocks (Shapes)
    const shapes = [];
    const annotations = [];

    if (currentScheduleData && currentScheduleData.scheduled_blocks) {
        currentScheduleData.scheduled_blocks.forEach(block => {
            const startH = timeStrToHours(block.start_time);
            const endH = timeStrToHours(block.end_time);

            const kmParts = block.km_range.split("-").map(k => parseFloat(k.trim()));
            const kmMin = Math.min(...kmParts);
            const kmMax = Math.max(...kmParts);

            shapes.push({
                type: "rect",
                x0: startH,
                x1: endH,
                y0: kmMin,
                y1: kmMax,
                fillcolor: "rgba(198, 154, 43, 0.18)",
                line: {
                    color: "#C69A2B",
                    width: 1.2,
                    dash: "dot"
                },
                layer: "below"
            });

            annotations.push({
                x: (startH + endH) / 2.0,
                y: (kmMin + kmMax) / 2.0,
                text: `<b>${block.schedule_id}</b><br>${block.duration_min}m (${block.line})`,
                showarrow: false,
                font: {
                    family: "JetBrains Mono, monospace",
                    size: 9,
                    color: "#242424"
                },
                bgcolor: "#FAF9F4",
                bordercolor: "#D4D0C5",
                borderwidth: 1,
                borderpad: 3
            });
        });
    }

    // 3. Current Time Cursor (IST)
    const now = new Date();
    const currentIstHour = now.getHours() + (now.getMinutes() / 60.0);
    if (currentIstHour >= 0 && currentIstHour <= 24) {
        shapes.push({
            type: "line",
            x0: currentIstHour,
            x1: currentIstHour,
            y0: 0,
            y1: 440,
            line: {
                color: "#C94F4F",
                width: 1.5,
                dash: "dashdot"
            }
        });
        annotations.push({
            x: currentIstHour,
            y: 430,
            text: "NOW (IST)",
            showarrow: false,
            font: { family: "JetBrains Mono", size: 8, color: "#C94F4F" },
            bgcolor: "#FAF9F4",
            bordercolor: "#C94F4F",
            borderwidth: 1
        });
    }

    const stationTicks = Object.keys(stationKms);
    const stationVals = Object.values(stationKms);

    const layout = {
        title: false,
        margin: { l: 85, r: 30, t: 20, b: 50 },
        height: 520,
        paper_bgcolor: "#FAF9F4",
        plot_bgcolor: "#F3F0E7",
        xaxis: {
            title: {
                text: "Time of Day (Hours IST - 24H Timeline)",
                font: { family: "Inter, sans-serif", size: 11, color: "#6D6D68" }
            },
            range: [0, 24],
            dtick: 2,
            tickformat: "%02d:00",
            gridcolor: "rgba(212, 208, 197, 0.7)",
            zeroline: false,
            tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#6D6D68" }
        },
        yaxis: {
            title: {
                text: "Corridor Stations & Chainage (KM)",
                font: { family: "Inter, sans-serif", size: 11, color: "#6D6D68" }
            },
            tickmode: "array",
            tickvals: stationVals,
            ticktext: stationTicks.map((st, i) => `<b>${st}</b> (${stationVals[i]}k)`),
            range: [450, -10],
            gridcolor: "rgba(212, 208, 197, 0.7)",
            tickfont: { family: "JetBrains Mono, monospace", size: 9.5, color: "#242424" }
        },
        shapes: shapes,
        annotations: annotations,
        hovermode: "closest"
    };

    const config = {
        responsive: true,
        displayModeBar: false
    };

    Plotly.newPlot(container, traces, layout, config);
}

function timeStrToHours(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map(Number);
    return parts[0] + parts[1] / 60.0;
}
