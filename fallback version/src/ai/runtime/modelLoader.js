/**
 * Model loader and manager
 */
import { createSession } from './onnxSession.js';

export class ModelLoader {
  constructor() {
    this.detectionSession = null;
    this.depthSession = null;
    this.labels = null;
    this.loading = false;
  }

  /**
   * Load all required models
   * @returns {Promise<void>}
   */
  async loadModels() {
    if (this.loading) {
      console.log('Models already loading...');
      return;
    }

    this.loading = true;

    try {
      // Load COCO labels
      console.log('Loading COCO labels...');
      const labelsResponse = await fetch('/models/coco_labels.json');
      this.labels = await labelsResponse.json();
      console.log('Labels loaded:', this.labels.length, 'classes');

      // Load YOLOv8 detection model
      console.log('Loading YOLOv8 detection model...');
      this.detectionSession = await createSession('/models/yolov8n_web_int8.onnx');
      console.log('Detection model loaded');

      // Load MiDaS depth model
      console.log('Loading MiDaS depth model...');
      this.depthSession = await createSession('/models/midas_small.onnx');
      console.log('Depth model loaded');

      this.loading = false;
      console.log('All models loaded successfully!');
    } catch (error) {
      this.loading = false;
      console.error('Failed to load models:', error);
      throw error;
    }
  }

  /**
   * Check if models are ready
   * @returns {boolean} True if all models loaded
   */
  isReady() {
    return (
      this.detectionSession !== null &&
      this.depthSession !== null &&
      this.labels !== null
    );
  }

  /**
   * Get detection session
   * @returns {InferenceSession} Detection session
   */
  getDetectionSession() {
    if (!this.detectionSession) {
      throw new Error('Detection model not loaded');
    }
    return this.detectionSession;
  }

  /**
   * Get depth session
   * @returns {InferenceSession} Depth session
   */
  getDepthSession() {
    if (!this.depthSession) {
      throw new Error('Depth model not loaded');
    }
    return this.depthSession;
  }

  /**
   * Get labels
   * @returns {Array} COCO labels
   */
  getLabels() {
    if (!this.labels) {
      throw new Error('Labels not loaded');
    }
    return this.labels;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.detectionSession = null;
    this.depthSession = null;
    this.labels = null;
    this.loading = false;
  }
}