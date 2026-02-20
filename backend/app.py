from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO

# -------------------------
# 🔥 INIT APP
# -------------------------
app = Flask(_name_)
CORS(app)

# -------------------------
# 🔥 LOAD MODEL
# -------------------------
# Default YOLO (fast)
# S model (Small) for better accuracy than Nano
model = YOLO("yolov8s.pt")
# model = YOLO("model/best.pt") # 👉 If custom model

class_names = model.names

# -------------------------
# 🚦 PEDESTRIAN & HARDWARE
# -------------------------
pedestrian_mode = False
last_vibration_trigger = False

# -------------------------
# 📍 POSITION LOGIC
# -------------------------
def get_position(x_center, width):
    if x_center < width / 3:
        return "left"
    elif x_center < 2 * width / 3:
        return "center"
    else:
        return "right"


# -------------------------
# 📏 DISTANCE LOGIC
# -------------------------
# -------------------------
# 📏 EXACT DISTANCE LOGIC
# -------------------------
# Real world widths in meters (approx)
REAL_WIDTHS = {
    "person": 0.5, "car": 1.8, "truck": 2.5, "bus": 2.9, "motorbike": 0.8,
    "bicycle": 0.6, "cat": 0.15, "dog": 0.2, "chair": 0.5, "bottle": 0.1,
    "laptop": 0.35, "cell phone": 0.07, "cup": 0.08, "tv": 0.9, "couch": 2.0,
    "bed": 1.5, "dining table": 1.2, "toilet": 0.5, "microwave": 0.6,
    "oven": 0.6, "refrigerator": 0.8, "book": 0.2, "clock": 0.3
}
FOCAL_LENGTH = 800 # Pixels (Calibrated for standard webcam)

def get_real_distance(label, box_width_px):
    real_width = REAL_WIDTHS.get(label, 0.5) # Default 0.5m
    if box_width_px == 0: return "Unknown"
    
    # Pinhole Camera Model
    dist_m = (real_width * FOCAL_LENGTH) / box_width_px
    return f"{dist_m:.1f}m"


# -------------------------
# 🚨 DANGER & PRIORITY
# -------------------------
# Priority Levels: 3=Critical, 2=High, 1=Medium, 0=Low
PRIORITY_LEVELS = {
    # 🚨 CRITICAL (3)
    "person": 3, "car": 3, "truck": 3, "bus": 3, "motorbike": 3, 
    "bicycle": 3, "train": 3, "fire": 3, 
    
    # ⚠️ HIGH (2)
    "stop sign": 2, "traffic light": 2, "fire hydrant": 2, 
    "dog": 2, "cat": 2, "horse": 2, "bear": 2, "cow": 2,

    # ℹ️ INFO (1)
    "chair": 1, "couch": 1, "bed": 1, "dining table": 1, "toilet": 1,
    "tv": 1, "laptop": 1, "mouse": 1, "remote": 1, "keyboard": 1,
    "cell phone": 1, "microwave": 1, "oven": 1, "toaster": 1,
    "refrigerator": 1, "book": 1, "clock": 1, "vase": 1, "scissors": 1,
    "teddy bear": 1, "hair drier": 1, "toothbrush": 1,
    
    # 🟢 LOW (0) - Everything else defaults to 0
}

def get_priority(label):
    return PRIORITY_LEVELS.get(label, 0)

danger_objects = ["car", "truck", "bus", "motorbike"]


# -------------------------
# 🪜 STAIR DETECTION
# -------------------------
# -------------------------
# 🧠 ADVANCED NAVIGATION HELPERS
# -------------------------
OBJECT_HISTORY = {} # {label: {'area': 1000, 'timestamp': 123}}

def get_clock_direction(x_center, img_width):
    """Maps X-coordinate to Clock Face (9-3 o'clock)."""
    # map 0..width to 9..15 (where 13=1, 14=2, 15=3)
    # Norm -1 to 1 (left to right)
    norm = (x_center / img_width) * 2 - 1 
    
    # Angle coverage: -60 deg (10 o'clock) to +60 deg (2 o'clock)
    # Actually simpler: 
    # Left (0-30%): 10, 11
    # Center (30-70%): 12
    # Right (70-100%): 1, 2
    
    pct = x_center / img_width
    if pct < 0.2: return "10 o'clock"
    if pct < 0.4: return "11 o'clock"
    if pct < 0.6: return "12 o'clock"
    if pct < 0.8: return "1 o'clock"
    return "2 o'clock"

