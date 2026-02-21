/**
 * Main App Component - Vision Assist Application
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView } from './components/CameraView';
import { OverlayCanvas } from './components/OverlayCanvas';
import { ControlsPanel } from './components/ControlsPanel';
import { useCamera } from './hooks/useCamera';
import { ModelLoader } from './ai/runtime/modelLoader';
import { YOLODetector } from './ai/detector/yoloDetector';
import { DepthEstimator } from './ai/depth/depthEstimator';
import { ObstacleAnalyzer } from './ai/fusion/obstacleAnalyzer';
import { SpeechManager } from './audio/speechManager';
import { PerformanceMonitor } from './utils/performanceMonitor';
import { scaleDetections } from './utils/frameUtils';
import './App.css';

function App() {
  // Camera hook
  const {
    videoRef,
    stream,
    error: cameraError,
    isLoading,
    startCamera,
    stopCamera,
    switchCamera,
    isActive
  } = useCamera();

  // State
  const [modelsReady, setModelsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [performanceStats, setPerformanceStats] = useState(null);
  const [showDepth, setShowDepth] = useState(false);

  // Refs for AI system
  const modelLoaderRef = useRef(null);
  const detectorRef = useRef(null);
  const depthEstimatorRef = useRef(null);
  const analyzerRef = useRef(null);
  const speechManagerRef = useRef(null);
  const performanceMonitorRef = useRef(null);
  const processingRef = useRef(false);
  const animationFrameRef = useRef(null);
  const initializedRef = useRef(false);

  /**
   * Initialize AI models
   */
  useEffect(() => {
  if (initializedRef.current) return;
  initializedRef.current = true;

  const initModels = async () => {
      try {
        console.log('Initializing AI models...');
        
        // Create instances
        modelLoaderRef.current = new ModelLoader();
        performanceMonitorRef.current = new PerformanceMonitor();
        speechManagerRef.current = new SpeechManager();
        analyzerRef.current = new ObstacleAnalyzer();

        // Load models
        await modelLoaderRef.current.loadModels();

        // Create detector and depth estimator
        detectorRef.current = new YOLODetector(
          modelLoaderRef.current.getDetectionSession(),
          modelLoaderRef.current.getLabels()
        );

        depthEstimatorRef.current = new DepthEstimator(
          modelLoaderRef.current.getDepthSession()
        );

        setModelsReady(true);
        console.log('AI models ready!');

        // Announce readiness
        if (speechManagerRef.current) {
          speechManagerRef.current.announceStatus('Vision Assist ready');
        }
      } catch (error) {
        console.error('Failed to initialize models:', error);
        alert('Failed to load AI models. Please refresh the page.');
      }
    };

    initModels();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  /**
   * Update dimensions when video is ready
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const updateDimensions = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setDimensions({
          width: video.videoWidth,
          height: video.videoHeight
        });
      }
    };

    video.addEventListener('loadedmetadata', updateDimensions);
    updateDimensions();

    return () => {
      video.removeEventListener('loadedmetadata', updateDimensions);
    };
  }, [videoRef, isActive]);

  /**
   * Main processing loop
   */
  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    
    if (
      !video ||
      !isActive ||
      !modelsReady ||
      processingRef.current ||
      video.readyState !== video.HAVE_ENOUGH_DATA
    ) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      performanceMonitorRef.current.recordFrame();

      // Run object detection
      const detectionResult = await detectorRef.current.detect(video, 0.35);
      performanceMonitorRef.current.recordDetection(detectionResult.inferenceTime);

      // Run depth estimation
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const depthResult = await depthEstimatorRef.current.estimateDepth(canvas);
      performanceMonitorRef.current.recordDepth(depthResult.inferenceTime);

      // Scale detections to display size
      const scaledDetections = scaleDetections(
        detectionResult.detections,
        detectionResult.modelWidth,
        detectionResult.modelHeight,
        video.videoWidth,
        video.videoHeight
      );

      // Analyze obstacles
      const obstacleAnalysis = analyzerRef.current.analyze(
        scaledDetections,
        depthResult.depthMap,
        depthResult.width,
        depthResult.height,
        video.videoWidth,
        video.videoHeight
      );

      setAnalysis(obstacleAnalysis);

      // Audio feedback
      if (audioEnabled && speechManagerRef.current) {
        // Only announce if significant change detected
        if (analyzerRef.current.hasSignificantChange()) {
          speechManagerRef.current.announceObstacles(obstacleAnalysis);
        }
      }

      // Update performance stats
      setPerformanceStats(performanceMonitorRef.current.getStats());

    } catch (error) {
      console.error('Processing error:', error);
    }

    processingRef.current = false;
    setIsProcessing(false);

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, isActive, modelsReady, audioEnabled]);

  /**
   * Start/stop processing loop
   */
  useEffect(() => {
    if (isActive && modelsReady) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, modelsReady, processFrame]);

  /**
   * Toggle camera
   */
  const handleToggleCamera = () => {
    if (isActive) {
      stopCamera();
      setAnalysis(null);
      setDimensions(null);
    } else {
      startCamera();
    }
  };

  /**
   * Toggle audio
   */
  const handleToggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    
    if (speechManagerRef.current) {
      if (newState) {
        speechManagerRef.current.enable();
      } else {
        speechManagerRef.current.disable();
      }
    }
  };

  /**
   * Switch camera
   */
  const handleSwitchCamera = () => {
    switchCamera();
  };

  return (
    <div className="app">
      {/* Loading overlay */}
      {!modelsReady && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2>Loading AI Models...</h2>
            <p>This may take a moment</p>
          </div>
        </div>
      )}

      {/* Camera view */}
      <CameraView
        videoRef={videoRef}
        isActive={isActive}
        error={cameraError}
      />

      {/* Detection overlay */}
      {isActive && dimensions && (
        <OverlayCanvas
          analysis={analysis}
          dimensions={dimensions}
          showDepth={showDepth}
        />
      )}

      {/* Controls */}
      <ControlsPanel
        isActive={isActive}
        isProcessing={isProcessing}
        audioEnabled={audioEnabled}
        performanceStats={performanceStats}
        onToggleCamera={handleToggleCamera}
        onToggleAudio={handleToggleAudio}
        onSwitchCamera={handleSwitchCamera}
      />
    </div>
  );
}

export default App;