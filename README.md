# rPPG Heart Rate Pipeline

Remote photoplethysmography (rPPG) pipeline for estimating heart rate from a webcam or video file using face tracking, skin-region color signals, temporal filtering, and BPM estimation.

This is intended for prototyping and research demos only. It is not a medical device and should not be used for diagnosis, or treatment.

## Features

- Webcam or video-file input
- Face detection with MediaPipe
- Forehead/cheek skin-region sampling
- RGB signal extraction
- POS and CHROM rPPG methods
- Bandpass filtering for heart-rate range
- Sliding-window BPM estimation
- Optional live visualization
- CSV export of estimated BPM over time
- Localhost browser UI with live camera feed, annotated ROI overlay, BPM, SQI, trend chart, and quality gates

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run the localhost live-camera UI

This is the easiest way to demo the project.

```bash
python -m rppg.web
```

Then open:

```text
http://127.0.0.1:8000
```

Click "scan face". Your browser will ask for camera permission. Once accepted, the browser captures webcam frames and sends them to the local Python backend. The backend runs the rPPG pipeline and returns the live annotated camera frame plus heart-rate status.

### What the localhost UI displays

- **Live camera feed** in the scan popup
- **Annotated ROI overlay** showing the face regions used for color sampling
- **Current BPM estimate** once the backend has enough stable signal
- **SQI**, meaning signal-quality index
- **FPS** and input stream timing
- **Buffer fill**, so you know whether enough seconds have been collected
- **Motion stability** and **exposure stability**
- **Heart-rate trend chart** for validated readings
- **Measurement summary** explaining whether the estimate is valid or withheld

The UI intentionally shows `--` or “Collecting / withheld” until the backend produces an estimate that passes basic quality gates. This makes the demo more defensible than always showing a guessed BPM.

### Localhost API routes

The browser UI calls these routes:

```text
GET  /                       static dashboard
POST /api/scan/start         reset and start scanner state
POST /api/scan/frame         process one JPEG camera frame
GET  /api/scan/status        return latest BPM/SQI/status
POST /api/scan/stop          stop and reset scanner state
```

### Localhost troubleshooting

If the UI opens but the camera does not start:

- Make sure you are using `http://127.0.0.1:8000`, not a random LAN/IP URL.
- In your browser settings, allow camera access for localhost.
- Close Zoom, Photo Booth, FaceTime, or anything else holding the camera.
- Refresh the page and click **scan face** again.

If the camera starts but BPM remains unavailable:

- Keep your face centered and mostly still.
- Use stable front lighting.
- Wait at least 10–20 seconds.
- Avoid shadows, backlighting, and rapid head movement.
- Try `--method chrom` in the CLI path if POS is unstable for your lighting.

## Run on webcam

```bash
python -m rppg --source 0 --method pos --show
```

## Run on a video file

```bash
python -m rppg --source path/to/video.mp4 --method pos --output results.csv --show
```

## Methods

### POS

Plane-Orthogonal-to-Skin rPPG. Usually a strong default for webcam demos because it tries to suppress illumination variation by projecting normalized RGB signals into a pulse-sensitive plane.

### CHROM

Chrominance-based rPPG. Also useful, especially when color-channel variation is cleaner than motion noise.

## Recommended demo conditions

For best results:

- Use a stable camera.
- Keep the face visible and mostly frontal.
- Avoid strong shadows, flashing lights, and rapid head movement.
- Use a 20–30 second window before trusting the estimate.
- Compare against a pulse oximeter or smartwatch only as a rough reference.

## Project structure

```text
rppg/
  __main__.py        CLI entrypoint
  web.py             localhost web backend
  pipeline.py        main video/webcam loop
  face.py            face mesh ROI extraction
  methods.py         POS and CHROM signal methods
  signal.py          filtering and BPM estimation
  utils.py           small helpers
web_ui/
  index.html         browser dashboard
  app.js             camera capture + API calls
  styles.css         dashboard styling
requirements.txt
README.md
```

## Important limitations

rPPG is sensitive to lighting, motion, camera compression, skin visibility, frame-rate instability, and ROI selection. A close BPM match on a short demo can happen by chance, especially if the estimate is constrained to a normal resting range. Treat this as a signal-processing demo, not a validated health system.
