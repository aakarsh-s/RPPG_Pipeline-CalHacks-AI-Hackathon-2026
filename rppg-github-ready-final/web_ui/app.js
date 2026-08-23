const currentBpm = document.querySelector("#currentBpm");
const currentSqi = document.querySelector("#currentSqi");
const currentFps = document.querySelector("#currentFps");
const currentRoiAgreement = document.querySelector("#currentRoiAgreement");
const currentValidity = document.querySelector("#currentValidity");
const trendPath = document.querySelector("#trendPath");
const baselinePath = document.querySelector("#baselinePath");
const trendBadge = document.querySelector("#trendBadge");
const timeline = document.querySelector("#timeline");
const measurementSummary = document.querySelector("#measurementSummary");
const heartRateStatus = document.querySelector("#heartRateStatus");
const signalGateStatus = document.querySelector("#signalGateStatus");
const cameraPanelStatus = document.querySelector("#cameraPanelStatus");
const roiForehead = document.querySelector("#roiForehead");
const roiLeft = document.querySelector("#roiLeft");
const roiRight = document.querySelector("#roiRight");
const qualityPeak = document.querySelector("#qualityPeak");
const qualityRoi = document.querySelector("#qualityRoi");
const qualityMotion = document.querySelector("#qualityMotion");
const qualityExposure = document.querySelector("#qualityExposure");
const qualityPeakBar = document.querySelector("#qualityPeakBar");
const qualityRoiBar = document.querySelector("#qualityRoiBar");
const qualityMotionBar = document.querySelector("#qualityMotionBar");
const qualityExposureBar = document.querySelector("#qualityExposureBar");
const researchCollectionBadge = document.querySelector("#researchCollectionBadge");
const researchCollectionSummary = document.querySelector("#researchCollectionSummary");
const collectionConfidence = document.querySelector("#collectionConfidence");
const collectionSqi = document.querySelector("#collectionSqi");
const collectionBuffer = document.querySelector("#collectionBuffer");
const collectionMotion = document.querySelector("#collectionMotion");
const collectionConfidenceGate = document.querySelector("#collectionConfidenceGate");
const collectionSqiGate = document.querySelector("#collectionSqiGate");
const collectionBufferGate = document.querySelector("#collectionBufferGate");
const collectionMotionGate = document.querySelector("#collectionMotionGate");
const groundTruthInput = document.querySelector("#groundTruthInput");
const trialConditionInput = document.querySelector("#trialConditionInput");
const trialNotesInput = document.querySelector("#trialNotesInput");
const saveTrialButton = document.querySelector("#saveTrialButton");
const clearTrialsButton = document.querySelector("#clearTrialsButton");
const trialCurrentEstimate = document.querySelector("#trialCurrentEstimate");
const trialCurrentError = document.querySelector("#trialCurrentError");
const trialMeanError = document.querySelector("#trialMeanError");
const trialCountBadge = document.querySelector("#trialCountBadge");
const trialTableBody = document.querySelector("#trialTableBody");
const diagnosticsButton = document.querySelector("#diagnosticsButton");
const scanDiagnosticsButton = document.querySelector("#scanDiagnosticsButton");
const diagnosticsModal = document.querySelector("#diagnosticsModal");
const diagnosticsSummary = document.querySelector("#diagnosticsSummary");
const diagCandidateBpm = document.querySelector("#diagCandidateBpm");
const diagValidatedBpm = document.querySelector("#diagValidatedBpm");
const diagSqi = document.querySelector("#diagSqi");
const diagConfidence = document.querySelector("#diagConfidence");
const diagBuffer = document.querySelector("#diagBuffer");
const diagFps = document.querySelector("#diagFps");
const diagMotion = document.querySelector("#diagMotion");
const diagFace = document.querySelector("#diagFace");
const diagPixels = document.querySelector("#diagPixels");
const diagExposure = document.querySelector("#diagExposure");
const diagReason = document.querySelector("#diagReason");
const diagReportBadge = document.querySelector("#diagReportBadge");
const diagReportDuration = document.querySelector("#diagReportDuration");
const diagReportFrames = document.querySelector("#diagReportFrames");
const diagReportAvgCandidate = document.querySelector("#diagReportAvgCandidate");
const diagReportAvgValidated = document.querySelector("#diagReportAvgValidated");
const diagReportRange = document.querySelector("#diagReportRange");
const diagReportValidFrames = document.querySelector("#diagReportValidFrames");
const diagReportAvgSqi = document.querySelector("#diagReportAvgSqi");
const diagReportAvgConfidence = document.querySelector("#diagReportAvgConfidence");
const diagReportAvgMotion = document.querySelector("#diagReportAvgMotion");
const diagReportAvgPixels = document.querySelector("#diagReportAvgPixels");
const diagReportReason = document.querySelector("#diagReportReason");
const diagReportMode = document.querySelector("#diagReportMode");
const diagAveragePanel = document.querySelector("#diagAveragePanel");
const diagPointsPanel = document.querySelector("#diagPointsPanel");
const diagPointsBody = document.querySelector("#diagPointsBody");

