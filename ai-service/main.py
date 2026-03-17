import os
import json
import time
import random
import asyncio
import threading
import base64
from typing import List, Dict, Any, Union
from contextlib import asynccontextmanager

import cv2
import numpy as np
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

MODE             = os.getenv("MODE", "mock")
NODE_SERVICE_URL = os.getenv("NODE_SERVICE_URL", "http://localhost:5000")

_raw_sources = os.getenv("JUNCTION_SOURCES", "{}")
try:
    JUNCTION_SOURCES: Dict[str, str] = json.loads(_raw_sources)
except Exception:
    JUNCTION_SOURCES = {}

# COCO vehicle class indices
VEHICLE_CLASSES = {2, 3, 5, 7}
CLASS_NAMES     = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# Consistent color per track-ID (BGR) — cycles through 20 vivid colors
_PALETTE = [
    (0, 200, 80),   (255, 100, 0),   (0, 120, 255),  (200, 0, 200),
    (0, 220, 220),  (255, 220, 0),   (160, 50, 255),  (255, 50, 150),
    (50, 255, 200), (255, 160, 50),  (100, 255, 50),  (50, 100, 255),
    (200, 200, 0),  (0, 160, 255),   (255, 80, 80),   (80, 255, 80),
    (255, 0, 100),  (0, 255, 160),   (200, 100, 0),   (100, 0, 200),
]

def _track_color(track_id: int):
    return _PALETTE[int(track_id) % len(_PALETTE)]


# ─── Per-junction YOLO model registry ────────────────────────────────────────
# Each junction gets its OWN YOLO instance so:
#   1. Tracker state (ByteTrack) is isolated per stream
#   2. PyTorch releases the GIL during inference → 8 threads run truly in parallel
# YOLOv8n is ~30-60MB RAM per instance; 8 instances ≈ 480MB — fine for a laptop

junction_models: Dict[str, Any] = {}   # junction_id → YOLO instance


def _load_models():
    """Called once at startup. Loads one YOLOv8n per junction."""
    global MODE   # must be declared before any read/write of MODE
    if MODE != "live":
        return
    try:
        from ultralytics import YOLO
        for j_id in JUNCTION_SOURCES:
            print(f"  🔬 Loading YOLO model for junction {j_id[:10]}…")
            junction_models[j_id] = YOLO("yolov8n.pt")
        print(f"✅ {len(junction_models)} YOLO models loaded (one per junction).")
    except Exception as e:
        print(f"⚠️  Failed to load YOLO models: {e}\n   Falling back to MOCK mode.")
        MODE = "mock"


# ─── Shared frame state ───────────────────────────────────────────────────────

latest_frames: Dict[str, bytes] = {}   # junction_id → latest annotated JPEG bytes
latest_counts: Dict[str, Dict]  = {}   # junction_id → { vehicle_count, classes }
frame_counters: Dict[str, int]  = {}   # junction_id → monotonic frame counter
_state_lock = threading.Lock()


# ─── Drawing helpers ──────────────────────────────────────────────────────────

