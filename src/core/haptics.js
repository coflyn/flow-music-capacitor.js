import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { store } from "./store.js";

class HapticEngine {
  constructor() {
    this.enabled = localStorage.getItem("flow_haptics_enabled") !== "false";
    this.intensity =
      parseFloat(localStorage.getItem("flow_haptics_intensity")) || 1.0;
  }

  toggle(enabled) {
    this.enabled = enabled;
    localStorage.setItem("flow_haptics_enabled", enabled);
  }

  setIntensity(value) {
    this.intensity = Math.max(0.1, Math.min(1.0, value));
    localStorage.setItem("flow_haptics_intensity", this.intensity.toString());
  }

  async impact(style = ImpactStyle.Light) {
    if (!this.enabled || this.intensity < 0.2) return;
    try {
      // For simplicity on web/native, we'll map intensity to style if not using raw vibrate
      // On some platforms, raw vibrate(ms) works better for intensity control
      await Haptics.impact({ style });
    } catch (e) {}
  }

  async selection() {
    if (!this.enabled) return;
    try {
      await Haptics.selectionStart();
      await Haptics.selectionEnd();
    } catch (e) {}
  }

  async vibrate() {
    if (!this.enabled) return;
    try {
      await Haptics.vibrate();
    } catch (e) {}
  }

  /**
   * Short tactile pulse for button clicks
   */
  light() {
    this.impact(ImpactStyle.Light);
  }

  /**
   * Medium tactile pulse for toggle switches or success
   */
  medium() {
    this.impact(ImpactStyle.Medium);
  }
}

export const haptics = new HapticEngine();