def analyze_movement(label, current_area):
    """Detects if object is approaching (getting bigger)."""
    global OBJECT_HISTORY
    
    info = OBJECT_HISTORY.get(label)
    state = "Static"
    
    if info:
        prev_area = info['area']
        ratio = current_area / prev_area
        
        if ratio > 1.1: state = "Approaching"
        elif ratio < 0.9: state = "Receding"
        elif ratio > 1.2: state = "Approaching FAST" # Critical
    
    # Update history
    OBJECT_HISTORY[label] = {'area': current_area}
    return state


def detect_stairs(image):
    """
    Detects stairs using edge detection in the lower half of the image.
    Returns (True/False, step_count)
    """
    h, w, _ = image.shape
    roi = image[int(h/2):h, :] # Bottom half only
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # Lower threshold for Canny, Stricter for Hough
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 150, minLineLength=150, maxLineGap=20)
    
    unique_y = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
            if angle < 5: # Strictly horizontal
                # Check if this line is distinct (spaced out) from others
                is_distinct = True
                avg_y = (y1 + y2) / 2
                for existing_y in unique_y:
                    if abs(existing_y - avg_y) < 20: # Must be at least 20px apart
                        is_distinct = False
                        break
                if is_distinct:
                    unique_y.append(avg_y)
    
    step_count = len(unique_y)
    
    # Require 5+ distinct steps (reduces noise significantly)
    if step_count >= 5:
        return True, step_count
    return False, 0


# -------------------------
# 🧠 SMART NAVIGATION LOGIC
# -------------------------
# -------------------------
# 🧠 SMART NAVIGATION LOGIC
# -------------------------
def get_smart_instruction(objects, stairs_found, step_count):
    global last_vibration_trigger
    last_vibration_trigger = False # Reset

    # 1. Stair Check (Always important)
    if stairs_found:
        last_vibration_trigger = True
        return f"Stairs ahead. Stop and find handrail. {step_count} steps."

    if not objects:
        return "Path is clear. Walk forward."

    # 2. Crowd Detection 👥
    people = [obj for obj in objects if obj['object'] == 'person']
    if len(people) >= 3:
        # Analyze crowd density
        avg_dist = np.mean([float(p['distance'].replace('m','')) for p in people])
        
        last_vibration_trigger = True
        if avg_dist < 2.0:
             return f"Crowd blocking path. Stop and wait. {len(people)} people ahead."
        else:
             return f"Heavy crowd ahead. Move slowly with the flow. {len(people)} people detected."

    # 3. Analyze Closest Object
    closest_obj = objects[0]
    label = closest_obj['object']
    clock = closest_obj.get('clock_dir', 'ahead')
    movement = closest_obj.get('move_state', 'Static')
    
    try:
        dist = float(closest_obj['distance'].replace('m',''))
    except:
        dist = 99.0

    # Tackle Advice from Interactions
    if outdoor_mode:
        # OUTDOOR FILTER: Ignore indoor clutter
        if label not in OUTDOOR_INTERACTIONS:
             pass 
        advice = OUTDOOR_INTERACTIONS.get(label, "Walk around it.")
    else:
        advice = INTERACTIONS.get(label, "Walk around it.")

    # ⚠️ MOVEMENT URGENCY
    if movement == "Approaching FAST":
        last_vibration_trigger = True
        return f"Warning! {label} approaching fast from {clock}! {advice}"

    # 3. Logic based on Range
    
    # 🔴 IMMEDIATE DANGER (< 1.2m)
    if dist < 1.2:
        last_vibration_trigger = True
        return f"Stop! {label} very close at {clock}. {advice}"

    # 🟠 NEAR OBSTACLE (1.2m - 3.0m)
    elif dist < 3.0:
        other_objects = [o for o in objects if o != closest_obj]
        summary_appendix = ""
        if other_objects:
             summary_appendix = f" I also see {generate_summary(other_objects)}."
        
        move_str = "approaching" if movement == "Approaching" else ""
        return f"{label} {move_str} at {clock}. {advice}{summary_appendix}"

    # 🟢 PATH CLEAR (> 3.0m)
    else:
        return f"Path clear. {generate_summary(objects)} is in the distance."

