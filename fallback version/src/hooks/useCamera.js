/**
 * useCamera Hook - Manages camera stream
 */
import { useState, useEffect, useRef } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);

  /**
   * Start camera stream
   */
  const startCamera = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request camera access with optimal settings
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(mediaStream);
      
      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setIsLoading(false);
      console.log('Camera started successfully');
    } catch (err) {
      console.error('Camera error:', err);
      setError(err.message || 'Failed to access camera');
      setIsLoading(false);
    }
  };

  /**
   * Stop camera stream
   */
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      console.log('Camera stopped');
    }
  };

  /**
   * Switch camera (front/back)
   */
  const switchCamera = async () => {
    const currentFacingMode = stream
      ?.getVideoTracks()[0]
      ?.getSettings()
      ?.facingMode;

    const newFacingMode = currentFacingMode === 'environment' 
      ? 'user' 
      : 'environment';

    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      console.log('Camera switched to:', newFacingMode);
    } catch (err) {
      console.error('Camera switch error:', err);
      setError('Failed to switch camera');
      // Try to restart original camera
      startCamera();
    }
  };

  /**
   * Check if camera is available
   */
  const isCameraAvailable = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch {
      return false;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    videoRef,
    stream,
    error,
    isLoading,
    startCamera,
    stopCamera,
    switchCamera,
    isCameraAvailable,
    isActive: stream !== null
  };
}