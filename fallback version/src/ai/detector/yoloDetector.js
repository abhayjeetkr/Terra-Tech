/**
 * YOLOv8 Object Detector
 */
import { createTensor, runInference } from '../runtime/onnxSession.js';
import { parseYOLOv8Output, filterDetections } from './postprocess.js';
import { preprocessFrame } from '../../utils/frameUtils.js';

export class YOLODetector {
  constructor(session, labels) {
    this.session = session;
    this.labels = labels;
    this.inputWidth = 640;
    this.inputHeight = 640;
  }

  /**
   * Detect objects in video frame
   * @param {HTMLVideoElement} video - Video element
   * @param {number} confThreshold - Confidence threshold
   * @returns {Promise<Array>} Array of detections
   */
  async detect(video, confThreshold = 0.35) {
    const startTime = performance.now();
    
    try {
      // Preprocess frame
      const { float32Data } = preprocessFrame(video, this.inputWidth, this.inputHeight);
      
      // Create input tensor
      const inputTensor = createTensor(
        float32Data,
        [1, 3, this.inputHeight, this.inputWidth]
      );
      
      // Run inference
      const feeds = { images: inputTensor };
      const results = await runInference(this.session, feeds);
      
      // Get output tensor
      const outputName = this.session.outputNames[0];
      const output = results[outputName].data;
      
      // Parse detections
      let detections = parseYOLOv8Output(
        output,
        this.labels,
        confThreshold,
        this.inputWidth,
        this.inputHeight
      );
      
      // Apply additional filtering and NMS
      detections = filterDetections(detections, confThreshold, 0.45);
      
      const inferenceTime = performance.now() - startTime;
      
      return {
        detections,
        inferenceTime,
        modelWidth: this.inputWidth,
        modelHeight: this.inputHeight
      };
    } catch (error) {
      console.error('Detection error:', error);
      return {
        detections: [],
        inferenceTime: performance.now() - startTime,
        modelWidth: this.inputWidth,
        modelHeight: this.inputHeight
      };
    }
  }

  /**
   * Get input dimensions
   * @returns {Object} {width, height}
   */
  getInputDimensions() {
    return {
      width: this.inputWidth,
      height: this.inputHeight
    };
  }
}