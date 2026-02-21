/**
 * ControlsPanel Component - UI controls and statistics
 */
import React from 'react';
import './ControlsPanel.css';

export function ControlsPanel({
  isActive,
  isProcessing,
  audioEnabled,
  performanceStats,
  onToggleCamera,
  onToggleAudio,
  onSwitchCamera
}) {
  return (
    <div className="controls-panel">
      {/* Main Controls */}
      <div className="controls-main">
        <button
          className={`control-btn ${isActive ? 'active' : ''}`}
          onClick={onToggleCamera}
          aria-label={isActive ? 'Stop Camera' : 'Start Camera'}
        >
          <span className="btn-icon">{isActive ? '⏹' : '▶'}</span>
          <span className="btn-label">{isActive ? 'Stop' : 'Start'}</span>
        </button>

        <button
          className={`control-btn ${audioEnabled ? 'active' : ''}`}
          onClick={onToggleAudio}
          disabled={!isActive}
          aria-label={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          <span className="btn-icon">{audioEnabled ? '🔊' : '🔇'}</span>
          <span className="btn-label">{audioEnabled ? 'Audio On' : 'Audio Off'}</span>
        </button>

        <button
          className="control-btn"
          onClick={onSwitchCamera}
          disabled={!isActive}
          aria-label="Switch Camera"
        >
          <span className="btn-icon">🔄</span>
          <span className="btn-label">Switch</span>
        </button>
      </div>

      {/* Status Indicators */}
      <div className="status-indicators">
        <div className={`status-item ${isActive ? 'active' : ''}`}>
          <div className="status-dot"></div>
          <span>{isActive ? 'Camera Active' : 'Camera Inactive'}</span>
        </div>

        {isProcessing && (
          <div className="status-item processing">
            <div className="status-spinner"></div>
            <span>Processing</span>
          </div>
        )}
      </div>

      {/* Performance Stats */}
      {performanceStats && isActive && (
        <div className="performance-stats">
          <div className="stat-item">
            <span className="stat-label">FPS</span>
            <span className="stat-value">{performanceStats.fps}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Detection</span>
            <span className="stat-value">{performanceStats.detectionTime}ms</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Depth</span>
            <span className="stat-value">{performanceStats.depthTime}ms</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{performanceStats.totalTime}ms</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="instructions">
        <h3>Vision Assist</h3>
        <p>AI-powered obstacle detection and navigation guidance</p>
        <ul>
          <li>Point camera forward while walking</li>
          <li>Listen for audio alerts about obstacles</li>
          <li>Green zones = clear path</li>
          <li>Red/Orange = obstacles ahead</li>
        </ul>
      </div>
    </div>
  );
}