def _draw_tracked_boxes(frame: np.ndarray, results, vehicle_counts: Dict[str, int]) -> np.ndarray:
    """
    Draws ByteTrack-annotated bounding boxes onto frame.
    Each tracked object gets a consistent color tied to its track ID.
    Returns annotated frame (same size as input).
    """
    h, w = frame.shape[:2]

    for r in results:
        boxes = r.boxes
        if boxes is None:
            continue

        has_ids = boxes.id is not None

        for i, box in enumerate(boxes):
            cls_id = int(box.cls[0])
            if cls_id not in VEHICLE_CLASSES:
                continue

            conf  = float(box.conf[0])
            name  = CLASS_NAMES.get(cls_id, "vehicle")
            t_id  = int(boxes.id[i]) if has_ids else i
            color = _track_color(t_id)

            # Scale coords from model input (320×320) back to display frame size
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            # Results are already in the original frame coords when using model.track(source=frame)
            # but we resized frame to 320×320 before passing — scale back
            x1 = int(x1 * w / 320)
            y1 = int(y1 * h / 320)
            x2 = int(x2 * w / 320)
            y2 = int(y2 * h / 320)

            # Bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Label background
            label     = f"#{t_id} {name} {conf:.0%}"
            (lw, lh), bl = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            lx, ly = x1, max(y1 - 1, lh + 4)
            cv2.rectangle(frame, (lx, ly - lh - bl - 2), (lx + lw + 4, ly + 1), color, -1)
            cv2.putText(frame, label, (lx + 2, ly - bl),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

            vehicle_counts[name] = vehicle_counts.get(name, 0) + 1

    return frame


def _draw_hud(frame: np.ndarray, count: int, classes: Dict[str, int]) -> np.ndarray:
    """Draws the vehicle count HUD in the top-right corner."""
    h, w = frame.shape[:2]
    hud = f"Vehicles: {count}"
    cv2.rectangle(frame, (0, 0), (260, 36), (0, 0, 0), -1)
    cv2.putText(frame, hud, (8, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 230, 80), 2, cv2.LINE_AA)
    return frame


def _frame_to_jpeg(frame: np.ndarray) -> bytes:
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()


def _placeholder_jpeg(text: str = "Initializing stream…") -> bytes:
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    # Grid lines for a "CCTV offline" look
    for x in range(0, 640, 40):
        cv2.line(img, (x, 0), (x, 480), (15, 15, 15), 1)
    for y in range(0, 480, 40):
        cv2.line(img, (0, y), (640, y), (15, 15, 15), 1)
    cv2.putText(img, text, (80, 230),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (60, 60, 60), 2, cv2.LINE_AA)
    cv2.putText(img, "AI Traffic Monitor", (160, 265),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1, cv2.LINE_AA)
    return _frame_to_jpeg(img)


# ─── Per-junction video worker ────────────────────────────────────────────────

def _junction_video_worker(junction_id: str, video_path: str, stagger_secs: float = 0.0):
    """
    Runs continuously for one junction.
    - Opens the video, reads every frame
    - Passes each frame through the junction's own YOLO tracker (ByteTrack, persist=True)
    - Draws annotated boxes and stores the JPEG in shared state
    - Loops the video when it ends and resets the tracker
    - Target frame rate: 15fps (sleep the remainder after inference)
    """
    if stagger_secs > 0:
        time.sleep(stagger_secs)

    print(f"🎥 [{junction_id[:10]}] worker started → {video_path}")

    model      = junction_models.get(junction_id)   # None if mock mode
    DISPLAY_W  = 640
    DISPLAY_H  = 480
    MODEL_SIZE = 320      # YOLO input — smaller = faster (YOLOv8n is accurate at 320)
    TARGET_FPS = 15.0
    TARGET_DT  = 1.0 / TARGET_FPS

    # Pre-populate placeholder so the frontend doesn't see a blank canvas
    with _state_lock:
        latest_frames[junction_id] = _placeholder_jpeg("Loading stream…")
        latest_counts[junction_id] = {"vehicle_count": 0, "classes": {}}
        frame_counters[junction_id] = 0

    while True:   # outer loop: re-open video when it ends
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"⚠️  [{junction_id[:10]}] Cannot open {video_path} — retrying in 5s")
            time.sleep(5)
            continue

        # Reset ByteTrack when the video loops so IDs restart cleanly
        if model is not None:
            try:
                if hasattr(model, "predictor") and model.predictor is not None:
                    model.predictor.trackers[0].reset()
            except Exception:
                pass

        while True:
            t0 = time.perf_counter()

            ret, raw_frame = cap.read()
            if not ret:
                # End of video — loop back
                break

            # ── Display frame (shown to user at 640×480) ──────────────────────
            display = cv2.resize(raw_frame, (DISPLAY_W, DISPLAY_H))

            if model is not None:
                # ── YOLO tracking ─────────────────────────────────────────────
                # Resize to model input size for speed (PyTorch releases GIL here)
                small   = cv2.resize(raw_frame, (MODEL_SIZE, MODEL_SIZE))
                results = model.track(
                    small,
                    persist   = True,    # maintain ByteTrack IDs across frames
                    verbose   = False,
                    conf      = 0.30,
                    iou       = 0.50,
                    imgsz     = MODEL_SIZE,
                    classes   = list(VEHICLE_CLASSES),
                )
                # Draw boxes (scaled back to 640×480)
                vehicle_counts: Dict[str, int] = {}
                display = _draw_tracked_boxes(display, results, vehicle_counts)
                total   = sum(vehicle_counts.values())
                display = _draw_hud(display, total, vehicle_counts)

            else:
                # Mock mode — random counts, clean frame
                vehicle_counts = {"car": random.randint(3, 20)}
                total          = sum(vehicle_counts.values())
                display        = _draw_hud(display, total, vehicle_counts)

            # ── Store in shared state ─────────────────────────────────────────
            jpeg = _frame_to_jpeg(display)
            with _state_lock:
                latest_frames[junction_id]  = jpeg
                latest_counts[junction_id]  = {"vehicle_count": total, "classes": vehicle_counts}
                frame_counters[junction_id] = frame_counters.get(junction_id, 0) + 1

            # ── Throttle to TARGET_FPS ────────────────────────────────────────
            elapsed = time.perf_counter() - t0
            sleep_t = TARGET_DT - elapsed
            if sleep_t > 0:
                time.sleep(sleep_t)

        cap.release()
        print(f"🔄 [{junction_id[:10]}] video ended — looping")


