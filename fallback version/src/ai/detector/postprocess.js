/**
 * YOLOv8 post-processing utilities
 */

/**
 * Apply Non-Maximum Suppression (NMS)
 * @param {Array} boxes - Array of detection boxes
 * @param {number} iouThreshold - IoU threshold for suppression
 * @returns {Array} Filtered boxes
 */
export function nonMaxSuppression(boxes, iouThreshold = 0.45) {
  // Sort by confidence (descending)
  boxes.sort((a, b) => b.confidence - a.confidence);
  
  const selected = [];
  const suppressed = new Set();
  
  for (let i = 0; i < boxes.length; i++) {
    if (suppressed.has(i)) continue;
    
    selected.push(boxes[i]);
    
    // Suppress overlapping boxes
    for (let j = i + 1; j < boxes.length; j++) {
      if (suppressed.has(j)) continue;
      
      const iou = calculateIoU(boxes[i].bbox, boxes[j].bbox);
      if (iou > iouThreshold) {
        suppressed.add(j);
      }
    }
  }
  
  return selected;
}

/**
 * Calculate IoU between two boxes
 * @param {Object} box1 - First box {x, y, width, height}
 * @param {Object} box2 - Second box {x, y, width, height}
 * @returns {number} IoU value
 */
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;
  
  return intersection / (union || 1);
}

/**
 * Parse YOLOv8 output tensor
 * @param {Float32Array} output - Model output [1, 84, 8400]
 * @param {Array} labels - Class labels
 * @param {number} confThreshold - Confidence threshold
 * @param {number} inputWidth - Model input width
 * @param {number} inputHeight - Model input height
 * @returns {Array} Parsed detections
 */
export function parseYOLOv8Output(output, labels, confThreshold = 0.25, inputWidth = 640, inputHeight = 640) {
  const detections = [];
  const numClasses = labels.length;
  const numDetections = 8400; // YOLOv8n produces 8400 proposals
  
  // YOLOv8 output format: [batch, 84, 8400]
  // First 4 values: [x_center, y_center, width, height]
  // Next 80 values: class scores
  
  for (let i = 0; i < numDetections; i++) {
    // Get class scores
    let maxScore = 0;
    let maxClass = 0;
    
    for (let c = 0; c < numClasses; c++) {
      const score = output[4 * numDetections + c * numDetections + i];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }
    
    // Filter by confidence threshold
    if (maxScore < confThreshold) continue;
    
    // Get box coordinates (in model coordinate space)
    const xCenter = output[i];
    const yCenter = output[numDetections + i];
    const width = output[2 * numDetections + i];
    const height = output[3 * numDetections + i];
    
    // Convert from center format to corner format
    const x = xCenter - width / 2;
    const y = yCenter - height / 2;
    
    detections.push({
      label: labels[maxClass],
      classId: maxClass,
      confidence: maxScore,
      bbox: {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, inputWidth - x),
        height: Math.min(height, inputHeight - y)
      }
    });
  }
  
  return detections;
}

/**
 * Filter detections by confidence and apply NMS
 * @param {Array} detections - Raw detections
 * @param {number} confThreshold - Confidence threshold
 * @param {number} nmsThreshold - NMS IoU threshold
 * @returns {Array} Filtered detections
 */
export function filterDetections(detections, confThreshold = 0.5, nmsThreshold = 0.45) {
  // Filter by confidence
  let filtered = detections.filter(det => det.confidence >= confThreshold);
  
  // Apply NMS
  filtered = nonMaxSuppression(filtered, nmsThreshold);
  
  return filtered;
}