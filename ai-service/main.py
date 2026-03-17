from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from ultralytics import YOLO
import shutil
import os
import uuid
import cv2

app = FastAPI()

model = YOLO("yolov8n.pt")

VEHICLE_CLASSES = ["car", "motorbike", "bus", "truck"]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect-video")
async def detect_video(file: UploadFile = File(...)):
    input_path = f"input_{uuid.uuid4().hex}.mp4"
    output_path = f"output_{uuid.uuid4().hex}.mp4"

    # save uploaded video
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cap = cv2.VideoCapture(input_path)

    # video properties
    width = int(cap.get(3))
    height = int(cap.get(4))
    fps = int(cap.get(5))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_count = 0
    total_vehicles = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # run YOLO on frame
        results = model(frame)

        vehicle_count_frame = 0

        for r in results:
            for box in r.boxes:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]

                if class_name in VEHICLE_CLASSES:
                    vehicle_count_frame += 1

            # draw boxes
            annotated = r.plot()

        total_vehicles += vehicle_count_frame
        frame_count += 1

        # write frame
        out.write(annotated)

    cap.release()
    out.release()
    os.remove(input_path)

    avg_vehicles = total_vehicles / max(frame_count, 1)

    # traffic density
    if avg_vehicles <= 3:
        density = "low"
    elif avg_vehicles <= 7:
        density = "medium"
    else:
        density = "high"

    return {
        "average_vehicle_per_frame": avg_vehicles,
        "traffic_density": density,
        "video_url": f"/video/{os.path.basename(output_path)}"
    }


@app.get("/video/{video_name}")
def get_video(video_name: str):
    return FileResponse(video_name, media_type="video/mp4")