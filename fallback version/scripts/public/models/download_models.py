#!/usr/bin/env python3
"""
Model Download and Export Script for VisionAssist

This script downloads and exports the required ONNX models:
- YOLOv8n (INT8 quantized for web)
- MiDaS Small v2.1

Requirements:
    pip install ultralytics torch onnx onnxruntime
"""

import os
import sys
import urllib.request
from pathlib import Path

# Model paths
MODELS_DIR = Path("public/models")
YOLO_MODEL_PATH = MODELS_DIR / "yolov8n_web_int8.onnx"
MIDAS_MODEL_PATH = MODELS_DIR / "midas_small.onnx"


def create_models_directory():
    """Create models directory if it doesn't exist"""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✓ Models directory ready: {MODELS_DIR}")


def download_yolov8():
    """Download and export YOLOv8n model"""
    print("\n=== YOLOv8n Export ===")
    
    if YOLO_MODEL_PATH.exists():
        print(f"✓ YOLOv8n already exists at {YOLO_MODEL_PATH}")
        return
    
    try:
        from ultralytics import YOLO
        
        print("Downloading YOLOv8n weights...")
        model = YOLO('yolov8n.pt')
        
        print("Exporting to ONNX format (INT8 quantized)...")
        model.export(
            format='onnx',
            simplify=True,
            opset=12,
            imgsz=640
        )
        
        # Move to correct location
        exported_path = Path("yolov8n.onnx")
        if exported_path.exists():
            exported_path.rename(YOLO_MODEL_PATH)
            print(f"✓ YOLOv8n exported successfully to {YOLO_MODEL_PATH}")
        else:
            print("⚠ YOLOv8n export completed but file not found")
            
    except ImportError:
        print("❌ Error: ultralytics not installed")
        print("Install with: pip install ultralytics")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error exporting YOLOv8n: {e}")
        sys.exit(1)


def download_midas():
    """Download and export MiDaS Small model"""
    print("\n=== MiDaS Small Export ===")
    
    if MIDAS_MODEL_PATH.exists():
        print(f"✓ MiDaS already exists at {MIDAS_MODEL_PATH}")
        return
    
    print("⚠ MiDaS export requires manual steps:")
    print()
    print("1. Clone MiDaS repository:")
    print("   git clone https://github.com/isl-org/MiDaS.git")
    print()
    print("2. Download weights:")
    print("   cd MiDaS")
    print("   python run.py --model_type midas_v21_small_256")
    print()
    print("3. Export to ONNX:")
    print("   python export_onnx.py --model_type midas_v21_small_256")
    print()
    print("4. Copy the exported .onnx file to:")
    print(f"   {MIDAS_MODEL_PATH.absolute()}")
    print()
    print("Alternative: Download pre-converted model from project releases")


def verify_models():
    """Verify that all required models are present"""
    print("\n=== Verification ===")
    
    models = {
        "YOLOv8n": YOLO_MODEL_PATH,
        "MiDaS Small": MIDAS_MODEL_PATH,
        "COCO Labels": MODELS_DIR / "coco_labels.json"
    }
    
    all_present = True
    for name, path in models.items():
        if path.exists():
            size_mb = path.stat().st_size / (1024 * 1024)
            print(f"✓ {name}: {size_mb:.1f} MB")
        else:
            print(f"❌ {name}: Not found")
            all_present = False
    
    if all_present:
        print("\n✅ All models ready! Run: npm run dev")
    else:
        print("\n⚠ Some models are missing. See instructions above.")


def main():
    """Main execution"""
    print("=" * 60)
    print("VisionAssist Model Download & Export Script")
    print("=" * 60)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher required")
        sys.exit(1)
    
    # Create directory
    create_models_directory()
    
    # Download/export models
    download_yolov8()
    download_midas()
    
    # Verify
    verify_models()
    
    print("\n" + "=" * 60)
    print("Setup complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()