/**
 * Obstacle Analyzer - Main fusion component
 */
import { DistanceEstimator } from './distanceEstimator.js';
import { PathFilter } from './pathFilter.js';
import { calculatePriority } from '../../utils/mathUtils.js';

export class ObstacleAnalyzer {
  constructor() {
    this.distanceEstimator = new DistanceEstimator();
    this.pathFilter = new PathFilter();
    this.history = [];
    this.maxHistory = 5;
  }

  /**
   * Analyze obstacles by fusing detection and depth data
   * @param {Array} detections - Object detections
   * @param {Float32Array} depthMap - Depth map
   * @param {number} depthWidth - Depth map width
   * @param {number} depthHeight - Depth map height
   * @param {number} displayWidth - Display width
   * @param {number} displayHeight - Display height
   * @returns {Object} Complete obstacle analysis
   */
  analyze(detections, depthMap, depthWidth, depthHeight, displayWidth, displayHeight) {
    // Step 1: Estimate distances for all detections
    const detectionsWithDistance = this.distanceEstimator.estimateDistances(
      detections,
      depthMap,
      depthWidth,
      depthHeight,
      displayWidth,
      displayHeight
    );

    // Step 2: Analyze path and zones
    const pathAnalysis = this.pathFilter.analyzePath(
      detectionsWithDistance,
      displayWidth,
      displayHeight
    );

    // Step 3: Calculate priorities
    const prioritized = this.calculatePriorities(pathAnalysis.all, displayWidth, displayHeight);

    // Step 4: Get navigation instructions
    const navigation = this.pathFilter.getNavigationInstructions(pathAnalysis);

    // Step 5: Find safest direction
    const safestDirection = this.pathFilter.findSafestDirection(
      pathAnalysis.all,
      displayWidth
    );

    // Step 6: Group by distance
    const grouped = this.distanceEstimator.groupByDistance(prioritized);

    // Compile complete analysis
    const analysis = {
      detections: prioritized,
      pathObstacles: pathAnalysis.pathObstacles,
      sideObjects: pathAnalysis.sideObjects,
      closest: this.distanceEstimator.getClosestObject(prioritized),
      closestInPath: pathAnalysis.closestInPath,
      grouped,
      navigation,
      safestDirection,
      summary: pathAnalysis.summary,
      count: {
        total: detections.length,
        inPath: pathAnalysis.pathObstacles.length,
        immediate: grouped.immediate.length,
        near: grouped.near.length
      }
    };

    // Update history
    this.updateHistory(analysis);

    return analysis;
  }

  /**
   * Calculate priority scores for all detections
   * @param {Array} detections - Detections with distance and path info
   * @param {number} displayWidth - Display width
   * @param {number} displayHeight - Display height
   * @returns {Array} Detections with priority scores
   */
  calculatePriorities(detections, displayWidth, displayHeight) {
    return detections.map(detection => ({
      ...detection,
      priority: calculatePriority(
        detection.distance,
        detection.inPath,
        detection.label
      )
    })).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update analysis history for temporal smoothing
   * @param {Object} analysis - Current analysis
   */
  updateHistory(analysis) {
    this.history.push(analysis);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get averaged analysis over recent history
   * @returns {Object} Smoothed analysis
   */
  getSmoothedAnalysis() {
    if (this.history.length === 0) return null;
    
    // Return most recent for now (can implement temporal smoothing)
    return this.history[this.history.length - 1];
  }

  /**
   * Check if situation has changed significantly
   * @returns {boolean} True if change detected
   */
  hasSignificantChange() {
    if (this.history.length < 2) return true;

    const current = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];

    // Check for new obstacles in path
    if (current.count.inPath > previous.count.inPath) return true;

    // Check for significant distance change to closest obstacle
    if (current.closestInPath && previous.closestInPath) {
      const distChange = Math.abs(
        current.closestInPath.distance - previous.closestInPath.distance
      );
      if (distChange > 0.5) return true;
    }

    // Check for urgency level change
    if (current.navigation.urgency !== previous.navigation.urgency) return true;

    return false;
  }

  /**
   * Reset history
   */
  reset() {
    this.history = [];
  }

  /**
   * Get statistics about recent detections
   * @returns {Object} Detection statistics
   */
  getStatistics() {
    if (this.history.length === 0) {
      return {
        avgDetections: 0,
        avgPathObstacles: 0,
        mostCommonObject: null
      };
    }

    const totalDetections = this.history.reduce((sum, h) => sum + h.count.total, 0);
    const totalPath = this.history.reduce((sum, h) => sum + h.count.inPath, 0);

    // Count object types
    const objectCounts = {};
    this.history.forEach(h => {
      h.detections.forEach(d => {
        objectCounts[d.label] = (objectCounts[d.label] || 0) + 1;
      });
    });

    const mostCommon = Object.entries(objectCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      avgDetections: totalDetections / this.history.length,
      avgPathObstacles: totalPath / this.history.length,
      mostCommonObject: mostCommon ? mostCommon[0] : null
    };
  }
}