# ─── Reporter thread ──────────────────────────────────────────────────────────

def _reporter_worker():
    """Posts latest density data to Node every 5 seconds."""
    print("📡 Reporter started — POSTing to Node every 5s")
    while True:
        time.sleep(5)
        with _state_lock:
            snapshot = dict(latest_counts)

        for junction_id, data in snapshot.items():
            vc     = data.get("vehicle_count", 0)
            cls    = data.get("classes", {})
            score  = min(round((vc / 50) * 100), 100)
            level  = ("SEVERE" if vc > 40 else "HIGH" if vc > 25
                      else "MODERATE" if vc > 10 else "LOW")
            try:
                requests.post(f"{NODE_SERVICE_URL}/api/density/report",
                              json={"junctionId": junction_id, "vehicleCount": vc,
                                    "densityScore": score, "densityLevel": level,
                                    "classes": cls},
                              timeout=4)
            except Exception:
                pass   # Node might not be running during dev


# ─── FastAPI lifespan ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_models()   # load one YOLO per junction (blocking, done before first request)

    if JUNCTION_SOURCES:
        for i, (j_id, video_path) in enumerate(JUNCTION_SOURCES.items()):
            t = threading.Thread(
                target=_junction_video_worker,
                args=(j_id, video_path, i * 0.3),   # stagger start by 0.3s
                daemon=True,
                name=f"vid-{j_id[:8]}"
            )
            t.start()

        threading.Thread(target=_reporter_worker, daemon=True,
                         name="reporter").start()
        print(f"🚦 {len(JUNCTION_SOURCES)} junction threads started.")
    else:
        print("⚠️  JUNCTION_SOURCES not set — no streams started.")

    yield


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="TrafficAI Service — Live YOLO Tracker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ─── Pydantic models ──────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    image_base64: str = None
    camera_id: str = "cam_01"

class AnalyzeResponse(BaseModel):
    vehicle_count: int
    camera_id: str

class JunctionDensity(BaseModel):
    junction_id: str
    vehicle_count: int

class OptimizeTimingRequest(BaseModel):
    junctions: List[JunctionDensity]


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    with _state_lock:
        active = [j for j, f in latest_frames.items() if f is not None]
    return {"status": "ok", "mode": MODE,
            "streams": list(JUNCTION_SOURCES.keys()), "active_streams": active}


@app.get("/frame/{junction_id}")
async def get_frame(junction_id: str):
    """
    Returns the latest YOLO-annotated JPEG for a junction, with count
    data embedded in response headers.  The frame JPEG and its counts
    are read in the same lock snapshot, so they are always perfectly
    in sync — the frontend never sees mismatched boxes vs. counts.

    Headers returned:
      X-Frame-Counter  – monotonic frame index (used for dedup)
      X-Vehicle-Count  – total vehicles in this frame
      X-Classes        – JSON object {className: count}
    """
    with _state_lock:
        jpeg   = latest_frames.get(junction_id)
        ctr    = frame_counters.get(junction_id, 0)
        counts = latest_counts.get(junction_id, {})

    if jpeg is None:
        jpeg   = _placeholder_jpeg("No stream yet")
        ctr    = 0
        counts = {}

    vehicle_count = counts.get("vehicle_count", 0)
    classes       = counts.get("classes", {})

    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "Cache-Control":    "no-store, no-cache",
            "X-Frame-Counter":  str(ctr),
            "X-Vehicle-Count":  str(vehicle_count),
            "X-Classes":        json.dumps(classes),
        },
    )


