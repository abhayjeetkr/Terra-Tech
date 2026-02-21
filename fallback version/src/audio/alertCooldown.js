/**
 * Alert Cooldown Manager
 * Prevents audio spam by managing cooldown periods between alerts
 */

export class AlertCooldown {
  constructor() {
    this.cooldowns = new Map();
    this.defaultCooldown = 3000; // 3 seconds default
    this.urgentCooldown = 1500;  // 1.5 seconds for urgent alerts
  }

  /**
   * Check if alert can be triggered
   * @param {string} key - Alert identifier
   * @param {string} urgency - Urgency level ('low', 'medium', 'high', 'critical')
   * @returns {boolean} True if alert can be triggered
   */
  canTrigger(key, urgency = 'medium') {
    const now = Date.now();
    const lastTrigger = this.cooldowns.get(key);

    if (!lastTrigger) return true;

    const cooldownTime = urgency === 'critical' || urgency === 'high' 
      ? this.urgentCooldown 
      : this.defaultCooldown;

    return (now - lastTrigger) >= cooldownTime;
  }

  /**
   * Record that an alert was triggered
   * @param {string} key - Alert identifier
   */
  trigger(key) {
    this.cooldowns.set(key, Date.now());
  }

  /**
   * Reset cooldown for specific alert
   * @param {string} key - Alert identifier
   */
  reset(key) {
    this.cooldowns.delete(key);
  }

  /**
   * Reset all cooldowns
   */
  resetAll() {
    this.cooldowns.clear();
  }

  /**
   * Set custom cooldown duration
   * @param {number} ms - Cooldown in milliseconds
   */
  setDefaultCooldown(ms) {
    this.defaultCooldown = ms;
  }

  /**
   * Set urgent cooldown duration
   * @param {number} ms - Cooldown in milliseconds
   */
  setUrgentCooldown(ms) {
    this.urgentCooldown = ms;
  }

  /**
   * Get remaining cooldown time
   * @param {string} key - Alert identifier
   * @param {string} urgency - Urgency level
   * @returns {number} Remaining time in milliseconds (0 if ready)
   */
  getRemainingTime(key, urgency = 'medium') {
    const now = Date.now();
    const lastTrigger = this.cooldowns.get(key);

    if (!lastTrigger) return 0;

    const cooldownTime = urgency === 'critical' || urgency === 'high'
      ? this.urgentCooldown
      : this.defaultCooldown;

    const remaining = cooldownTime - (now - lastTrigger);
    return Math.max(0, remaining);
  }
}