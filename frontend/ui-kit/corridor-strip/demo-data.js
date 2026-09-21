/* Raw API-shaped records for demo.html only — the exact field names the
   backend returns, so the demo exercises CORRIDOR_MAP rather than pre-mapped
   data. Regenerate from data/processed/ if the schema moves. */
var DEMO_REQUESTS = [
 {
  "request_id": "WREQ-TRK-B826B6D9",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0216",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "UP",
  "km_start": 86.19,
  "km_end": 86.92,
  "machine_required": "MANUAL",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang B",
  "duration_requested_min": 172,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 56.6, USFD: CLEAR)",
  "failure_percentage": 1.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang B",
  "submitted_at": "2026-09-10T05:05:48.127098",
  "status": "EXECUTING",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null,
  "progress": 0.5114211221977235
 },
 {
  "request_id": "WREQ-OHE-B98004D9",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0010",
  "defect_category": "Contact Wire Condemning Wear",
  "section_from": "NDLS",
  "section_to": "GZB",
  "section_label": "NDLS - GZB",
  "line": "UP",
  "km_start": 11,
  "km_end": 11.56,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang A",
  "duration_requested_min": 159,
  "priority": "CRITICAL",
  "description": "OHE maintenance (Wire wear 87.0%, ATD: NORMAL)",
  "failure_percentage": 99.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang A",
  "submitted_at": "2026-09-10T11:12:02.146626",
  "status": "EXECUTING",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null,
  "progress": 0.37447843562088834
 },
 {
  "request_id": "WREQ-TRK-4418878D",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0045",
  "defect_category": "Rail Flaw (USFD Under Observation)",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "DN",
  "km_start": 91.27,
  "km_end": 93.21,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang A",
  "duration_requested_min": 156,
  "priority": "LOW",
  "description": "Track maintenance (GOOD TGI 84.0, USFD: OBS)",
  "failure_percentage": 0.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang A",
  "submitted_at": "2026-09-10T19:01:44.360275",
  "status": "EXECUTING",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null,
  "progress": 0.3160538674174127
 },
 {
  "request_id": "WREQ-SIG-4091A220",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0446",
  "defect_category": "Point Machine Sluggish",
  "section_from": "ETW",
  "section_to": "ETW",
  "section_label": "ETW Station Yard",
  "line": "UP",
  "km_start": 300.99,
  "km_end": 301.09,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "S&T Field Technician",
  "duration_requested_min": 150,
  "priority": "LOW",
  "description": "Signal maintenance (POINT_MACHINE at ETW, Tier: LOW)",
  "failure_percentage": 2.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/signal/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "S&T Field Technician",
  "submitted_at": "2026-09-10T09:46:13.497925",
  "status": "EXECUTING",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null,
  "progress": 0.35099861333193194
 },
 {
  "request_id": "WREQ-TRK-918A9ECA",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0208",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "UP",
  "km_start": 94.98,
  "km_end": 95.98,
  "machine_required": "TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang A",
  "duration_requested_min": 186,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 64.2, USFD: CLEAR)",
  "failure_percentage": 0.8,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang A",
  "submitted_at": "2026-09-10T15:46:38.764610",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-E3D51E27",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0299",
  "defect_category": "Contact Wire Wear",
  "section_from": "DER",
  "section_to": "KRJ",
  "section_label": "DER - KRJ",
  "line": "UP",
  "km_start": 40.33,
  "km_end": 41.21,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 152,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 48.1%, ATD: NORMAL)",
  "failure_percentage": 0.4,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang B",
  "submitted_at": "2026-09-10T07:22:45.752373",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-0D1AA571",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0177",
  "defect_category": "Track Circuit Fault",
  "section_from": "TDL",
  "section_to": "TDL",
  "section_label": "TDL Station Yard",
  "line": "UP",
  "km_start": 210.44,
  "km_end": 210.54,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Signal Maintainer Gang A",
  "duration_requested_min": 150,
  "priority": "LOW",
  "description": "Signal maintenance (TRACK_CIRCUIT at TDL, Tier: LOW)",
  "failure_percentage": 24.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "Signal Maintainer Gang A",
  "submitted_at": "2026-09-10T12:35:01.496334",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-C5C47E8D",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0319",
  "defect_category": "Track Geometry Deviation (TGI)",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "DN",
  "km_start": 88.93,
  "km_end": 90.07,
  "machine_required": "BCM",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang B",
  "duration_requested_min": 217,
  "priority": "MEDIUM",
  "description": "Track maintenance (POOR TGI 49.7, USFD: CLEAR)",
  "failure_percentage": 29.3,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang B",
  "submitted_at": "2026-09-10T19:07:05.195599",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-3D4083D4",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0513",
  "defect_category": "Contact Wire Condemning Wear",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "DN",
  "km_start": 90.67,
  "km_end": 91.85,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 167,
  "priority": "CRITICAL",
  "description": "OHE maintenance (Wire wear 100.0%, ATD: NORMAL)",
  "failure_percentage": 99.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang B",
  "submitted_at": "2026-09-11T00:27:33.851643",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-83D9A021",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0315",
  "defect_category": "Point Machine Sluggish",
  "section_from": "PHD",
  "section_to": "PHD",
  "section_label": "PHD Station Yard",
  "line": "UP",
  "km_start": 355.64,
  "km_end": 355.74,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "S&T Field Technician",
  "duration_requested_min": 150,
  "priority": "LOW",
  "description": "Signal maintenance (POINT_MACHINE at PHD, Tier: LOW)",
  "failure_percentage": 1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/signal/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "S&T Field Technician",
  "submitted_at": "2026-09-10T06:16:07.833138",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-EC3A8B6D",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0464",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "NDLS",
  "section_to": "GZB",
  "section_label": "NDLS - GZB",
  "line": "UP",
  "km_start": 14.87,
  "km_end": 15.92,
  "machine_required": "MANUAL",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 177,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 60.9, USFD: CLEAR)",
  "failure_percentage": 1.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-10T12:39:04.381294",
  "status": "SANCTIONED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-F3283777",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0115",
  "defect_category": "Contact Wire Wear",
  "section_from": "FZD",
  "section_to": "ETW",
  "section_label": "FZD - ETW",
  "line": "UP",
  "km_start": 275.27,
  "km_end": 276.47,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang A",
  "duration_requested_min": 159,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 61.4%, ATD: NORMAL)",
  "failure_percentage": 0.3,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang A",
  "submitted_at": "2026-09-10T17:47:02.504883",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-DC387719",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0071",
  "defect_category": "Electronic Interlocking Alarm",
  "section_from": "GZB",
  "section_to": "GZB",
  "section_label": "GZB Station Yard",
  "line": "UP",
  "km_start": 25.73,
  "km_end": 25.83,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Signal Maintainer Gang A",
  "duration_requested_min": 150,
  "priority": "MEDIUM",
  "description": "Signal maintenance (EI_SYSTEM at GZB, Tier: MEDIUM)",
  "failure_percentage": 42.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/signal/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "Signal Maintainer Gang A",
  "submitted_at": "2026-09-10T23:04:14.372654",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-4196001F",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0198",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "ETW",
  "section_to": "PHD",
  "section_label": "ETW - PHD",
  "line": "UP",
  "km_start": 306,
  "km_end": 307.27,
  "machine_required": "TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang B",
  "duration_requested_min": 182,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 73.8, USFD: CLEAR)",
  "failure_percentage": 3.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang B",
  "submitted_at": "2026-09-10T05:35:27.530899",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-BF08DE9A",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0259",
  "defect_category": "Track Circuit Fault",
  "section_from": "GZB",
  "section_to": "GZB",
  "section_label": "GZB Station Yard",
  "line": "DN",
  "km_start": 24.18,
  "km_end": 24.28,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "S&T Field Technician",
  "duration_requested_min": 150,
  "priority": "MEDIUM",
  "description": "Signal maintenance (TRACK_CIRCUIT at GZB, Tier: MEDIUM)",
  "failure_percentage": 39,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "S&T Field Technician",
  "submitted_at": "2026-09-10T07:32:27.122250",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-73A61906",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0788",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "TDL",
  "section_to": "FZD",
  "section_label": "TDL - FZD",
  "line": "DN",
  "km_start": 220.21,
  "km_end": 221.78,
  "machine_required": "MANUAL",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "PWI Field Inspector",
  "duration_requested_min": 169,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 71.7, USFD: CLEAR)",
  "failure_percentage": 0.3,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "PWI Field Inspector",
  "submitted_at": "2026-09-10T13:15:35.804062",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-D2AADF15",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0213",
  "defect_category": "Contact Wire Wear",
  "section_from": "PHD",
  "section_to": "CNB",
  "section_label": "PHD - CNB",
  "line": "UP",
  "km_start": 382.71,
  "km_end": 383.64,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 157,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 53.4%, ATD: NORMAL)",
  "failure_percentage": 0.4,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang B",
  "submitted_at": "2026-09-10T18:22:59.419136",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-357F27E2",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0121",
  "defect_category": "Axle Counter Reset Failure",
  "section_from": "GZB",
  "section_to": "GZB",
  "section_label": "GZB Station Yard",
  "line": "UP",
  "km_start": 24.37,
  "km_end": 24.47,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Signal Maintainer Gang A",
  "duration_requested_min": 150,
  "priority": "LOW",
  "description": "Signal maintenance (AXLE_COUNTER at GZB, Tier: LOW)",
  "failure_percentage": 23.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/signal/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "Signal Maintainer Gang A",
  "submitted_at": "2026-09-10T23:58:38.087025",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-BE7FB667",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0411",
  "defect_category": "Rail Flaw (USFD Under Observation)",
  "section_from": "GZB",
  "section_to": "DER",
  "section_label": "GZB - DER",
  "line": "UP",
  "km_start": 26.95,
  "km_end": 28.8,
  "machine_required": "TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 201,
  "priority": "CRITICAL",
  "description": "Track maintenance (POOR TGI 48.4, USFD: OBS)",
  "failure_percentage": 92.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-10T07:16:03.150482",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-A8E1E261",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0317",
  "defect_category": "Contact Wire Wear",
  "section_from": "FZD",
  "section_to": "ETW",
  "section_label": "FZD - ETW",
  "line": "DN",
  "km_start": 231.6,
  "km_end": 232.57,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 162,
  "priority": "CRITICAL",
  "description": "OHE maintenance (Wire wear 78.4%, ATD: NORMAL)",
  "failure_percentage": 98.8,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang B",
  "submitted_at": "2026-09-10T12:52:27.262001",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-7D765208",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0007",
  "defect_category": "Point Machine Sluggish",
  "section_from": "TDL",
  "section_to": "TDL",
  "section_label": "TDL Station Yard",
  "line": "DN",
  "km_start": 208.61,
  "km_end": 208.71,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "S&T Field Technician",
  "duration_requested_min": 150,
  "priority": "LOW",
  "description": "Signal maintenance (POINT_MACHINE at TDL, Tier: LOW)",
  "failure_percentage": 1.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/signal/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "S&T Field Technician",
  "submitted_at": "2026-09-10T17:17:46.978016",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-CAE090C6",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0282",
  "defect_category": "Rail Flaw (USFD Under Observation)",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "DN",
  "km_start": 104.8,
  "km_end": 106.19,
  "machine_required": "TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 184,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 55.5, USFD: OBS)",
  "failure_percentage": 23.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-10T23:39:10.514946",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-B57445CB",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0194",
  "defect_category": "OHE Tension & Insulator Inspection",
  "section_from": "GZB",
  "section_to": "DER",
  "section_label": "GZB - DER",
  "line": "DN",
  "km_start": 32.7,
  "km_end": 33.52,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang A",
  "duration_requested_min": 151,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 31.8%, ATD: NORMAL)",
  "failure_percentage": 0.6,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang A",
  "submitted_at": "2026-09-10T05:33:25.888710",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-SIG-3BF01CAE",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "SIG-0142",
  "defect_category": "Axle Counter Reset Failure",
  "section_from": "NDLS",
  "section_to": "NDLS",
  "section_label": "NDLS Station Yard",
  "line": "DN",
  "km_start": 0,
  "km_end": 0.1,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "S&T Field Technician",
  "duration_requested_min": 150,
  "priority": "MEDIUM",
  "description": "Signal maintenance (AXLE_COUNTER at NDLS, Tier: MEDIUM)",
  "failure_percentage": 31.7,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/signal/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/signal/inspection_report.pdf"
   }
  ],
  "submitted_by": "S&T Field Technician",
  "submitted_at": "2026-09-10T11:11:19.697361",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-E320E3A6",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0196",
  "defect_category": "Rail Flaw (USFD Immediate)",
  "section_from": "ETW",
  "section_to": "PHD",
  "section_label": "ETW - PHD",
  "line": "UP",
  "km_start": 342.65,
  "km_end": 344.35,
  "machine_required": "TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang A",
  "duration_requested_min": 205,
  "priority": "CRITICAL",
  "description": "Track maintenance (AVERAGE TGI 51.8, USFD: IMR)",
  "failure_percentage": 86.5,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang A",
  "submitted_at": "2026-09-10T17:20:46.828728",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-C62EE35E",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0081",
  "defect_category": "Contact Wire Wear",
  "section_from": "NDLS",
  "section_to": "GZB",
  "section_label": "NDLS - GZB",
  "line": "DN",
  "km_start": 20.04,
  "km_end": 21.2,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang A",
  "duration_requested_min": 155,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 44.1%, ATD: NORMAL)",
  "failure_percentage": 0.4,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang A",
  "submitted_at": "2026-09-10T23:10:16.150398",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-E4A7EC40",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0226",
  "defect_category": "OHE Tension & Insulator Inspection",
  "section_from": "DER",
  "section_to": "KRJ",
  "section_label": "DER - KRJ",
  "line": "UP",
  "km_start": 77.88,
  "km_end": 78.68,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang A",
  "duration_requested_min": 150,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 14.0%, ATD: NORMAL)",
  "failure_percentage": 0.5,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang A",
  "submitted_at": "2026-09-11T04:34:40.366535",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-9323ABAE",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0678",
  "defect_category": "Rail Flaw (USFD Immediate)",
  "section_from": "KRJ",
  "section_to": "ALJN",
  "section_label": "KRJ - ALJN",
  "line": "UP",
  "km_start": 123.8,
  "km_end": 124.57,
  "machine_required": "TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang A",
  "duration_requested_min": 222,
  "priority": "CRITICAL",
  "description": "Track maintenance (POOR TGI 45.1, USFD: IMR)",
  "failure_percentage": 99.3,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang A",
  "submitted_at": "2026-09-10T14:10:27.446194",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-1771A790",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0201",
  "defect_category": "Contact Wire Condemning Wear",
  "section_from": "NDLS",
  "section_to": "GZB",
  "section_label": "NDLS - GZB",
  "line": "DN",
  "km_start": 7.72,
  "km_end": 8.36,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang A",
  "duration_requested_min": 164,
  "priority": "CRITICAL",
  "description": "OHE maintenance (Wire wear 100.0%, ATD: NORMAL)",
  "failure_percentage": 99.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang A",
  "submitted_at": "2026-09-10T21:43:08.241310",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-D213B126",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0075",
  "defect_category": "Routine Track Patrol Observation",
  "section_from": "NDLS",
  "section_to": "GZB",
  "section_label": "NDLS - GZB",
  "line": "DN",
  "km_start": 21.35,
  "km_end": 22.95,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 155,
  "priority": "LOW",
  "description": "Track maintenance (GOOD TGI 83.1, USFD: CLEAR)",
  "failure_percentage": 0.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-10T06:44:54.937954",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-CC0556B3",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0151",
  "defect_category": "Contact Wire Wear",
  "section_from": "DER",
  "section_to": "KRJ",
  "section_label": "DER - KRJ",
  "line": "UP",
  "km_start": 78.21,
  "km_end": 79.3,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "OHE Patrol Inspector",
  "duration_requested_min": 154,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 45.9%, ATD: NORMAL)",
  "failure_percentage": 0.5,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "OHE Patrol Inspector",
  "submitted_at": "2026-09-10T14:25:19.350777",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-667ADFC9",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0315",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "DER",
  "section_to": "KRJ",
  "section_label": "DER - KRJ",
  "line": "DN",
  "km_start": 57.06,
  "km_end": 57.95,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang B",
  "duration_requested_min": 153,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 77.2, USFD: CLEAR)",
  "failure_percentage": 1.8,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang B",
  "submitted_at": "2026-09-10T17:35:24.918423",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-A1E4D030",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0522",
  "defect_category": "Contact Wire Condemning Wear",
  "section_from": "FZD",
  "section_to": "ETW",
  "section_label": "FZD - ETW",
  "line": "DN",
  "km_start": 284.93,
  "km_end": 285.46,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "OHE Patrol Inspector",
  "duration_requested_min": 163,
  "priority": "CRITICAL",
  "description": "OHE maintenance (Wire wear 100.0%, ATD: NORMAL)",
  "failure_percentage": 99.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "OHE Patrol Inspector",
  "submitted_at": "2026-09-11T02:06:15.714722",
  "status": "PENDING_REVIEW",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-AA0E762D",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0264",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "GZB",
  "section_to": "DER",
  "section_label": "GZB - DER",
  "line": "UP",
  "km_start": 35.87,
  "km_end": 37,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 156,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 77.3, USFD: CLEAR)",
  "failure_percentage": 0.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-11T06:18:23.926945",
  "status": "COMPLETED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-4BAEB24A",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0602",
  "defect_category": "Track Geometry Deviation (TGI)",
  "section_from": "DER",
  "section_to": "KRJ",
  "section_label": "DER - KRJ",
  "line": "UP",
  "km_start": 52.89,
  "km_end": 54.07,
  "machine_required": "BCM",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 234,
  "priority": "CRITICAL",
  "description": "Track maintenance (POOR TGI 38.1, USFD: CLEAR)",
  "failure_percentage": 99.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-11T16:56:40.689774",
  "status": "COMPLETED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-9E7FDC56",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0135",
  "defect_category": "OHE Tension & Insulator Inspection",
  "section_from": "FZD",
  "section_to": "ETW",
  "section_label": "FZD - ETW",
  "line": "DN",
  "km_start": 228.94,
  "km_end": 229.7,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "OHE Patrol Inspector",
  "duration_requested_min": 153,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 39.8%, ATD: NORMAL)",
  "failure_percentage": 0.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "OHE Patrol Inspector",
  "submitted_at": "2026-09-12T03:13:55.459766",
  "status": "COMPLETED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-3744A271",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0818",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "GZB",
  "section_to": "DER",
  "section_label": "GZB - DER",
  "line": "DN",
  "km_start": 30.7,
  "km_end": 31.48,
  "machine_required": "NONE",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "PWI Field Inspector",
  "duration_requested_min": 154,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 75.8, USFD: CLEAR)",
  "failure_percentage": 2.1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "PWI Field Inspector",
  "submitted_at": "2026-09-11T12:41:13.393517",
  "status": "COMPLETED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-ACED37C2",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0280",
  "defect_category": "Contact Wire Wear",
  "section_from": "ETW",
  "section_to": "PHD",
  "section_label": "ETW - PHD",
  "line": "DN",
  "km_start": 321.7,
  "km_end": 322.59,
  "machine_required": "NONE",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 158,
  "priority": "LOW",
  "description": "OHE maintenance (Wire wear 60.7%, ATD: NORMAL)",
  "failure_percentage": 1,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/ohe/site_photo_1.png"
   },
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang B",
  "submitted_at": "2026-09-11T21:13:37.576218",
  "status": "COMPLETED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-TRK-16FA6AC5",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "TRK-0234",
  "defect_category": "Track Geometry Attention (TGI)",
  "section_from": "FZD",
  "section_to": "ETW",
  "section_label": "FZD - ETW",
  "line": "DN",
  "km_start": 246.74,
  "km_end": 248.42,
  "machine_required": "MANUAL",
  "power_block_required": false,
  "disconnection_required": false,
  "gang_crew": "Track Patrol Gang C",
  "duration_requested_min": 165,
  "priority": "LOW",
  "description": "Track maintenance (AVERAGE TGI 72.0, USFD: CLEAR)",
  "failure_percentage": 0.2,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/track/site_photo_2.png"
   },
   {
    "type": "image",
    "filename": "site_photo_1.png",
    "url": "/attachments/track/site_photo_1.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/track/inspection_report.pdf"
   }
  ],
  "submitted_by": "Track Patrol Gang C",
  "submitted_at": "2026-09-11T06:13:56.824474",
  "status": "CANCELLED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 },
 {
  "request_id": "WREQ-OHE-E2B9EA4E",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "OHE-0187",
  "defect_category": "Contact Wire Wear",
  "section_from": "GZB",
  "section_to": "DER",
  "section_label": "GZB - DER",
  "line": "UP",
  "km_start": 26.55,
  "km_end": 27.99,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 163,
  "priority": "CRITICAL",
  "description": "OHE maintenance (Wire wear 75.9%, ATD: NORMAL)",
  "failure_percentage": 99.9,
  "attachments": [
   {
    "type": "image",
    "filename": "site_photo_2.png",
    "url": "/attachments/ohe/site_photo_2.png"
   },
   {
    "type": "pdf",
    "filename": "inspection_report.pdf",
    "url": "/attachments/ohe/inspection_report.pdf"
   }
  ],
  "submitted_by": "TRD Linemen Gang B",
  "submitted_at": "2026-09-11T13:52:22.412090",
  "status": "CANCELLED",
  "review_note": null,
  "reviewed_at": null,
  "reviewed_by": null
 }
];

