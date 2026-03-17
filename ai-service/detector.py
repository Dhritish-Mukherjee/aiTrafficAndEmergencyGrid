import os
import base64
import cv2
import numpy as np

# We try to import YOLO and load it once at module level (on startup).
# This avoids loading the heavy model on every request.
try:
    from ultralytics import YOLO
    _model = YOLO("yolov8n.pt")
except ImportError:
    _model = None

# COCO indices for vehicles: 2=car, 3=motorcycle, 5=bus, 7=truck
VEHICLE_CLASSES = {2, 3, 5, 7}

def analyze(frame_b64: str) -> int:
    """
    Decodes a base64 image, runs YOLO inference, and returns the vehicle count.
    """
    if _model is None:
        raise RuntimeError("YOLO model could not be loaded. Please ensure ultralytics is installed.")
        
    try:
        # Decode base64 to bytes
        img_data = base64.b64decode(frame_b64)
        np_arr = np.frombuffer(img_data, np.uint8)
        
        # Decode image array to OpenCV format (BGR)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Could not decode image base64 into a valid frame.")
        
        # Run YOLO prediction
        results = _model.predict(img, verbose=False)
        
        count = 0
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                if cls_id in VEHICLE_CLASSES:
                    count += 1
                    
        return count
        
    except Exception as e:
        print(f"Error in detector analyze: {e}")
        raise
