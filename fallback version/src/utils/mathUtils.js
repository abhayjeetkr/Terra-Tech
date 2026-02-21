/**
 * Math utilities for 3D space calculations and transformations
 */

/**
 * Estimate real-world distance from depth map value and bounding box
 * @param {number} depthValue - Normalized depth value (0-1, where 0 is closest)
 * @param {number} boxHeight - Height of bounding box in pixels
 * @param {number} imageHeight - Total image height in pixels
 * @returns {number} Estimated distance in meters
 */
export function estimateDistance(depthValue, boxHeight, imageHeight) {
  // Inverse depth: smaller values = closer objects
  const normalizedDepth = 1 - depthValue;
  
  // Assume average person height of 1.7m for scaling
  const assumedRealHeight = 1.7;
  const focalLength = imageHeight * 0.8; // Approximate focal length
  
  // Basic distance formula: distance = (realHeight * focalLength) / pixelHeight
  const baseDistance = (assumedRealHeight * focalLength) / Math.max(boxHeight, 1);
  
  // Combine with depth map information
  const depthFactor = 0.5 + (normalizedDepth * 10); // 0.5m to 10.5m range
  const combinedDistance = (baseDistance * 0.3 + depthFactor * 0.7);
  
  // Clamp to reasonable range
  return Math.max(0.3, Math.min(combinedDistance, 15));
}

/**
 * Calculate horizontal angle from center of frame
 * @param {number} centerX - X coordinate of object center
 * @param {number} imageWidth - Total image width
 * @returns {number} Angle in degrees (-45 to 45)
 */
export function calculateAngle(centerX, imageWidth) {
  const normalizedX = (centerX / imageWidth) - 0.5; // -0.5 to 0.5
  return normalizedX * 90; // -45 to 45 degrees
}

/**
 * Determine if object is in the navigation path
 * @param {Object} bbox - Bounding box {x, y, width, height}
 * @param {number} imageWidth - Total image width
 * @param {number} imageHeight - Total image height
 * @returns {boolean} True if object is in path
 */
export function isInPath(bbox, imageWidth, imageHeight) {
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  
  // Define path as center third of frame, bottom two-thirds vertically
  const pathLeft = imageWidth * 0.33;
  const pathRight = imageWidth * 0.67;
  const pathTop = imageHeight * 0.33;
  
  return (
    centerX >= pathLeft &&
    centerX <= pathRight &&
    centerY >= pathTop
  );
}

/**
 * Calculate priority score for obstacle (higher = more urgent)
 * @param {number} distance - Distance in meters
 * @param {boolean} inPath - Whether obstacle is in navigation path
 * @param {string} label - Object class label
 * @returns {number} Priority score (0-100)
 */
export function calculatePriority(distance, inPath, label) {
  let score = 0;
  
  // Distance factor (closer = higher priority)
  if (distance < 1) score += 50;
  else if (distance < 2) score += 30;
  else if (distance < 3) score += 15;
  else score += 5;
  
  // Path factor
  if (inPath) score += 30;
  
  // Object type factor
  const highPriorityObjects = ['person', 'car', 'truck', 'bus', 'bicycle', 'motorcycle'];
  const mediumPriorityObjects = ['chair', 'bench', 'potted plant'];
  
  if (highPriorityObjects.includes(label)) score += 20;
  else if (mediumPriorityObjects.includes(label)) score += 10;
  
  return Math.min(score, 100);
}

/**
 * Smooth values over time using exponential moving average
 * @param {number} newValue - New value to smooth
 * @param {number} oldValue - Previous smoothed value
 * @param {number} alpha - Smoothing factor (0-1, higher = less smoothing)
 * @returns {number} Smoothed value
 */
export function smoothValue(newValue, oldValue, alpha = 0.3) {
  return alpha * newValue + (1 - alpha) * oldValue;
}

/**
 * Calculate intersection over union (IoU) for two bounding boxes
 * @param {Object} box1 - First bounding box
 * @param {Object} box2 - Second bounding box
 * @returns {number} IoU value (0-1)
 */
export function calculateIoU(box1, box2) {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  
  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;
  
  return intersectionArea / (unionArea || 1);
}