var DEMO_DEMANDS = [
 {
  "demand_id": "DMD-TMS-101",
  "department": "ENGINEERING_TRACK",
  "department_label": "Civil / Track (TMS)",
  "asset_id": "",
  "defect_category": "Rail Flaw (USFD)",
  "section_from": "GZB",
  "section_to": "DER",
  "line": "UP",
  "km_start": 28.5,
  "km_end": 30,
  "machine_required": "CSM_TAMPING",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "Track Gang B (GZB Depot)",
  "duration_requested_min": 210,
  "priority": "CRITICAL",
  "description": "Rail Flaw (USFD) on GZB-DER (UP)",
  "status": "CANCELLED",
  "raised_at": "2026-09-10T13:54:50.407492",
  "raised_at_sim": "2026-09-10T05:05:54.602757",
  "sanctioned_window": "11:12 - 14:42 IST",
  "sanction_memo_id": "SCHED-001",
  "window_start_sim": "2026-09-10T11:12:00",
  "window_end_sim": "2026-09-10T14:42:00",
  "window_day_label": "TODAY",
  "cancellation_reason": "25 kV power block permit not granted by TPC; OHE isolation refused",
  "cancelled_at": "2026-09-10T05:27:04.671459"
 },
 {
  "demand_id": "DMD-TDMS-102",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "",
  "defect_category": "Contact Wire Wear",
  "section_from": "GZB",
  "section_to": "DER",
  "line": "UP",
  "km_start": 29,
  "km_end": 30,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Linemen Gang B",
  "duration_requested_min": 180,
  "priority": "CRITICAL",
  "description": "Contact Wire Wear on GZB-DER (UP)",
  "status": "COMPLETED",
  "raised_at": "2026-09-10T13:54:50.425937",
  "raised_at_sim": "2026-09-10T05:05:56.077843",
  "sanctioned_window": "11:12 - 14:42 IST",
  "sanction_memo_id": "SCHED-001",
  "window_start_sim": "2026-09-10T11:12:00",
  "window_end_sim": "2026-09-10T14:42:00",
  "window_day_label": "TODAY",
  "started_at": "2026-09-10T11:12:06.686363",
  "completed_at": "2026-09-10T15:12:08.758602"
 },
 {
  "demand_id": "DMD-SMMS-103",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "",
  "defect_category": "Point Machine Sluggish",
  "section_from": "GZB",
  "section_to": "DER",
  "line": "UP",
  "km_start": 28,
  "km_end": 29,
  "machine_required": "SIGNAL_GANG",
  "power_block_required": false,
  "disconnection_required": true,
  "gang_crew": "Signal Gang B",
  "duration_requested_min": 120,
  "priority": "CRITICAL",
  "description": "Point Machine Sluggish on GZB-DER (UP)",
  "status": "CANCELLED",
  "raised_at": "2026-09-10T13:54:50.446444",
  "raised_at_sim": "2026-09-10T05:05:57.718754",
  "sanctioned_window": "11:12 - 14:42 IST",
  "sanction_memo_id": "SCHED-001",
  "window_start_sim": "2026-09-10T11:12:00",
  "window_end_sim": "2026-09-10T14:42:00",
  "window_day_label": "TODAY",
  "cancellation_reason": "25 kV power block permit not granted by TPC; OHE isolation refused",
  "cancelled_at": "2026-09-10T09:46:32.778950"
 },
 {
  "demand_id": "DMD-TDMS-104",
  "department": "TRACTION_DISTRIBUTION_OHE",
  "department_label": "Electrical / OHE (TDMS)",
  "asset_id": "",
  "defect_category": "Contact Wire Wear",
  "section_from": "ALJN",
  "section_to": "TDL",
  "line": "DN",
  "km_start": 136,
  "km_end": 137,
  "machine_required": "TOWER_WAGON",
  "power_block_required": true,
  "disconnection_required": false,
  "gang_crew": "TRD Gang",
  "duration_requested_min": 180,
  "priority": "CRITICAL",
  "description": "Contact Wire Wear on ALJN-TDL (DN)",
  "status": "PENDING_SANCTION",
  "raised_at": "2026-09-10T13:54:51.025645",
  "raised_at_sim": "2026-09-10T05:06:44.055805",
  "sanctioned_window": null,
  "sanction_memo_id": null,
  "window_start_sim": null,
  "window_end_sim": null,
  "window_day_label": null
 },
 {
  "demand_id": "DMD-SMMS-105",
  "department": "SIGNAL_AND_TELECOM",
  "department_label": "Signalling & Telecom (SMMS)",
  "asset_id": "",
  "defect_category": "Point Machine Sluggish",
  "section_from": "ALJN",
  "section_to": "TDL",
  "line": "DN",
  "km_start": 135,
  "km_end": 136,
  "machine_required": "SIGNAL_GANG",
  "power_block_required": false,
  "disconnection_required": true,
  "gang_crew": "Signal Gang",
  "duration_requested_min": 120,
  "priority": "CRITICAL",
  "description": "Point Machine Sluggish on ALJN-TDL (DN)",
  "status": "PENDING_SANCTION",
  "raised_at": "2026-09-10T13:54:51.051548",
  "raised_at_sim": "2026-09-10T05:06:46.126671",
  "sanctioned_window": null,
  "sanction_memo_id": null,
  "window_start_sim": null,
  "window_end_sim": null,
  "window_day_label": null
 }
];
