from flask import Flask, request, jsonify
from flask_cors import CORS   # 👈 ADD THIS
import cv2
import numpy as np
from ultralytics import YOLO
import easyocr

app = Flask(__name__)
CORS(app)  # 👈 ADD THIS LINE

yolo_model = YOLO("yolov8n.pt")
ocr_reader = easyocr.Reader(['en'], gpu=False)


def estimate_distance(box):
    x1, y1, x2, y2 = box
    area = (x2 - x1) * (y2 - y1)

    if area > 50000:
        return "Very Close"
    elif area > 20000:
        return "Near"
    else:
        return "Far"


frame_counter = 0  # GLOBAL counter for frame skipping

@app.route("/detect", methods=["POST"])
def detect():
    global frame_counter
    frame_counter += 1

    file = request.files["frame"]
    img_bytes = file.read()

    npimg = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    # 🔥 Resize frame (huge speed boost)
    frame = cv2.resize(frame, (320, 240))

    # ⚡ Run YOLO with smaller size & higher confidence
    results = yolo_model(frame, imgsz=320, conf=0.5, verbose=False)[0]

    detections = []
    texts = []

    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        cls = int(box.cls[0])
        label = yolo_model.names[cls]
        distance = estimate_distance((x1, y1, x2, y2))

        detections.append({
            "label": label,
            "distance": distance,
            "box": [x1, y1, x2, y2]
        })

    # 🧠 Run OCR only every 5th frame (massive lag reduction)
    if frame_counter % 5 == 0:
        ocr_results = ocr_reader.readtext(frame)
        for (_, text, prob) in ocr_results:
            if prob > 0.6 and len(text.strip()) > 2:
                texts.append(text)

    return jsonify({"objects": detections, "texts": texts})



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
