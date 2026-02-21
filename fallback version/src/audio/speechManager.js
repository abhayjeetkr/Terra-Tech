/**
 * Speech Manager - Audio feedback using Web Speech API
 */
import { AlertCooldown } from './alertCooldown.js';

export class SpeechManager {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.enabled = true;
    this.volume = 1.0;
    this.rate = 1.1; // Slightly faster for urgency
    this.pitch = 1.0;
    this.cooldown = new AlertCooldown();
    this.queue = [];
    this.speaking = false;
    this.voice = null;

    // Initialize voice
    this.initVoice();
  }

  /**
   * Initialize preferred voice
   */
  initVoice() {
    const setVoice = () => {
      const voices = this.synthesis.getVoices();
      
      // Prefer English voices
      this.voice = voices.find(v => v.lang.startsWith('en-')) || voices[0];
      
      if (this.voice) {
        console.log('Speech voice initialized:', this.voice.name);
      }
    };

    // Voices load asynchronously
    if (this.synthesis.getVoices().length > 0) {
      setVoice();
    } else {
      this.synthesis.addEventListener('voiceschanged', setVoice);
    }
  }

  /**
   * Speak text with priority management
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   */
  speak(text, options = {}) {
    if (!this.enabled || !text) return;

    const {
      urgency = 'medium',
      key = text,
      interrupt = false
    } = options;

    // Check cooldown
    if (!this.cooldown.canTrigger(key, urgency)) {
      console.log('Alert on cooldown:', key);
      return;
    }

    // Interrupt current speech if critical
    if (interrupt && this.speaking) {
      this.synthesis.cancel();
    }

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.volume;
    utterance.rate = this.getRate(urgency);
    utterance.pitch = this.pitch;
    
    if (this.voice) {
      utterance.voice = this.voice;
    }

    // Set event handlers
    utterance.onstart = () => {
      this.speaking = true;
      console.log('Speaking:', text);
    };

    utterance.onend = () => {
      this.speaking = false;
      this.processQueue();
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      this.speaking = false;
      this.processQueue();
    };

    // Add to queue or speak immediately
    if (this.speaking && !interrupt) {
      this.queue.push(utterance);
    } else {
      this.synthesis.speak(utterance);
      this.cooldown.trigger(key);
    }
  }

  /**
   * Get speech rate based on urgency
   * @param {string} urgency - Urgency level
   * @returns {number} Speech rate
   */
  getRate(urgency) {
    switch (urgency) {
      case 'critical': return 1.3;
      case 'high': return 1.2;
      case 'medium': return 1.1;
      case 'low': return 1.0;
      default: return 1.1;
    }
  }

  /**
   * Process queued speech
   */
  processQueue() {
    if (this.queue.length > 0 && !this.speaking) {
      const next = this.queue.shift();
      this.synthesis.speak(next);
    }
  }

  /**
   * Announce obstacle detection
   * @param {Object} analysis - Obstacle analysis result
   */
  announceObstacles(analysis) {
    if (!analysis || !this.enabled) return;

    const { navigation, closestInPath, count } = analysis;

    // Critical alerts - stop immediately
    if (navigation.urgency === 'critical') {
      this.speak('Stop!', {
        urgency: 'critical',
        key: 'stop',
        interrupt: true
      });
      return;
    }

    // High urgency - announce obstacle
    if (navigation.urgency === 'high' && closestInPath) {
      const message = `${closestInPath.label} at ${closestInPath.distanceText}`;
      this.speak(message, {
        urgency: 'high',
        key: `obstacle-${closestInPath.label}`
      });
      return;
    }

    // Medium urgency - announce path summary
    if (navigation.urgency === 'medium' && count.inPath > 0) {
      this.speak(analysis.summary, {
        urgency: 'medium',
        key: 'path-summary'
      });
    }
  }

  /**
   * Announce specific object
   * @param {Object} detection - Detection object
   */
  announceObject(detection) {
    if (!this.enabled) return;

    const message = `${detection.label}, ${detection.distanceText}, ${detection.direction}`;
    
    this.speak(message, {
      urgency: detection.priority > 70 ? 'high' : 'medium',
      key: `object-${detection.label}-${Math.floor(detection.distance)}`
    });
  }

  /**
   * Announce navigation instruction
   * @param {string} direction - Direction to navigate
   */
  announceDirection(direction) {
    if (!this.enabled) return;

    const messages = {
      left: 'Move left',
      right: 'Move right',
      ahead: 'Continue ahead'
    };

    this.speak(messages[direction] || 'Continue', {
      urgency: 'medium',
      key: `direction-${direction}`
    });
  }

  /**
   * Announce system status
   * @param {string} message - Status message
   */
  announceStatus(message) {
    if (!this.enabled) return;

    this.speak(message, {
      urgency: 'low',
      key: 'status'
    });
  }

  /**
   * Stop all speech
   */
  stop() {
    this.synthesis.cancel();
    this.queue = [];
    this.speaking = false;
  }

  /**
   * Enable speech
   */
  enable() {
    this.enabled = true;
    this.announceStatus('Voice guidance enabled');
  }

  /**
   * Disable speech
   */
  disable() {
    this.enabled = false;
    this.stop();
  }

  /**
   * Toggle speech on/off
   * @returns {boolean} New enabled state
   */
  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.enabled;
  }

  /**
   * Set volume
   * @param {number} volume - Volume level (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Check if speech is available
   * @returns {boolean} True if speech synthesis is available
   */
  isAvailable() {
    return 'speechSynthesis' in window;
  }
}