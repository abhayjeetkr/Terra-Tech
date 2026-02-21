/**
 * OverlayCanvas Component - Renders detection overlays
 */
import React, { useEffect, useRef } from 'react';
import './OverlayCanvas.css';

export function OverlayCanvas({ analysis, dimensions, showDepth }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!analysis) return;

    // Draw path zone indicator
    drawPathZone(ctx, width, height);

    // Draw detections
    analysis.detections.forEach(detection => {
      drawDetection(ctx, detection, width, height);
    });

    // Draw status overlay
    drawStatusOverlay(ctx, analysis, width, height);

  }, [analysis, dimensions, showDepth]);

  return (
    <canvas
      ref={canvasRef}
      className="overlay-canvas"
    />
  );
}

/**
 * Draw path zone indicator
 */
function drawPathZone(ctx, width, height) {
  const pathLeft = width * 0.33;
  const pathRight = width * 0.67;
  const pathTop = height * 0.33;

  // Draw subtle path indicator
  ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  
  ctx.beginPath();
  ctx.moveTo(pathLeft, pathTop);
  ctx.lineTo(pathLeft, height);
  ctx.moveTo(pathRight, pathTop);
  ctx.lineTo(pathRight, height);
  ctx.stroke();
  
  ctx.setLineDash([]);
}

/**
 * Draw single detection box
 */
function drawDetection(ctx, detection, width, height) {
  const { bbox, label, distance, confidence, inPath, priority } = detection;

  // Choose color based on distance and path
  let color;
  if (distance < 1.5) {
    color = inPath ? '#ff3366' : '#ff6699'; // Critical red
  } else if (distance < 3) {
    color = inPath ? '#ffaa00' : '#ffcc66'; // Warning orange
  } else {
    color = inPath ? '#00ddff' : '#66eeff'; // Info cyan
  }

  const alpha = inPath ? 0.8 : 0.5;

  // Draw bounding box
  ctx.strokeStyle = color;
  ctx.lineWidth = inPath ? 3 : 2;
  ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

  // Draw filled corner indicators for in-path objects
  if (inPath) {
    const cornerSize = 12;
    ctx.fillStyle = color;
    
    // Top-left corner
    ctx.fillRect(bbox.x, bbox.y, cornerSize, 3);
    ctx.fillRect(bbox.x, bbox.y, 3, cornerSize);
    
    // Top-right corner
    ctx.fillRect(bbox.x + bbox.width - cornerSize, bbox.y, cornerSize, 3);
    ctx.fillRect(bbox.x + bbox.width - 3, bbox.y, 3, cornerSize);
  }

  // Draw label background
  const labelText = `${label} ${distance.toFixed(1)}m`;
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  const textMetrics = ctx.measureText(labelText);
  const textWidth = textMetrics.width;
  const textHeight = 20;
  const padding = 8;

  const labelX = bbox.x;
  const labelY = bbox.y - textHeight - padding - 4;

  // Draw label box
  ctx.fillStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
  ctx.fillRect(labelX, labelY, textWidth + padding * 2, textHeight + padding);

  // Draw label text
  ctx.fillStyle = '#0a0e27';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, labelX + padding, labelY + (textHeight + padding) / 2);

  // Draw priority indicator for high-priority objects
  if (priority > 70) {
    const pulseSize = 8;
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseSize + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Draw status overlay
 */
function drawStatusOverlay(ctx, analysis, width, height) {
  const { navigation, count, summary } = analysis;

  // Draw status bar at top
  const statusHeight = 60;
  const gradient = ctx.createLinearGradient(0, 0, 0, statusHeight);
  gradient.addColorStop(0, 'rgba(10, 14, 39, 0.95)');
  gradient.addColorStop(1, 'rgba(10, 14, 39, 0.7)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, statusHeight);

  // Draw urgency indicator
  let urgencyColor;
  switch (navigation.urgency) {
    case 'critical': urgencyColor = '#ff3366'; break;
    case 'high': urgencyColor = '#ffaa00'; break;
    case 'medium': urgencyColor = '#00ddff'; break;
    default: urgencyColor = '#00ff99';
  }

  // Urgency pulse
  const pulseSize = 12;
  ctx.fillStyle = urgencyColor;
  ctx.beginPath();
  ctx.arc(24, statusHeight / 2, pulseSize, 0, Math.PI * 2);
  ctx.fill();

  // Status text
  ctx.font = 'bold 18px "IBM Plex Sans"';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(summary, 50, statusHeight / 2);

  // Object count
  ctx.font = '14px "IBM Plex Sans"';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const countText = `${count.total} objects • ${count.inPath} in path`;
  const countWidth = ctx.measureText(countText).width;
  ctx.fillText(countText, width - countWidth - 20, statusHeight / 2);
}