def check_brightness(img):
    """Returns True if too dark (<50 avg brightness)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    brightness = np.mean(hsv[:, :, 2])
    return bool(brightness < 50), float(brightness)

def generate_summary(objects):
    """Returns '2 cars, 1 person' string."""
    counts = {}
    for obj in objects:
        label = obj['object']
        counts[label] = counts.get(label, 0) + 1
    
    summary_parts = []
    for label, count in counts.items():
        summary_parts.append(f"{count} {label}{'s' if count > 1 else ''}")
    
    return ", ".join(summary_parts) if summary_parts else "No objects."

# � HOME ROUTE
# -------------------------
@app.route("/")
def home():
    return "🔥 AI Vision PRO Backend Running"


# -------------------------
# 🚦 PEDESTRIAN ROUTES
# -------------------------
@app.route("/toggle_pedestrian", methods=["POST"])
def toggle_pedestrian():
    global pedestrian_mode
    pedestrian_mode = not pedestrian_mode
    status = "ON" if pedestrian_mode else "OFF"
    return jsonify({"status": "success", "mode": status})

@app.route("/vibrate", methods=["GET"])
def vibrate_check():
    """ESP32 Polls this endpoint. Returns 1 if danger, 0 if safe."""
    global last_vibration_trigger
    # Auto-reset after read (pulse)
    response = 1 if last_vibration_trigger else 0
    return jsonify({"vibrate": response})

@app.route("/toggle_outdoor", methods=["POST"])
def toggle_outdoor():
    global outdoor_mode
    data = request.json
    outdoor_mode = data.get("state", False)
    status = "OUTDOOR" if outdoor_mode else "INDOOR"
    print(f"DEBUG: Switched to {status} MODE")
    return jsonify({"status": "success", "mode": status})


# -------------------------
# 🎯 DETECT ROUTE
# -------------------------
@app.route("/detect", methods=["POST"])
def detect():
    global last_vibration_trigger
    try:
        if "image" not in request.files:
            return jsonify({"status": "error", "message": "No image uploaded"})

        file = request.files["image"]

        # Convert image
        npimg = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"status": "error", "message": "Invalid image"})

        h, w, _ = img.shape

        results = model(img)

        detected_objects = []
        unique_set = set()
        danger_flag = False

        for result in results:
            for box in result.boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                label = class_names[cls] # 🔥 Fix: Define label before using it

                # Higher threshold for "Danger" objects to reduce false positives
                if label in ["person", "car", "truck", "bus", "motorbike"]:
                    if conf < 0.6: continue
                elif conf < 0.25: # 🔥 MAX SENSITIVITY
                    continue

                x1, y1, x2, y2 = box.xyxy[0]
                box_width = float(x2 - x1)
                x_center = float((x1 + x2) / 2)

                position = get_position(x_center, w)
                distance = get_real_distance(label, box_width)

                key = f"{label}{position}{distance}"
                if key in unique_set:
                    continue

                unique_set.add(key)

                # 🚨 Danger Check (Enhanced in Pedestrian Mode)
                priority = get_priority(label)
                if label in danger_objects:
                    danger_flag = True
                
                if pedestrian_mode and label in ["traffic light", "stop sign", "car"]:
                     danger_flag = True # Extra sensitivity
                     priority = 4 # MAX PRIORITY in pedestrian mode

                # 🧠 Advanced Navigation
                clock_dir = get_clock_direction(x_center, w)
                box_area = box_width * float(y2 - y1)
                move_state = analyze_movement(label, box_area)

                detected_objects.append({
                    "object": label,
                    "confidence": round(conf, 2),
                    "position": position,
                    "clock_dir": clock_dir, # 🕒 New
                    "move_state": move_state, # ⚠️ New
                    "distance": distance,
                    "priority": priority, 
                    "box": [int(x1), int(y1), int(x2), int(y2)]
                })

        # Sort Logic: High Priority First, then Closeness
        # Distance map for secondary sort
        # Sort Logic: High Priority First
        detected_objects.sort(key=lambda x: x['priority'], reverse=True)

        # 🪜 Stair Check
        stairs_found, step_count = detect_stairs(img)
        
        # 🧠 Generate Instruction
        voice_text = get_smart_instruction(detected_objects, stairs_found, step_count)
        
        # 💡 Real World Checks
        is_dark, brightness_val = check_brightness(img)
        scene_summary = generate_summary(detected_objects)

        if is_dark:
            voice_text = "Environment is too dark. Please turn on a light. " + voice_text

        return jsonify({
            "status": "success",
            "count": len(detected_objects),
            "detections": detected_objects,
            "voice": voice_text,
            "summary": scene_summary,
            "is_dark": is_dark,
            "stairs": {"detected": stairs_found, "steps": step_count},
            "pedestrian_mode": pedestrian_mode
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        })

# -------------------------
# 🚀 RUN SERVER
# -------------------------
if _name_ == "_main_":
    app.run(host='0.0.0.0', port=5000, debug=True)