const scanFaceButton = document.querySelector("#scanFaceButton");
const stopScanButton = document.querySelector("#stopScanButton");
const scanModal = document.querySelector("#scanModal");
const browserCamera = document.querySelector("#browserCamera");
const captureCanvas = document.querySelector("#captureCanvas");
const scanVideo = document.querySelector("#scanVideo");
const cameraPlaceholder = document.querySelector("#cameraPlaceholder");
const scanBpm = document.querySelector("#scanBpm");
const scanSqi = document.querySelector("#scanSqi");
const scanFace = document.querySelector("#scanFace");
const scanBuffer = document.querySelector("#scanBuffer");
const scanWindow = document.querySelector("#scanWindow");
const scanInputFps = document.querySelector("#scanInputFps");
const scanMotion = document.querySelector("#scanMotion");
const scanPixels = document.querySelector("#scanPixels");
const scanExposure = document.querySelector("#scanExposure");
const scanValidity = document.querySelector("#scanValidity");
const scanReason = document.querySelector("#scanReason");

let statusTimer = null;
let passiveStatusTimer = null;
let lastStreamFrameId = null;
let unchangedStatusPolls = 0;
let cameraStream = null;
let frameTimer = null;
let frameInFlight = false;
let latestStatus = null;
let savedTrials = loadTrials();

function isFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  return Number.isFinite(Number(value));
}

function formatNumber(value, decimals = 2) {
  return isFiniteNumber(value) ? Number(value).toFixed(decimals) : "--";
}

function formatBpm(value) {
  return isFiniteNumber(value) ? `${Number(value).toFixed(1)} BPM` : "Not available";
}

function formatShortBpm(value) {
  return isFiniteNumber(value) ? String(Math.round(Number(value))) : "--";
}

