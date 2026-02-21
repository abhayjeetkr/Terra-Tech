/**
 * Performance monitoring utilities
 */

export class PerformanceMonitor {
  constructor() {
    this.frameTimes = [];
    this.inferenceTimeDetection = [];
    this.inferenceTimeDepth = [];
    this.maxSamples = 60;
    this.lastFrameTime = performance.now();
  }

  /**
   * Record a frame
   */
  recordFrame() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  /**
   * Record detection inference time
   * @param {number} time - Time in milliseconds
   */
  recordDetection(time) {
    this.inferenceTimeDetection.push(time);
    if (this.inferenceTimeDetection.length > this.maxSamples) {
      this.inferenceTimeDetection.shift();
    }
  }

  /**
   * Record depth inference time
   * @param {number} time - Time in milliseconds
   */
  recordDepth(time) {
    this.inferenceTimeDepth.push(time);
    if (this.inferenceTimeDepth.length > this.maxSamples) {
      this.inferenceTimeDepth.shift();
    }
  }

  /**
   * Calculate average from array
   * @param {Array} arr - Array of numbers
   * @returns {number} Average value
   */
  average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Get current FPS
   * @returns {number} FPS value
   */
  getFPS() {
    const avgFrameTime = this.average(this.frameTimes);
    return avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0;
  }

  /**
   * Get average detection time
   * @returns {number} Time in milliseconds
   */
  getAvgDetectionTime() {
    return Math.round(this.average(this.inferenceTimeDetection));
  }

  /**
   * Get average depth time
   * @returns {number} Time in milliseconds
   */
  getAvgDepthTime() {
    return Math.round(this.average(this.inferenceTimeDepth));
  }

  /**
   * Get performance stats
   * @returns {Object} Performance statistics
   */
  getStats() {
    return {
      fps: this.getFPS(),
      detectionTime: this.getAvgDetectionTime(),
      depthTime: this.getAvgDepthTime(),
      totalTime: this.getAvgDetectionTime() + this.getAvgDepthTime()
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.frameTimes = [];
    this.inferenceTimeDetection = [];
    this.inferenceTimeDepth = [];
    this.lastFrameTime = performance.now();
  }
}