/**
 * Distance Estimator - Fuses detection boxes with depth map
 */
import { getRegionDepth } from '../../utils/frameUtils.js';
import { estimateDistance } from '../../utils/mathUtils.js';

export class DistanceEstimator {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Estimate distances for all detections
   * @param {Array} detections - Object detections
   * @param {Float32Array} depthMap - Depth map
   * @param {number} depthWidth - Depth map width
   * @param {number} depthHeight - Depth map height
   * @param {number} displayWidth - Display width
   * @param {number} displayHeight - Display height
   * @returns {Array} Detections with distance estimates
   */
  estimateDistances(detections, depthMap, depthWidth, depthHeight, displayWidth, displayHeight) {
    return detections.map(detection => {
      // Scale bounding box to depth map coordinates
      const scaledBbox = this.scaleBboxToDepthMap(
        detection.bbox,
        displayWidth,
        displayHeight,
        depthWidth,
        depthHeight
      );

      // Get average depth in the bounding box region
      const avgDepth = getRegionDepth(depthMap, depthWidth, scaledBbox);

      // Estimate real-world distance
      const distance = estimateDistance(
        avgDepth,
        detection.bbox.height,
        displayHeight
      );

      return {
        ...detection,
        depth: avgDepth,
        distance: distance,
        distanceText: this.formatDistance(distance)
      };
    });
  }

  /**
   * Scale bounding box from display coordinates to depth map coordinates
   * @param {Object} bbox - Bounding box in display coordinates
   * @param {number} displayWidth - Display width
   * @param {number} displayHeight - Display height
   * @param {number} depthWidth - Depth map width
   * @param {number} depthHeight - Depth map height
   * @returns {Object} Scaled bounding box
   */
  scaleBboxToDepthMap(bbox, displayWidth, displayHeight, depthWidth, depthHeight) {
    const scaleX = depthWidth / displayWidth;
    const scaleY = depthHeight / displayHeight;

    return {
      x: Math.floor(bbox.x * scaleX),
      y: Math.floor(bbox.y * scaleY),
      width: Math.floor(bbox.width * scaleX),
      height: Math.floor(bbox.height * scaleY)
    };
  }

  /**
   * Format distance for display
   * @param {number} distance - Distance in meters
   * @returns {string} Formatted distance string
   */
  formatDistance(distance) {
    if (distance < 1) {
      return `${Math.round(distance * 100)} cm`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)} m`;
    } else {
      return `${Math.round(distance)} m`;
    }
  }

  /**
   * Get closest object
   * @param {Array} detections - Detections with distances
   * @returns {Object|null} Closest detection
   */
  getClosestObject(detections) {
    if (detections.length === 0) return null;

    return detections.reduce((closest, current) => {
      return current.distance < closest.distance ? current : closest;
    });
  }

  /**
   * Group objects by distance ranges
   * @param {Array} detections - Detections with distances
   * @returns {Object} Grouped detections
   */
  groupByDistance(detections) {
    return {
      immediate: detections.filter(d => d.distance < 1.5),    // < 1.5m
      near: detections.filter(d => d.distance >= 1.5 && d.distance < 3),  // 1.5-3m
      medium: detections.filter(d => d.distance >= 3 && d.distance < 5),  // 3-5m
      far: detections.filter(d => d.distance >= 5)  // > 5m
    };
  }
}