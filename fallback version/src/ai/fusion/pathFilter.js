/**
 * Path Filter - Identifies objects in the navigation path
 */
import { isInPath, calculateAngle } from '../../utils/mathUtils.js';

export class PathFilter {
  constructor() {
    this.pathWidth = 0.33; // Center third of frame
  }

  /**
   * Filter and analyze objects in the navigation path
   * @param {Array} detections - Detections with distances
   * @param {number} displayWidth - Display width
   * @param {number} displayHeight - Display height
   * @returns {Object} Path analysis results
   */
  analyzePath(detections, displayWidth, displayHeight) {
    // Classify each detection
    const analyzed = detections.map(detection => {
      const inPath = isInPath(detection.bbox, displayWidth, displayHeight);
      const centerX = detection.bbox.x + detection.bbox.width / 2;
      const angle = calculateAngle(centerX, displayWidth);
      const zone = this.getZone(centerX, displayWidth);

      return {
        ...detection,
        inPath,
        angle,
        zone,
        direction: this.getDirection(angle)
      };
    });

    // Separate path obstacles from others
    const pathObstacles = analyzed.filter(d => d.inPath);
    const sideObjects = analyzed.filter(d => !d.inPath);

    // Sort path obstacles by distance (closest first)
    pathObstacles.sort((a, b) => a.distance - b.distance);

    return {
      all: analyzed,
      pathObstacles,
      sideObjects,
      hasObstacles: pathObstacles.length > 0,
      closestInPath: pathObstacles.length > 0 ? pathObstacles[0] : null,
      summary: this.createSummary(pathObstacles, sideObjects)
    };
  }

  /**
   * Determine which zone an object is in
   * @param {number} centerX - X coordinate of object center
   * @param {number} width - Frame width
   * @returns {string} Zone identifier
   */
  getZone(centerX, width) {
    const normalized = centerX / width;
    if (normalized < 0.33) return 'left';
    if (normalized < 0.67) return 'center';
    return 'right';
  }

  /**
   * Get direction description from angle
   * @param {number} angle - Angle in degrees
   * @returns {string} Direction description
   */
  getDirection(angle) {
    if (angle < -20) return 'left';
    if (angle > 20) return 'right';
    return 'ahead';
  }

  /**
   * Create text summary of path analysis
   * @param {Array} pathObstacles - Obstacles in path
   * @param {Array} sideObjects - Objects on sides
   * @returns {string} Summary text
   */
  createSummary(pathObstacles, sideObjects) {
    if (pathObstacles.length === 0) {
      if (sideObjects.length === 0) {
        return 'Path clear';
      }
      return `Path clear. ${sideObjects.length} object${sideObjects.length > 1 ? 's' : ''} nearby`;
    }

    const closest = pathObstacles[0];
    const others = pathObstacles.length - 1;

    let summary = `${closest.label} ahead, ${closest.distanceText}`;
    if (others > 0) {
      summary += ` (+${others} more)`;
    }

    return summary;
  }

  /**
   * Get navigation instructions
   * @param {Object} pathAnalysis - Path analysis result
   * @returns {Object} Navigation instructions
   */
  getNavigationInstructions(pathAnalysis) {
    if (!pathAnalysis.hasObstacles) {
      return {
        action: 'continue',
        message: 'Path is clear',
        urgency: 'low'
      };
    }

    const closest = pathAnalysis.closestInPath;
    
    if (closest.distance < 1.5) {
      // Immediate obstacle - stop
      return {
        action: 'stop',
        message: `Stop! ${closest.label} very close at ${closest.distanceText}`,
        urgency: 'critical'
      };
    } else if (closest.distance < 3) {
      // Near obstacle - slow down
      const direction = closest.zone === 'center' 
        ? 'Obstacle ahead'
        : `${closest.label} on ${closest.zone}`;
      
      return {
        action: 'slow',
        message: `${direction}, ${closest.distanceText}`,
        urgency: 'high'
      };
    } else {
      // Medium distance - caution
      return {
        action: 'caution',
        message: `${closest.label} ahead, ${closest.distanceText}`,
        urgency: 'medium'
      };
    }
  }

  /**
   * Find safest direction to navigate
   * @param {Array} detections - All detections with path analysis
   * @param {number} displayWidth - Display width
   * @returns {string} Suggested direction ('left', 'right', 'ahead')
   */
  findSafestDirection(detections, displayWidth) {
    // Count obstacles in each zone
    const zones = {
      left: detections.filter(d => d.zone === 'left' && d.distance < 3),
      center: detections.filter(d => d.zone === 'center' && d.distance < 3),
      right: detections.filter(d => d.zone === 'right' && d.distance < 3)
    };

    // Find zone with fewest close obstacles
    const zoneCounts = {
      left: zones.left.length,
      center: zones.center.length,
      right: zones.right.length
    };

    // Return safest zone
    if (zoneCounts.center === 0) return 'ahead';
    if (zoneCounts.left < zoneCounts.center && zoneCounts.left < zoneCounts.right) return 'left';
    if (zoneCounts.right < zoneCounts.center && zoneCounts.right <= zoneCounts.left) return 'right';
    return 'ahead';
  }
}