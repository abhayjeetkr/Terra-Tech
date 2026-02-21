/**
 * CameraView Component - Displays camera feed
 */
import React, { useEffect } from 'react';
import './CameraView.css';

export function CameraView({ videoRef, isActive, error }) {
  useEffect(() => {
    // Auto-play video when stream is active
    if (videoRef.current && isActive) {
      videoRef.current.play().catch(err => {
        console.error('Video play error:', err);
      });
    }
  }, [isActive, videoRef]);

  return (
    <div className="camera-view">
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        playsInline
        muted
      />
      
      {error && (
        <div className="camera-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <div className="error-hint">
            Please grant camera permissions and refresh
          </div>
        </div>
      )}
      
      {!isActive && !error && (
        <div className="camera-placeholder">
          <div className="placeholder-icon">📷</div>
          <div className="placeholder-text">Camera Inactive</div>
        </div>
      )}
    </div>
  );
}