function formatPercent(value) {
  return isFiniteNumber(value) ? `${Math.round(Number(value) * 100)}%` : "--";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setBar(bar, value) {
  const percent = isFiniteNumber(value)
    ? Math.max(0, Math.min(100, Number(value) * 100))
    : 0;
  bar.style.width = `${percent}%`;
}

function getQuality(status, key) {
  return status?.quality_components?.[key];
}

function getRoiHr(status, roiName) {
  return status?.roi_diagnostics?.[roiName]?.hr_bpm;
}

function getDisplayEstimate(status) {
  if (!status) {
    return null;
  }
  if (isFiniteNumber(status.hr_bpm)) {
    return Number(status.hr_bpm);
  }
  if (isFiniteNumber(status.candidate_hr_bpm)) {
    return Number(status.candidate_hr_bpm);
  }
  return null;
}

function loadTrials() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("rppg_trials") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistTrials() {
  window.localStorage.setItem("rppg_trials", JSON.stringify(savedTrials));
}

function updateTrialPreview() {
  const estimate = getDisplayEstimate(latestStatus);
  const truth = groundTruthInput?.value;
  const truthNumber = isFiniteNumber(truth) ? Number(truth) : null;

  trialCurrentEstimate.textContent = isFiniteNumber(estimate)
    ? `${estimate.toFixed(1)} BPM`
    : "--";

  if (isFiniteNumber(estimate) && isFiniteNumber(truthNumber)) {
    trialCurrentError.textContent = `${Math.abs(estimate - truthNumber).toFixed(1)} BPM`;
  } else {
    trialCurrentError.textContent = "--";
  }
}

function renderTrials() {
  trialCountBadge.textContent = `${savedTrials.length} saved`;

  if (savedTrials.length === 0) {
    trialTableBody.innerHTML = `<tr><td colspan="7">No trials saved yet.</td></tr>`;
    trialMeanError.textContent = "--";
    updateTrialPreview();
    return;
  }

  const errors = savedTrials.map((trial) => Math.abs(trial.estimatedBpm - trial.truthBpm));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  trialMeanError.textContent = `${meanError.toFixed(1)} BPM`;

  trialTableBody.innerHTML = savedTrials
    .slice()
    .reverse()
    .map((trial) => {
      const error = Math.abs(trial.estimatedBpm - trial.truthBpm);
      return `
        <tr>
          <td>${trial.time}</td>
          <td>${trial.estimatedBpm.toFixed(1)}</td>
          <td>${trial.truthBpm.toFixed(1)}</td>
          <td>${error.toFixed(1)}</td>
          <td>${isFiniteNumber(trial.sqi) ? trial.sqi.toFixed(2) : "--"}</td>
          <td>${escapeHtml(trial.condition)}</td>
          <td>${trial.notes ? escapeHtml(trial.notes) : "—"}</td>
        </tr>
      `;
    })
    .join("");

  updateTrialPreview();
}

function saveCurrentTrial() {
  const estimate = getDisplayEstimate(latestStatus);
  const truth = groundTruthInput?.value;

  if (!isFiniteNumber(estimate)) {
    trialCurrentError.textContent = "No rPPG estimate";
    return;
  }

  if (!isFiniteNumber(truth)) {
    trialCurrentError.textContent = "Enter truth BPM";
    groundTruthInput?.focus();
    return;
  }

  const now = new Date();
  savedTrials.push({
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    estimatedBpm: Number(estimate),
    truthBpm: Number(truth),
    sqi: isFiniteNumber(latestStatus?.sqi) ? Number(latestStatus.sqi) : null,
    condition: trialConditionInput?.value || "Unlabeled",
    notes: trialNotesInput?.value?.trim() || "",
    wasValidated: Boolean(latestStatus?.is_valid),
  });
  persistTrials();
  renderTrials();
}

function updateDiagnostics(status) {
  if (!diagnosticsModal) {
    return;
  }

  const confidence = getQuality(status, "peak_prominence_component");
  const candidate = status?.candidate_hr_bpm;
  const validated = status?.hr_bpm;

  diagCandidateBpm.textContent = isFiniteNumber(candidate)
    ? `${Number(candidate).toFixed(1)} BPM`
    : "--";
  diagValidatedBpm.textContent = isFiniteNumber(validated)
    ? `${Number(validated).toFixed(1)} BPM`
    : "--";
  diagSqi.textContent = formatNumber(status?.sqi, 4);
  diagConfidence.textContent = formatNumber(confidence, 4);
  diagBuffer.textContent = formatPercent(status?.buffer_fill);
  diagFps.textContent = formatNumber(status?.effective_fps, 2);
  diagMotion.textContent = formatNumber(status?.motion_score, 5);
  diagFace.textContent = formatNumber(status?.face_confidence, 2);
  diagPixels.textContent = formatPercent(status?.valid_pixel_fraction);
  diagExposure.textContent = formatNumber(status?.exposure_instability, 5);
  diagReason.textContent =
    status?.error ||
    status?.validity_reason ||
    "Waiting for the backend to process camera frames.";

  if (status?.is_valid) {
    diagnosticsSummary.textContent =
      "The backend has accepted the current estimate. You can save a trial with a reference BPM.";
  } else if (isFiniteNumber(candidate)) {
    diagnosticsSummary.textContent =
      "The backend has a candidate BPM, but it is withholding the main result until quality gates pass.";
  } else if (status?.running) {
    diagnosticsSummary.textContent =
      "The scan is running, but no candidate pulse has been extracted yet. Keep your face centered and hold still.";
  } else {
    diagnosticsSummary.textContent =
      "Scanner is not running. Click start session to begin processing camera frames.";
  }

  updateDiagnosticsReport(status?.session_report);
}

function updateDiagnosticsReport(report) {
  if (!diagReportBadge) {
    return;
  }

  if (!report) {
    diagReportBadge.textContent = "No report yet";
    diagReportDuration.textContent = "--";
    diagReportFrames.textContent = "--";
    diagReportAvgCandidate.textContent = "--";
    diagReportAvgValidated.textContent = "--";
    diagReportRange.textContent = "--";
    diagReportValidFrames.textContent = "--";
    diagReportAvgSqi.textContent = "--";
    diagReportAvgConfidence.textContent = "--";
    diagReportAvgMotion.textContent = "--";
    diagReportAvgPixels.textContent = "--";
    diagReportReason.textContent = "Stop a scan to generate the session report.";
    renderDiagnosticPoints([]);
    return;
  }

  diagReportBadge.textContent = "Report ready";
  diagReportDuration.textContent = isFiniteNumber(report.duration_seconds)
    ? `${Number(report.duration_seconds).toFixed(1)}s`
    : "--";
  diagReportFrames.textContent = isFiniteNumber(report.frames_processed)
    ? String(report.frames_processed)
    : "--";
  diagReportAvgCandidate.textContent = isFiniteNumber(report.average_candidate_bpm)
    ? `${Number(report.average_candidate_bpm).toFixed(1)} BPM`
    : "--";
  diagReportAvgValidated.textContent = isFiniteNumber(report.average_validated_bpm)
    ? `${Number(report.average_validated_bpm).toFixed(1)} BPM`
    : "--";
  diagReportRange.textContent =
    isFiniteNumber(report.min_candidate_bpm) && isFiniteNumber(report.max_candidate_bpm)
      ? `${Number(report.min_candidate_bpm).toFixed(1)}–${Number(report.max_candidate_bpm).toFixed(1)} BPM`
      : "--";
  diagReportValidFrames.textContent =
    isFiniteNumber(report.valid_samples) && isFiniteNumber(report.frames_processed)
      ? `${report.valid_samples}/${report.frames_processed} (${formatPercent(report.valid_ratio)})`
      : "--";
  diagReportAvgSqi.textContent = formatNumber(report.average_sqi, 4);
  diagReportAvgConfidence.textContent = formatNumber(report.average_confidence, 4);
  diagReportAvgMotion.textContent = formatNumber(report.average_motion_score, 5);
  diagReportAvgPixels.textContent = formatPercent(report.average_valid_pixel_fraction);
  diagReportReason.textContent = report.dominant_reason || "No dominant reason reported.";
  renderDiagnosticPoints(report.sample_points || []);
}

function renderDiagnosticPoints(points) {
  if (!diagPointsBody) {
    return;
  }

  if (!Array.isArray(points) || points.length === 0) {
    diagPointsBody.innerHTML = `<tr><td colspan="7">No individual diagnostic points available yet.</td></tr>`;
    return;
  }

  diagPointsBody.innerHTML = points
    .map((point) => `
      <tr>
        <td>${isFiniteNumber(point.t) ? `${Number(point.t).toFixed(1)}s` : "--"}</td>
        <td>${isFiniteNumber(point.candidate) ? Number(point.candidate).toFixed(1) : "--"}</td>
        <td>${isFiniteNumber(point.validated) ? Number(point.validated).toFixed(1) : "--"}</td>
        <td>${formatNumber(point.sqi, 3)}</td>
        <td>${formatNumber(point.confidence, 3)}</td>
        <td>${formatNumber(point.motion, 4)}</td>
        <td>${point.valid ? "yes" : "no"}</td>
      </tr>
    `)
    .join("");
}

function updateDiagnosticMode() {
  const showPoints = diagReportMode?.value === "points";
  if (diagAveragePanel) {
    diagAveragePanel.hidden = showPoints;
  }
  if (diagPointsPanel) {
    diagPointsPanel.hidden = !showPoints;
  }
}

function setCollectionGate(element, passed, waiting = false) {
  if (!element) {
    return;
  }
  element.textContent = waiting ? "waiting" : passed ? "pass" : "blocked";
  element.classList.toggle("pass", !waiting && passed);
  element.classList.toggle("fail", !waiting && !passed);
}

function updateResearchCollection(status) {
  if (!researchCollectionBadge) {
    return;
  }

  const confidence = getQuality(status, "peak_prominence_component");
  const sqi = status?.sqi;
  const bufferFill = status?.buffer_fill;
  const motionScore = status?.motion_score;

  const hasConfidence = isFiniteNumber(confidence);
  const hasSqi = isFiniteNumber(sqi);
  const hasBuffer = isFiniteNumber(bufferFill);
  const hasMotion = isFiniteNumber(motionScore);

  const confidencePass = hasConfidence && Number(confidence) >= 0.12;
  const sqiPass = hasSqi && Number(sqi) >= 0.18;
  const bufferPass = hasBuffer && Number(bufferFill) >= 0.35;
  const motionPass = hasMotion && Number(motionScore) <= 0.09;
  const isRecording = Boolean(status?.is_valid);

  collectionConfidence.textContent = formatNumber(confidence, 4);
  collectionSqi.textContent = formatNumber(sqi, 4);
  collectionBuffer.textContent = formatPercent(bufferFill);
  collectionMotion.textContent = formatNumber(motionScore, 5);

  setCollectionGate(collectionConfidenceGate, confidencePass, !hasConfidence);
  setCollectionGate(collectionSqiGate, sqiPass, !hasSqi);
  setCollectionGate(collectionBufferGate, bufferPass, !hasBuffer);
  setCollectionGate(collectionMotionGate, motionPass, !hasMotion);

  researchCollectionBadge.textContent = isRecording
    ? "Recording"
    : status?.running
      ? "Collecting"
      : "Waiting";
  researchCollectionBadge.classList.toggle("good", isRecording);

  if (isRecording) {
    researchCollectionSummary.textContent =
      "The current frame passed the backend gates, so the validated estimate is being added to the trend/history.";
    return;
  }

  const blocked = [];
  if (!confidencePass) blocked.push("pulse confidence");
  if (!sqiPass) blocked.push("SQI");
  if (!bufferPass) blocked.push("buffer length");
  if (!motionPass) blocked.push("motion stability");

  researchCollectionSummary.textContent = status?.running
    ? blocked.length
      ? `Collecting signal. Not saving to trend yet because ${blocked.join(", ")} still needs to pass.`
      : "Signal gates are passing, but the backend has not marked this frame as a validated trend point yet."
    : "Scanner is not running. Click start session to begin collecting research timeline points.";
}

async function postJson(url) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function postFrame(blob) {
  const response = await fetch("/api/scan/frame", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Frame processing failed: ${response.status}`);
  }
  return response.json();
}

async function getStatus() {
  const response = await fetch("/api/scan/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Status failed: ${response.status}`);
  }
  return response.json();
}

