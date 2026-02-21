/**
 * Frame processing utilities for video and canvas operations
 */

/**
 * Resize and preprocess video frame for model input
 * @param {HTMLVideoElement} video - Video element
 * @param {number} targetWidth - Target width for model
 * @param {number} targetHeight - Target height for model
 * @returns {Object} { tensor, canvas } - Preprocessed tensor and canvas
 */
export function preprocessFrame(video, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Draw video frame to canvas with letterboxing if needed
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData;
  
  // Convert to RGB float tensor [1, 3, height, width]
  const float32Data = new Float32Array(3 * targetWidth * targetHeight);
  
  for (let i = 0; i < targetWidth * targetHeight; i++) {
    float32Data[i] = data[i * 4] / 255.0; // R
    float32Data[targetWidth * targetHeight + i] = data[i * 4 + 1] / 255.0; // G
    float32Data[targetWidth * targetHeight * 2 + i] = data[i * 4 + 2] / 255.0; // B
  }
  
  return { float32Data, canvas };
}

/**
 * Resize frame for depth estimation
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Float32Array} Preprocessed tensor data
 */
export function preprocessDepthFrame(sourceCanvas, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData;
  
  // Normalize to [-1, 1] for MiDaS
  const float32Data = new Float32Array(3 * targetWidth * targetHeight);
  
  for (let i = 0; i < targetWidth * targetHeight; i++) {
    float32Data[i] = (data[i * 4] / 255.0 - 0.5) * 2; // R
    float32Data[targetWidth * targetHeight + i] = (data[i * 4 + 1] / 255.0 - 0.5) * 2; // G
    float32Data[targetWidth * targetHeight * 2 + i] = (data[i * 4 + 2] / 255.0 - 0.5) * 2; // B
  }
  
  return float32Data;
}

/**
 * Scale bounding boxes from model coordinates to display coordinates
 * @param {Array} detections - Array of detection objects
 * @param {number} modelWidth - Model input width
 * @param {number} modelHeight - Model input height
 * @param {number} displayWidth - Display width
 * @param {number} displayHeight - Display height
 * @returns {Array} Scaled detections
 */
export function scaleDetections(detections, modelWidth, modelHeight, displayWidth, displayHeight) {
  const scaleX = displayWidth / modelWidth;
  const scaleY = displayHeight / modelHeight;
  
  return detections.map(det => ({
    ...det,
    bbox: {
      x: det.bbox.x * scaleX,
      y: det.bbox.y * scaleY,
      width: det.bbox.width * scaleX,
      height: det.bbox.height * scaleY
    }
  }));
}

/**
 * Interpolate depth map to higher resolution
 * @param {Float32Array} depthMap - Low-res depth map
 * @param {number} srcWidth - Source width
 * @param {number} srcHeight - Source height
 * @param {number} dstWidth - Destination width
 * @param {number} dstHeight - Destination height
 * @returns {Float32Array} Interpolated depth map
 */
export function interpolateDepthMap(depthMap, srcWidth, srcHeight, dstWidth, dstHeight) {
  const result = new Float32Array(dstWidth * dstHeight);
  const scaleX = srcWidth / dstWidth;
  const scaleY = srcHeight / dstHeight;
  
  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * scaleX;
      const srcY = y * scaleY;
      
      const x0 = Math.floor(srcX);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const y0 = Math.floor(srcY);
      const y1 = Math.min(y0 + 1, srcHeight - 1);
      
      const fx = srcX - x0;
      const fy = srcY - y0;
      
      const v00 = depthMap[y0 * srcWidth + x0];
      const v10 = depthMap[y0 * srcWidth + x1];
      const v01 = depthMap[y1 * srcWidth + x0];
      const v11 = depthMap[y1 * srcWidth + x1];
      
      const v0 = v00 * (1 - fx) + v10 * fx;
      const v1 = v01 * (1 - fx) + v11 * fx;
      const value = v0 * (1 - fy) + v1 * fy;
      
      result[y * dstWidth + x] = value;
    }
  }
  
  return result;
}

/**
 * Capture current video frame as image data
 * @param {HTMLVideoElement} video - Video element
 * @returns {ImageData} Frame image data
 */
export function captureFrame(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Calculate average depth in a region
 * @param {Float32Array} depthMap - Depth map
 * @param {number} width - Depth map width
 * @param {Object} bbox - Bounding box region
 * @returns {number} Average depth value
 */
export function getRegionDepth(depthMap, width, bbox) {
  let sum = 0;
  let count = 0;
  
  const startX = Math.floor(bbox.x);
  const endX = Math.floor(bbox.x + bbox.width);
  const startY = Math.floor(bbox.y);
  const endY = Math.floor(bbox.y + bbox.height);
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = y * width + x;
      if (idx < depthMap.length) {
        sum += depthMap[idx];
        count++;
      }
    }
  }
  
  return count > 0 ? sum / count : 0.5;
}