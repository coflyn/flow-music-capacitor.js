import { icons } from "../core/icons.js";
import { store } from "../core/store.js";
import { audioEngine } from "../core/audioEngine.js";
import { musicLibrary } from "../core/library.js";
import { haptics } from "../core/haptics.js";
import { createElement } from "../core/utils.js";

/**
 * Renders the polished Settings page with premium aesthetics.
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  container.innerHTML = "";
  const page = createElement("div", "page animate-in");

  page.innerHTML = `
    <header class="settings-page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Configure your perfect listening environment.</p>
    </header>

    <div class="settings-scroll-view">
      
      <!-- AUDIO ENGINE SECTION -->
      <section class="settings-card-group">
        <h3 class="group-title">Audio & Sound</h3>
        
        <div class="premium-card clickable" id="open-eq-btn-container">
          <div class="card-icon-box eq-icon">${icons.equalizer}</div>
          <div class="card-content">
            <span class="card-label">Equalizer</span>
            <span class="card-hint">Fine-tune frequencies and presets</span>
          </div>
          <div class="card-arrow">${icons.chevronRight}</div>
        </div>

        <div class="premium-card">
          <div class="card-header-row">
            <div class="card-label-box">
              <div class="card-icon-box small crossfade-icon">${icons.shuffle}</div>
              <span class="card-label">Crossfade</span>
            </div>
            <span class="card-value" id="crossfade-value">Off</span>
          </div>
          <div class="slider-container">
            <input type="range" id="crossfade-slider" min="0" max="12" step="0.5" value="${audioEngine.crossfadeDuration}" class="premium-range">
            <div class="slider-marks">
              <span>Off</span>
              <span>6s</span>
              <span>12s</span>
            </div>
          </div>
        </div>
      </section>

      <!-- PLAYBACK BEHAVIOR SECTION -->
      <section class="settings-card-group">
        <h3 class="group-title">Playback Behavior</h3>
        
        <div class="premium-card item-row">
          <div class="card-content">
            <span class="card-label">Pause on Disconnect</span>
            <span class="card-hint">Auto-stop when headphones unplug</span>
          </div>
          <div class="premium-toggle ${audioEngine.pauseOnDisconnect ? "active" : ""}" id="pause-disconnect-toggle">
            <div class="toggle-thumb"></div>
          </div>
        </div>

        <div class="premium-card item-row">
          <div class="card-content">
            <span class="card-label">Resume on Connect</span>
            <span class="card-hint">Auto-play when headphones link</span>
          </div>
          <div class="premium-toggle ${audioEngine.playOnConnect ? "active" : ""}" id="play-connect-toggle">
            <div class="toggle-thumb"></div>
          </div>
        </div>
      </section>

      <!-- LIBRARY & SCANNING -->
      <section class="settings-card-group">
        <h3 class="group-title">Library Intelligence</h3>

        <div class="premium-card item-row">
          <div class="card-content">
            <span class="card-label">Avoid Short Tracks</span>
            <span class="card-hint">Hide ringtones and voice notes</span>
          </div>
          <div class="premium-toggle ${audioEngine.avoidShortTracks ? "active" : ""}" id="avoid-short-toggle">
            <div class="toggle-thumb"></div>
          </div>
        </div>

        <div class="premium-card duration-sub-card" id="min-duration-container" style="display: ${audioEngine.avoidShortTracks ? "block" : "none"};">
          <div class="card-header-row">
            <span class="card-label small">Minimum Duration</span>
            <span class="card-value accent" id="min-duration-value">${audioEngine.minTrackDuration}s</span>
          </div>
          <input type="range" id="min-duration-slider" min="5" max="120" step="5" value="${audioEngine.minTrackDuration}" class="premium-range">
        </div>

        <div class="premium-card item-row">
          <div class="card-content">
            <span class="card-label">Background Auto-scan</span>
            <span class="card-hint">Update library on startup</span>
          </div>
          <div class="premium-toggle ${musicLibrary.autoScan ? "active" : ""}" id="autoscan-toggle">
            <div class="toggle-thumb"></div>
          </div>
        </div>
      </section>

      <!-- HAPTICS SECTION -->
      <section class="settings-card-group">
        <h3 class="group-title">Feel & Response</h3>
        <div class="premium-card">
          <div class="card-header-row">
            <div class="card-content">
              <span class="card-label">Haptic Feedback</span>
              <span class="card-hint">Tactile response on click</span>
            </div>
            <div class="premium-toggle ${haptics.enabled ? "active" : ""}" id="haptic-toggle">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          
          <div id="haptic-intensity-container" class="intensity-slider-box" style="display: ${haptics.enabled ? "flex" : "none"};">
            <span class="intensity-label">Strength</span>
            <input type="range" id="haptic-intensity-slider" min="0.2" max="1.0" step="0.1" value="${haptics.intensity}" class="premium-range">
          </div>
        </div>
      </section>

      <!-- DIRECTORIES SECTION -->
      <section class="settings-card-group">
        <h3 class="group-title">Music Sources</h3>
        <div id="folder-list-container" class="folder-grid"></div>
        <button class="add-folder-btn-premium" id="add-folder-btn">
          ${icons.add} <span>Add Music Directory</span>
        </button>
      </section>

      <!-- UTILITIES SECTION -->
      <section class="settings-card-group">
        <h3 class="group-title">Utilities</h3>

        <div class="premium-card timer-card">
          <div class="card-header-row">
            <div class="card-content">
              <span class="card-label">Sleep Timer</span>
              <span class="card-hint">Slow fade & stop playback</span>
            </div>
            <span class="card-value timer-status" id="sleep-timer-value">Deactivated</span>
          </div>
          <div class="timer-presets">
            <button class="timer-chip" data-min="0">Off</button>
            <button class="timer-chip" data-min="15">15m</button>
            <button class="timer-chip" data-min="30">30m</button>
            <button class="timer-chip" data-min="60">1h</button>
            <button class="timer-chip custom" id="custom-timer-btn">Custom</button>
          </div>
        </div>
      </section>

      <!-- SYSTEM & DATA -->
      <section class="settings-card-group">
        <h3 class="group-title">Advanced Maintenance</h3>
        
        <div class="maintenance-row">
          <div class="action-card clickable" id="rescan-btn">
             <div class="action-icon">${icons.refresh}</div>
             <span class="action-label">Smart Rescan</span>
          </div>

          <div class="action-card clickable" id="clear-cache-btn">
             <div class="action-icon danger">${icons.close}</div>
             <span class="action-label">Clear Cache</span>
          </div>
        </div>
      </section>

      <!-- APP INFO -->
      <footer class="settings-footer">
        <div class="footer-logo">FLOW</div>
        <div class="version-tag">Version 1.0.0-Gold</div>
        <div class="crafted-tag">Crafted for Audio Purists</div>
      </footer>

    </div>

    <style>
      :root {
        --premium-glass: rgba(255, 255, 255, 0.03);
        --premium-border: rgba(255, 255, 255, 0.08);
        --premium-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      }

      .settings-scroll-view {
        height: 100%;
        overflow-y: auto;
        padding-bottom: 120px;
        scroll-behavior: smooth;
        /* Global scrollbar serves this now */
      }

      .settings-page-header {
        margin-bottom: var(--sp-8);
        padding: 0 var(--sp-2);
      }
      .page-subtitle {
        color: var(--text-tertiary);
        font-size: var(--fs-xs);
        margin-top: 4px;
        font-weight: 500;
      }

      /* Intensity Slider refinement */
      .intensity-slider-box {
        margin-top: 15px;
        align-items: center;
        gap: 12px;
        background: rgba(0,0,0,0.15);
        padding: 14px 18px;
        border-radius: var(--radius-xl);
        border: 1px solid var(--premium-border);
      }
      .intensity-label {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text-tertiary);
        min-width: 60px;
      }

      .settings-card-group {
        margin-bottom: var(--sp-10);
      }
      .group-title {
        font-size: 10px;
        font-weight: 800;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        margin-bottom: var(--sp-4);
        padding-left: var(--sp-1);
        opacity: 0.8;
      }

      /* Premium Card Base */
      .premium-card {
        background: var(--premium-glass);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--premium-border);
        border-radius: var(--radius-2xl);
        padding: 20px;
        margin-bottom: var(--sp-3);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--premium-shadow);
      }
      .premium-card.clickable:active {
        transform: scale(0.97);
        background: rgba(255, 255, 255, 0.06);
      }
      .premium-card.item-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      /* Card Content */
      .card-label {
        display: block;
        font-weight: 700;
        font-size: var(--fs-sm);
        color: var(--text-primary);
      }
      .card-label.small {
        font-size: var(--fs-xs);
        opacity: 0.7;
      }
      .card-hint {
        display: block;
        font-size: 11px;
        color: var(--text-tertiary);
        margin-top: 2px;
      }
      .card-icon-box {
        width: 36px;
        height: 36px;
        background: rgba(var(--accent-rgb), 0.1);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent);
        margin-right: var(--sp-4);
      }
      .card-icon-box.small {
        width: 24px;
        height: 24px;
        border-radius: 8px;
        margin-right: 10px;
        transform: scale(0.8);
      }
      .card-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--sp-2);
      }
      .card-label-box {
        display: flex;
        align-items: center;
      }
      .card-value {
        font-size: var(--fs-xs);
        font-weight: 800;
        color: var(--text-tertiary);
      }
      .card-value.accent {
        color: var(--accent);
      }
      .card-arrow {
        color: var(--text-tertiary);
        opacity: 0.5;
      }

      /* Premium Toggle */
      .premium-toggle {
        width: 48px;
        height: 26px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid var(--premium-border);
        border-radius: 50px;
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .premium-toggle.active {
        background: var(--accent);
        border-color: transparent;
      }
      .toggle-thumb {
        width: 20px;
        height: 20px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 2px;
        left: 3px;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      .premium-toggle.active .toggle-thumb {
        transform: translateX(21px);
      }

      /* Premium Slider */
      .slider-container {
        margin-top: 15px;
      }
      .premium-range {
        -webkit-appearance: none;
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        outline: none;
      }
      .premium-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        transition: transform 0.2s;
      }
      .premium-range:active::-webkit-slider-thumb {
        transform: scale(1.3);
        background: var(--accent);
      }
      .slider-marks {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 9px;
        font-weight: 700;
        color: var(--text-tertiary);
        text-transform: uppercase;
      }

      /* Folders & Grid */
      .folder-grid {
        margin-bottom: 12px;
      }
      .folder-item-premium {
        background: var(--premium-glass);
        border: 1px solid var(--premium-border);
        border-radius: var(--radius-xl);
        padding: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .folder-info {
        max-width: 80%;
      }
      .folder-name {
        font-weight: 600;
        font-size: var(--fs-xs);
        display: block;
      }
      .folder-uri {
        font-size: 9px;
        color: var(--text-tertiary);
        word-break: break-all;
      }
      .add-folder-btn-premium {
        width: 100%;
        background: transparent;
        border: 2px dashed var(--premium-border);
        border-radius: var(--radius-xl);
        padding: 12px;
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
      }
      .add-folder-btn-premium:active {
        background: rgba(255,255,255,0.03);
        border-color: var(--accent);
        color: var(--accent);
      }
      .add-folder-btn-premium svg {
        width: 16px;
        height: 16px;
      }

      /* Timer Chips */
      .timer-presets {
        display: flex;
        gap: 8px;
        margin-top: 15px;
        overflow-x: auto;
        padding-bottom: 5px;
        scrollbar-width: none;
      }
      .timer-presets::-webkit-scrollbar { display: none; }
      
      .timer-chip {
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--premium-border);
        border-radius: 12px;
        padding: 10px 16px;
        font-size: 11px;
        font-weight: 700;
        color: var(--text-secondary);
        white-space: nowrap;
        transition: all 0.2s;
      }
      .timer-chip.active {
        background: var(--accent);
        color: #000;
        border-color: transparent;
      }

      /* Maintenance Grid */
      .maintenance-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .action-card {
        background: var(--premium-glass);
        border: 1px solid var(--premium-border);
        border-radius: var(--radius-2xl);
        padding: 14px 10px;
        text-align: center;
        transition: all 0.2s;
      }
      .action-icon {
        color: var(--accent);
        margin-bottom: 6px;
        opacity: 0.8;
      }
      .action-icon svg {
        width: 20px;
        height: 20px;
      }
      .action-icon.danger {
        color: #ff4d4d;
      }
      .action-label {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Footer */
      .settings-footer {
        text-align: center;
        padding: 40px 0;
        opacity: 0.3;
      }
      .footer-logo {
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 10px;
      }
      .version-tag {
        font-size: 9px;
        margin-top: 5px;
        font-weight: 700;
      }
      .crafted-tag {
        font-size: 8px;
        margin-top: 15px;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      /* Loading Spinner */
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: var(--accent);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  // --- LOGIC & EVENTS ---

  // Equalizer
  page.querySelector("#open-eq-btn-container").addEventListener("click", () => {
    haptics.light();
    store.set("eqOpen", true);
  });

  // Crossfade Slider
  const crossSlider = page.querySelector("#crossfade-slider");
  const crossValue = page.querySelector("#crossfade-value");
  const updateCrossLabel = (val) => {
    crossValue.textContent = val > 0 ? `${val}s` : "Deactivated";
    crossValue.style.color = val > 0 ? "var(--accent)" : "inherit";
  };
  updateCrossLabel(audioEngine.crossfadeDuration);
  crossSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    audioEngine.setCrossfade(val);
    updateCrossLabel(val);
  });
  crossSlider.addEventListener("change", () => haptics.light());

  // Generalized Toggle Helper
  const setupToggle = (id, onToggle) => {
    const el = page.querySelector(`#${id}`);
    el.addEventListener("click", () => {
      const active = el.classList.toggle("active");
      haptics.medium();
      onToggle(active);
    });
  };

  setupToggle("pause-disconnect-toggle", (val) =>
    audioEngine.setPauseOnDisconnect(val),
  );
  setupToggle("play-connect-toggle", (val) =>
    audioEngine.setPlayOnConnect(val),
  );

  const minDurContainer = page.querySelector("#min-duration-container");
  setupToggle("avoid-short-toggle", (val) => {
    audioEngine.setAvoidShortTracks(val);
    minDurContainer.style.display = val ? "block" : "none";
  });

  // Short Track Slider
  const minDurSlider = page.querySelector("#min-duration-slider");
  const minDurValue = page.querySelector("#min-duration-value");
  minDurSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    minDurValue.textContent = `${val}s`;
    audioEngine.setMinTrackDuration(val);
  });
  minDurSlider.addEventListener("change", () => haptics.light());

  setupToggle("autoscan-toggle", (val) => musicLibrary.setAutoScan(val));

  // Haptic Intensity
  const hapticIntensityContainer = page.querySelector(
    "#haptic-intensity-container",
  );
  setupToggle("haptic-toggle", (val) => {
    haptics.toggle(val);
    hapticIntensityContainer.style.display = val ? "flex" : "none";
  });

  const hapticSlider = page.querySelector("#haptic-intensity-slider");
  hapticSlider.addEventListener("input", (e) => {
    haptics.setIntensity(parseFloat(e.target.value));
  });
  hapticSlider.addEventListener("change", () => haptics.medium());

  // Folder Management
  const renderFolders = () => {
    const container = page.querySelector("#folder-list-container");
    const folders = musicLibrary.getScannedFolders();
    container.innerHTML = folders.length
      ? folders
          .map(
            (f) => `
        <div class="folder-item-premium">
          <div class="folder-info">
            <span class="folder-name">${f.name}</span>
            <span class="folder-uri">${f.uri}</span>
          </div>
          <button class="remove-folder-btn" data-uri="${f.uri}" style="background: none; border: none; color: var(--text-tertiary); padding: 5px;">${icons.close}</button>
        </div>
      `,
          )
          .join("")
      : '<div style="text-align: center; color: var(--text-tertiary); font-size: 11px; padding: 20px; opacity: 0.5;">No scan directories configured.</div>';

    container.querySelectorAll(".remove-folder-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        haptics.light();
        musicLibrary.removeScannedFolder(btn.dataset.uri);
        renderFolders();
      });
    });
  };
  renderFolders();

  page.querySelector("#add-folder-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.classList.contains("loading")) return;

    haptics.light();

    // Set Loading State
    const originalText = btn.innerHTML;
    btn.classList.add("loading");
    btn.innerHTML = `<div class="spinner"></div> <span>Scanning...</span>`;
    btn.style.opacity = "0.7";

    try {
      await musicLibrary.pickAndScanFolder();
      store.showToast("Scan complete! New music added. 🎹");
    } catch (err) {
      store.showToast("Scan cancelled or failed.");
    } finally {
      // Reset State
      btn.classList.remove("loading");
      btn.innerHTML = originalText;
      btn.style.opacity = "1";
      renderFolders();
    }
  });

  // Maintenance Actions
  page.querySelector("#rescan-btn").addEventListener("click", async (e) => {
    haptics.medium();
    const btn = e.currentTarget;
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";
    await musicLibrary.rescan();
    btn.style.opacity = "1";
    btn.style.pointerEvents = "all";
    store.showToast("Library synchronized! 🎻");
  });

  page.querySelector("#clear-cache-btn").addEventListener("click", () => {
    haptics.medium();
    musicLibrary.clearMetadataCache();
  });

  // Sleep Timer Presets
  const timerChips = page.querySelectorAll(".timer-chip");
  const statusLabel = page.querySelector("#sleep-timer-value");

  const updateTimerActiveUI = (min) => {
    timerChips.forEach((c) => c.classList.remove("active"));
    if (min > 0) {
      statusLabel.textContent = `Expires in ${min}m`;
      statusLabel.classList.add("accent");
      const activeChip = Array.from(timerChips).find(
        (c) => c.dataset.min === min.toString(),
      );
      if (activeChip) activeChip.classList.add("active");
      else page.querySelector("#custom-timer-btn").classList.add("active");
    } else {
      statusLabel.textContent = "Deactivated";
      statusLabel.classList.remove("accent");
      timerChips[0].classList.add("active");
    }
  };

  timerChips.forEach((chip) => {
    if (chip.id === "custom-timer-btn") return;
    chip.addEventListener("click", () => {
      const min = parseInt(chip.dataset.min);
      haptics.light();
      audioEngine.setSleepTimer(min);
      updateTimerActiveUI(min);
    });
  });

  page.querySelector("#custom-timer-btn").addEventListener("click", () => {
    haptics.light();
    const minStr = prompt("Set sleep duration (minutes):", "45");
    const min = parseInt(minStr);
    if (!isNaN(min) && min >= 0) {
      audioEngine.setSleepTimer(min);
      updateTimerActiveUI(min);
    }
  });

  container.appendChild(page);
}