@app.get("/snapshot/{junction_id}")
async def snapshot(junction_id: str):
    """Alias for /frame — kept for backwards compatibility."""
    return await get_frame(junction_id)


@app.get("/counts")
async def get_counts():
    """Returns current vehicle counts for all junctions."""
    with _state_lock:
        return {"counts": dict(latest_counts)}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """Legacy pull-model endpoint (base64 image → vehicle count)."""
    if MODE == "mock":
        return AnalyzeResponse(vehicle_count=random.randint(5, 45),
                               camera_id=req.camera_id)
    if not req.image_base64:
        raise HTTPException(400, "image_base64 required")
    try:
        img_data = base64.b64decode(req.image_base64)
        np_arr   = np.frombuffer(img_data, np.uint8)
        img      = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Cannot decode image")
        # Use any available junction model for one-shot inference
        model  = next(iter(junction_models.values()), None)
        if model is None:
            return AnalyzeResponse(vehicle_count=random.randint(5, 45),
                                   camera_id=req.camera_id)
        results = model.predict(img, verbose=False, imgsz=320,
                                classes=list(VEHICLE_CLASSES))
        count   = sum(1 for r in results for b in r.boxes
                      if int(b.cls[0]) in VEHICLE_CLASSES)
        return AnalyzeResponse(vehicle_count=count, camera_id=req.camera_id)
    except Exception as e:
        print(f"Error in /analyze: {e}")
        return AnalyzeResponse(vehicle_count=random.randint(5, 45),
                               camera_id=req.camera_id)


# MJPEG stream (kept for reference / VLC testing)
@app.get("/stream/{junction_id}")
async def mjpeg_stream(junction_id: str):
    async def generate():
        while True:
            with _state_lock:
                jpeg = latest_frames.get(junction_id)
            if jpeg is None:
                jpeg = _placeholder_jpeg()
            header = (b"Content-Type: image/jpeg\r\n"
                      b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n")
            yield b"--frame\r\n" + header + jpeg + b"\r\n"
            await asyncio.sleep(0.067)   # ~15fps
    return StreamingResponse(generate(),
                             media_type="multipart/x-mixed-replace; boundary=frame")


from optimizer import calculate_optimal_timing

@app.post("/optimize-timing")
async def optimize_timing(payload: Union[OptimizeTimingRequest, List[Dict], Dict]):
    results, items = [], []
    if isinstance(payload, OptimizeTimingRequest):
        items = payload.junctions
    elif isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = payload.get("junctions", [payload])

    for item in items:
        j_id = (getattr(item, "junction_id", None)
                or (item.get("junctionId") if isinstance(item, dict)
                    else None))
        v_count = getattr(item, "vehicle_count", None)
        if v_count is None and isinstance(item, dict):
            v_count = item.get("vehicleCount", item.get("vehicle_count", 0))
        v_count = int(v_count or 0)
        results.append({"junctionId": j_id, "vehicleCount": v_count,
                        "timings": calculate_optimal_timing(v_count)})
    return {"status": "success", "optimizations": results}


# ─── Raw video streaming ──────────────────────────────────────────────────────

@app.get("/video-sources")
async def video_sources():
    """Returns the junction_id → video filename mapping for the frontend."""
    return {"sources": {j_id: os.path.basename(path)
                        for j_id, path in JUNCTION_SOURCES.items()}}


@app.get("/video/{junction_id}")
async def stream_video(junction_id: str):
    """
    Serves the raw MP4 via Starlette FileResponse.
    FileResponse automatically handles HTTP Range requests (byte-range seeking)
    so the browser <video> element can seek, buffer and loop natively.
    """
    video_path = JUNCTION_SOURCES.get(junction_id)
    if not video_path or not os.path.isfile(video_path):
        raise HTTPException(status_code=404, detail="Video not found for this junction")

    return FileResponse(
        video_path,
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=False)