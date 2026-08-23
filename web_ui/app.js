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

function isFiniteNumber(value) {
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
    )}. This is a research-use contactless estimate, not a diagnosis or clinical triage decision.`;
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
    : "Press “Scan face” to stream the actual annotated camera feed in the popup.";
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
      "Camera stream appears stalled. Press Stop scan, then Scan face again.";
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
      updateMainDashboard(await postJson("/api/scan/stop"));
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
stopScanButton?.addEventListener("click", () => closeScan({ stopCamera: true }));
document.querySelectorAll("[data-close-scan]").forEach((element) => {
  element.addEventListener("click", () => closeScan({ stopCamera: false }));
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && scanModal.classList.contains("open")) {
    closeScan({ stopCamera: false });
  }
});

getStatus().then(updateMainDashboard).catch(() => {});
startPassiveStatusPolling();
