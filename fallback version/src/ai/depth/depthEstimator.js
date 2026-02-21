/**
 * MiDaS Depth Estimator
 */
import { createTensor, runInference } from '../runtime/onnxSession.js';
import { preprocessDepthFrame } from '../../utils/frameUtils.js';

export class DepthEstimator {
  constructor(session) {
    this.session = session;
    this.inputWidth = 256;
    this.inputHeight = 256;
  }

  /**
   * Estimate depth from video frame
   * @param {HTMLCanvasElement} canvas - Canvas with video frame
   * @returns {Promise<Object>} Depth map data
   */
  async estimateDepth(canvas) {
    const startTime = performance.now();
    
    try {
      // Preprocess frame for depth estimation
      const float32Data = preprocessDepthFrame(canvas, this.inputWidth, this.inputHeight);
      
      // Create input tensor
      const inputTensor = createTensor(
        float32Data,
        [1, 3, this.inputHeight, this.inputWidth]
      );
      
      // Run inference
      const feeds = { input: inputTensor };
      const results = await runInference(this.session, feeds);
      
      // Get output
      const outputName = this.session.outputNames[0];
      const depthOutput = results[outputName].data;
      
      // Normalize depth values to 0-1 range
      const normalizedDepth = this.normalizeDepth(depthOutput);
      
      const inferenceTime = performance.now() - startTime;
      
      return {
        depthMap: normalizedDepth,
        width: this.inputWidth,
        height: this.inputHeight,
        inferenceTime
      };
    } catch (error) {
      console.error('Depth estimation error:', error);
      return {
        depthMap: new Float32Array(this.inputWidth * this.inputHeight).fill(0.5),
        width: this.inputWidth,
        height: this.inputHeight,
        inferenceTime: performance.now() - startTime
      };
    }
  }

  /**
   * Normalize depth values to 0-1 range
   * @param {Float32Array} depthData - Raw depth data
   * @returns {Float32Array} Normalized depth map
   */
  normalizeDepth(depthData) {
    const normalized = new Float32Array(depthData.length);
    
    // Find min and max
    let min = Infinity;
    let max = -Infinity;
    
    for (let i = 0; i < depthData.length; i++) {
      const value = depthData[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    
    // Normalize to 0-1
    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < depthData.length; i++) {
        normalized[i] = (depthData[i] - min) / range;
      }
    } else {
      normalized.fill(0.5);
    }
    
    return normalized;
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