function buildTrendPath(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return "";
  }
  const points = history.filter((point) => isFiniteNumber(point.hr_bpm));
  if (points.length < 2) {
    return "";
  }
  const width = 720;
  const height = 260;
  const padding = 28;
  const minHr = Math.min(...points.map((point) => Number(point.hr_bpm)));
  const maxHr = Math.max(...points.map((point) => Number(point.hr_bpm)));
  const hrRange = Math.max(8, maxHr - minHr);
  const startTime = Number(points[0].elapsed_seconds);
  const endTime = Number(points[points.length - 1].elapsed_seconds);
  const timeRange = Math.max(1, endTime - startTime);

  const coordinates = points.map((point) => {
    const x = ((Number(point.elapsed_seconds) - startTime) / timeRange) * width;
    const y =
      height -
      padding -
      ((Number(point.hr_bpm) - minHr + (hrRange - (maxHr - minHr)) / 2) / hrRange) *
        (height - padding * 2);
    return [x, y];
  });

  return coordinates
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}

function formatElapsed(seconds) {
  if (!isFiniteNumber(seconds)) {
    return "--:--";
  }
  const total = Math.max(0, Math.round(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimeline(events) {
  if (!Array.isArray(events) || events.length === 0) {
    timeline.innerHTML = `
      <div class="event">
        <span>--:--</span>
        <p>No scan events recorded yet.</p>
      </div>
    `;
    return;
  }

  timeline.innerHTML = events
    .slice(-5)
    .reverse()
    .map((event) => {
      const highlight = event.kind === "valid" ? " highlight" : "";
      return `
        <div class="event${highlight}">
          <span>${formatElapsed(event.elapsed_seconds)}</span>
          <p>${event.message}</p>
        </div>
      `;
    })
    .join("");
}

function updateMainDashboard(status) {
  latestStatus = status;
  const valid = Boolean(status.is_valid);
  const roiAgreement = getQuality(status, "roi_agreement");
  const peakProminence = getQuality(status, "peak_prominence_component");
  const motionStability = getQuality(status, "motion_stability");
  const exposureStability = getQuality(status, "exposure_stability");

  currentValidity.textContent = valid ? "Valid backend estimate" : "No valid estimate";
  currentValidity.classList.toggle("muted-status", !valid);
  currentBpm.textContent = valid ? formatShortBpm(status.hr_bpm) : "--";
  currentSqi.textContent = valid ? formatNumber(status.sqi, 2) : "--";
  currentFps.textContent = isFiniteNumber(status.effective_fps)
    ? Number(status.effective_fps).toFixed(1)
    : "--";
  currentRoiAgreement.textContent = formatNumber(roiAgreement, 2);

  roiForehead.textContent = formatBpm(getRoiHr(status, "forehead"));
  roiLeft.textContent = formatBpm(getRoiHr(status, "cheek_left"));
  roiRight.textContent = formatBpm(getRoiHr(status, "cheek_right"));

  qualityPeak.textContent = formatNumber(peakProminence, 2);
  qualityRoi.textContent = formatNumber(roiAgreement, 2);
  qualityMotion.textContent = formatNumber(motionStability, 2);
  qualityExposure.textContent = formatNumber(exposureStability, 2);
  setBar(qualityPeakBar, peakProminence);
  setBar(qualityRoiBar, roiAgreement);
  setBar(qualityMotionBar, motionStability);
  setBar(qualityExposureBar, exposureStability);
  updateResearchCollection(status);

  const history = Array.isArray(status.history) ? status.history : [];
  const path = buildTrendPath(history);
  trendPath.setAttribute("d", path);
  baselinePath.setAttribute("d", path ? "M0 134 H720" : "");
  trendBadge.textContent =
    history.length > 0 ? `${history.length} validated point${history.length === 1 ? "" : "s"}` : "No validated points";
  trendBadge.classList.toggle("good", history.length > 0);
  updateTimeline(status.events);

  if (valid) {
    measurementSummary.textContent = `The backend rPPG pipeline currently reports HR ${Number(
      status.hr_bpm,
    ).toFixed(1)} BPM with SQI ${Number(status.sqi).toFixed(
      2,
    )}. Save a trial with a reference BPM to measure absolute error.`;
    heartRateStatus.textContent = `${Number(status.hr_bpm).toFixed(1)} BPM measured by rPPG`;
    signalGateStatus.textContent = "Passed current SQI gate";
  } else {
    measurementSummary.textContent =
      status.validity_reason ||
      "No rPPG estimate has been produced yet. Start a scan and wait for the pipeline to pass its quality gates.";
    heartRateStatus.textContent = "Unavailable";
    signalGateStatus.textContent = status.running ? "Collecting / withheld" : "Scanner not running";
  }

  cameraPanelStatus.textContent = status.running
    ? "Live annotated camera feedback is open in the scan popup."
    : "Press “start session” to stream the actual annotated camera feed in the popup.";

  updateTrialPreview();
  updateDiagnostics(status);
}

function openDiagnostics() {
  diagnosticsModal.classList.add("open");
  diagnosticsModal.setAttribute("aria-hidden", "false");
  updateDiagnostics(latestStatus || {});
}

function closeDiagnostics() {
  diagnosticsModal.classList.remove("open");
  diagnosticsModal.setAttribute("aria-hidden", "true");
}

function updateScanUi(status) {
  updateMainDashboard(status);

  const valid = Boolean(status.is_valid);
  const displayHr = valid ? status.hr_bpm : status.candidate_hr_bpm;

  scanBpm.textContent = formatShortBpm(displayHr);
  scanSqi.textContent = formatNumber(status.sqi, 2);
  scanFace.textContent = formatNumber(status.face_confidence, 2);
  scanBuffer.textContent = formatPercent(status.buffer_fill);
  scanWindow.textContent = isFiniteNumber(status.window_seconds)
    ? `${Number(status.window_seconds).toFixed(1)}s`
    : "--";
  scanInputFps.textContent = isFiniteNumber(status.browser_input_fps)
    ? Number(status.browser_input_fps).toFixed(1)
    : "--";
  scanMotion.textContent = formatNumber(status.motion_score, 3);
  scanPixels.textContent = formatPercent(status.valid_pixel_fraction);
  scanExposure.textContent = formatNumber(status.exposure_instability, 3);
  scanReason.textContent =
    status.error ||
    status.validity_reason ||
    "Keep your face centered and hold still for about 10–20 seconds.";

  const streamAge = Number(status.stream_age_seconds);
  if (
    status.running &&
    status.stream_frame_id > 0 &&
    status.stream_frame_id === lastStreamFrameId &&
    Number.isFinite(streamAge) &&
    streamAge > 8
  ) {
    unchangedStatusPolls += 1;
  } else {
    unchangedStatusPolls = 0;
  }
  lastStreamFrameId = status.stream_frame_id;

  if (status.running && unchangedStatusPolls >= 4) {
    scanReason.textContent =
      "Camera stream appears stalled. Press Stop session, then start a new session.";
  }

  scanValidity.classList.toggle("valid", valid);
  scanValidity.textContent = valid ? "Valid backend estimate" : "Collecting / withheld";
}

function startPollingStatus() {
  window.clearInterval(statusTimer);
  window.clearInterval(passiveStatusTimer);
  statusTimer = window.setInterval(async () => {
    try {
      updateScanUi(await getStatus());
    } catch (error) {
      scanReason.textContent = error.message;
    }
  }, 900);
}

function startPassiveStatusPolling() {
  window.clearInterval(passiveStatusTimer);
  passiveStatusTimer = window.setInterval(async () => {
    try {
      updateMainDashboard(await getStatus());
    } catch {
      // Leave current UI state in place if the local backend is not reachable.
    }
  }, 1500);
}

async function openScan() {
  scanModal.classList.add("open");
  scanModal.setAttribute("aria-hidden", "false");
  cameraPlaceholder.classList.remove("hidden");
  scanVideo.removeAttribute("src");
  lastStreamFrameId = null;
  unchangedStatusPolls = 0;
  scanReason.textContent = "Opening the camera…";

  try {
    await postJson("/api/scan/start");
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    browserCamera.srcObject = cameraStream;
    await browserCamera.play();
    cameraPlaceholder.classList.add("hidden");
    startFramePosting();
    startPollingStatus();
    updateScanUi(await getStatus());
  } catch (error) {
    scanReason.textContent = error.message;
  }
}

async function closeScan({ stopCamera = false } = {}) {
  scanModal.classList.remove("open");
  scanModal.setAttribute("aria-hidden", "true");
  window.clearInterval(statusTimer);
  window.clearInterval(frameTimer);
  frameTimer = null;
  frameInFlight = false;
  scanVideo.removeAttribute("src");
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  browserCamera.srcObject = null;
  if (stopCamera) {
    try {
      const stoppedStatus = await postJson("/api/scan/stop");
      updateMainDashboard(stoppedStatus);
      openDiagnostics();
    } catch {
      // The UI should still close if the local server is already gone.
    }
  }
  startPassiveStatusPolling();
}

function startFramePosting() {
  window.clearInterval(frameTimer);
  frameTimer = window.setInterval(captureAndProcessFrame, 85);
  captureAndProcessFrame();
}

async function captureAndProcessFrame() {
  if (frameInFlight || !browserCamera.videoWidth || !browserCamera.videoHeight) {
    return;
  }
  frameInFlight = true;
  try {
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / browserCamera.videoWidth);
    const width = Math.round(browserCamera.videoWidth * scale);
    const height = Math.round(browserCamera.videoHeight * scale);
    captureCanvas.width = width;
    captureCanvas.height = height;
    const context = captureCanvas.getContext("2d", { willReadFrequently: false });
    context.drawImage(browserCamera, 0, 0, width, height);
    const blob = await new Promise((resolve) =>
      captureCanvas.toBlob(resolve, "image/jpeg", 0.74),
    );
    if (!blob) {
      return;
    }
    const status = await postFrame(blob);
    if (status.annotated_frame) {
      scanVideo.src = status.annotated_frame;
    }
    updateScanUi(status);
  } catch (error) {
    scanReason.textContent = error.message;
  } finally {
    frameInFlight = false;
  }
}

scanFaceButton?.addEventListener("click", openScan);
diagnosticsButton?.addEventListener("click", openDiagnostics);
scanDiagnosticsButton?.addEventListener("click", openDiagnostics);
diagReportMode?.addEventListener("change", updateDiagnosticMode);
saveTrialButton?.addEventListener("click", saveCurrentTrial);
clearTrialsButton?.addEventListener("click", () => {
  savedTrials = [];
  persistTrials();
  renderTrials();
});
groundTruthInput?.addEventListener("input", updateTrialPreview);
stopScanButton?.addEventListener("click", () => closeScan({ stopCamera: true }));
document.querySelectorAll("[data-close-scan]").forEach((element) => {
  element.addEventListener("click", () => closeScan({ stopCamera: false }));
});
document.querySelectorAll("[data-close-diagnostics]").forEach((element) => {
  element.addEventListener("click", closeDiagnostics);
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && scanModal.classList.contains("open")) {
    closeScan({ stopCamera: false });
  }
  if (event.key === "Escape" && diagnosticsModal.classList.contains("open")) {
    closeDiagnostics();
  }
});

getStatus().then(updateMainDashboard).catch(() => {});
renderTrials();
updateDiagnosticMode();
startPassiveStatusPolling();
