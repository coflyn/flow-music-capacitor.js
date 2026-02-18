import { icons } from "../core/icons.js";
import { store } from "../core/store.js";
import { audioEngine } from "../core/audioEngine.js";
import { musicLibrary } from "../core/library.js";
import { haptics } from "../core/haptics.js";
import { createElement } from "../core/utils.js";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

/**
 * Renders the polished Settings page with "Grouped List" design.
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  container.innerHTML = "";
  const page = createElement("div", "page animate-in");

  page.innerHTML = `
    <header class="settings-page-header">
      <h1 class="page-title" style="margin-bottom: var(--sp-2);">Settings</h1>
    </header>

    <div class="settings-scroll-view">
      
      <!-- Audio Section -->
      <div class="settings-group-title">Audio</div>
      <div class="settings-group-card">
        

        <!-- Crossfade -->
        <div class="setting-row">
          <div class="setting-icon">${icons.shuffle}</div>
          <div class="setting-content">
            <span class="setting-title">Crossfade</span>
            <span class="setting-subtitle" id="crossfade-value">${audioEngine.crossfadeDuration > 0 ? audioEngine.crossfadeDuration + "s" : "Off"}</span>
            <div class="setting-inline-control">
               <input type="range" id="crossfade-slider" min="0" max="12" step="0.5" value="${audioEngine.crossfadeDuration}" class="premium-range" style="margin-top:8px;">
            </div>
          </div>
        </div>

      </div>

      <!-- Appearance Section -->
      <div class="settings-group-title">Appearance</div>
      <div class="settings-group-card">
        
        <div class="setting-row clickable" id="bg-picker-row">
          <div class="setting-icon">${icons.image || icons.music}</div>
          <div class="setting-content">
            <span class="setting-title">Custom Background</span>
            <span class="setting-subtitle">Choose from gallery</span>
          </div>
          <div class="setting-action">
            <button id="reset-bg-small-btn" class="icon-btn-plain" style="color: #ff4d4d; margin-right: 12px; padding: 10px;">
              ${icons.trash}
            </button>
            ${icons.chevronRight}
          </div>
          <input type="file" id="bg-file-input" accept="image/*" style="display: none;">
        </div>

        <!-- Themes -->
         <div class="setting-row">
          <div class="setting-icon">${icons.palette}</div>
          <div class="setting-content">
            <span class="setting-title">Accent Color</span>
            <div class="color-swatches" style="margin-top: 8px;">
               <div class="swatch ${audioEngine.accentColor === "#1db954" ? "active" : ""}" style="--swatch: #1db954" data-color="#1db954"></div>
               <div class="swatch ${audioEngine.accentColor === "#2E86DE" ? "active" : ""}" style="--swatch: #2E86DE" data-color="#2E86DE"></div>
               <div class="swatch ${audioEngine.accentColor === "#A55EEA" ? "active" : ""}" style="--swatch: #A55EEA" data-color="#A55EEA"></div>
               <div class="swatch ${audioEngine.accentColor === "#FA8231" ? "active" : ""}" style="--swatch: #FA8231" data-color="#FA8231"></div>
               <div class="swatch ${audioEngine.accentColor === "#EB3B5A" ? "active" : ""}" style="--swatch: #EB3B5A" data-color="#EB3B5A"></div>
            </div>
          </div>
        </div>

      </div>

      <!-- Playback Section -->
      <div class="settings-group-title">Playback</div>
      <div class="settings-group-card">
        

        <div class="setting-row">
           <div class="setting-icon">${icons.play || icons.settings}</div>
           <div class="setting-content">
             <span class="setting-title">Pause on Disconnect</span>
             <span class="setting-subtitle">Stop when unplugged</span>
           </div>
           <div class="setting-action">
             <div class="premium-toggle ${audioEngine.pauseOnDisconnect ? "active" : ""}" id="pause-disconnect-toggle">
               <div class="toggle-thumb"></div>
             </div>
           </div>
        </div>

        <div class="setting-row">
           <div class="setting-icon">${icons.play || icons.settings}</div>
           <div class="setting-content">
             <span class="setting-title">Resume on Connect</span>
             <span class="setting-subtitle">Play when plugged back</span>
           </div>
           <div class="setting-action">
             <div class="premium-toggle ${audioEngine.playOnConnect ? "active" : ""}" id="play-connect-toggle">
               <div class="toggle-thumb"></div>
             </div>
           </div>
        </div>

        </div>

      </div>

      <!-- Library Section -->
      <div class="settings-group-title">Library</div>
      <div class="settings-group-card">
        
        <div class="setting-row">
           <div class="setting-content">
             <span class="setting-title">Avoid Short Tracks</span>
             <span class="setting-subtitle">Skip audio under <span id="min-dur-display">${audioEngine.minTrackDuration}s</span></span>
             <div id="min-duration-slider-container" style="display: ${audioEngine.avoidShortTracks ? "block" : "none"}; padding-top:8px;">
                <input type="range" id="min-duration-slider" min="5" max="60" step="5" value="${audioEngine.minTrackDuration}" class="premium-range">
             </div>
           </div>
           <div class="setting-action" style="align-self: flex-start; margin-top: 4px;">
             <div class="premium-toggle ${audioEngine.avoidShortTracks ? "active" : ""}" id="avoid-short-toggle">
               <div class="toggle-thumb"></div>
             </div>
           </div>
        </div>

        <div class="setting-row">
           <div class="setting-content">
             <span class="setting-title">Scan on Startup</span>
           </div>
           <div class="setting-action">
             <div class="premium-toggle ${musicLibrary.autoScan ? "active" : ""}" id="autoscan-toggle">
               <div class="toggle-thumb"></div>
             </div>
           </div>
        </div>

        <!-- Folders -->
        <div id="folder-list-container"></div>
        <div class="setting-row clickable" id="add-folder-btn" style="justify-content: center; color: var(--accent);">
           <span class="setting-title" style="color: var(--accent); font-weight:600;">Add Music Directory</span>
        </div>

      </div>
      
      <div class="settings-group-title">Utilities</div>
      <div class="settings-group-card">
         <div class="setting-row clickable" id="rescan-btn">
            <div class="setting-icon">${icons.refresh}</div>
            <div class="setting-content">
               <span class="setting-title">Rescan Library</span>
               <span class="setting-subtitle">Sync music files immediately</span>
            </div>
         </div>
         <div class="setting-row clickable" id="clear-cache-btn">
            <div class="setting-icon">${icons.trash || icons.settings}</div>
            <div class="setting-content">
               <span class="setting-title" style="color: #ff4d4d;">Clear Cache</span>
               <span class="setting-subtitle">Reset all music data and art</span>
            </div>
         </div>
         <div class="setting-row clickable" id="reset-defaults-btn">
            <div class="setting-icon" style="background: rgba(255, 77, 77, 0.1); border-color: rgba(255, 77, 77, 0.2); color: #ff4d4d;">${icons.reset}</div>
            <div class="setting-content">
               <span class="setting-title" style="color: #ff4d4d;">Reset to Defaults</span>
               <span class="setting-subtitle">Restore initial settings</span>
            </div>
         </div>
      </div>

      <div style="text-align:center; padding: 40px 0; opacity: 0.3;">
         <div style="font-weight:900; letter-spacing:8px; font-size: 14px;">FLOW</div>
         <div style="font-size:10px; margin-top:8px;">Version 1.0.0</div>
      </div>

    </div>
  `;

  const eqBtn = page.querySelector("#open-eq-btn");
  if (eqBtn) {
    eqBtn.addEventListener("click", () => {
      haptics.light();
      store.set("eqOpen", true);
    });
  }

  const crossSlider = page.querySelector("#crossfade-slider");
  const crossDisplay = page.querySelector("#crossfade-value");
  if (crossSlider) {
    ["input", "mousedown", "touchstart"].forEach((ev) => {
      crossSlider.addEventListener(ev, (e) => e.stopPropagation());
    });
    crossSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      audioEngine.setCrossfade(val);
      crossDisplay.textContent = val > 0 ? `${val}s` : "Off";
      crossDisplay.style.color = val > 0 ? "var(--accent)" : "inherit";
    });
  }

  const setupToggle = (id, onChange) => {
    const t = page.querySelector(`#${id}`);
    if (!t) return;
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = t.classList.toggle("active");
      haptics.medium();
      onChange(isActive);
    });
  };

  setupToggle("pause-disconnect-toggle", (val) =>
    audioEngine.setPauseOnDisconnect(val),
  );
  setupToggle("play-connect-toggle", (val) =>
    audioEngine.setPlayOnConnect(val),
  );
  setupToggle("autoscan-toggle", (val) => musicLibrary.setAutoScan(val));
  setupToggle("avoid-short-toggle", (val) => {
    audioEngine.setAvoidShortTracks(val);
    const container = page.querySelector("#min-duration-slider-container");
    if (container) container.style.display = val ? "block" : "none";
  });

  const minDurSlider = page.querySelector("#min-duration-slider");
  const minDurDisplay = page.querySelector("#min-dur-display");
  if (minDurSlider) {
    ["input", "mousedown", "touchstart"].forEach((ev) => {
      minDurSlider.addEventListener(ev, (e) => e.stopPropagation());
    });
    minDurSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      audioEngine.setMinTrackDuration(val);
      if (minDurDisplay) minDurDisplay.textContent = `${val}s`;
    });
  }

  const bgPickerRow = page.querySelector("#bg-picker-row");
  const bgInput = page.querySelector("#bg-file-input");

  if (bgPickerRow && bgInput) {
    bgPickerRow.addEventListener("click", () => bgInput.click());

    bgInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const result = evt.target.result;
          localStorage.setItem("flow_custom_bg", result);
          document.body.style.backgroundImage = `url('${result}')`;
          document.body.style.backgroundSize = "cover";
          document.body.style.backgroundPosition = "center";
          document.body.style.backgroundAttachment = "fixed";

          if (!document.getElementById("bg-overlay")) {
            const overlay = document.createElement("div");
            overlay.id = "bg-overlay";
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.background = "rgba(0,0,0,0.7)";
            overlay.style.zIndex = "-1";
            overlay.style.pointerEvents = "none";
            document.body.appendChild(overlay);
          }
          store.showToast("Background updated!");
        };
        reader.readAsDataURL(file);
      } catch (err) {
        store.showToast("Failed to load image");
      }
    });
  }

  const resetBtn = page.querySelector("#reset-bg-small-btn");
  if (resetBtn) {
    ["click", "touchstart"].forEach((ev) => {
      resetBtn.addEventListener(ev, (e) => {
        e.stopPropagation();
        e.preventDefault();
        haptics.medium();
        localStorage.removeItem("flow_custom_bg");
        document.body.style.backgroundImage = "";

        const overlay = document.getElementById("bg-overlay");
        if (overlay) overlay.remove();

        store.showToast("Background reset");
      });
    });
  }

  page.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      haptics.light();
      const color = swatch.dataset.color;

      page
        .querySelectorAll(".swatch")
        .forEach((s) => s.classList.remove("active"));
      swatch.classList.add("active");

      audioEngine.setAccentColor(color);
      store.showToast("Theme updated");
    });
  });

  const resetDefaultsBtn = page.querySelector("#reset-defaults-btn");
  if (resetDefaultsBtn) {
    resetDefaultsBtn.addEventListener("click", () => {
      haptics.medium();
      if (confirm("Reset all settings to default values?")) {
        [
          "flow_accent_color",
          "flow_custom_bg",
          "flow_haptic_intensity",
          "flow_eq_gains",
          "flow_library_cache",
          "zplayer_scan_cache",
          "zplayer_recent",
          "zplayer_favorites",
          "zplayer_playlists",
        ].forEach((k) => localStorage.removeItem(k));
        audioEngine.setCrossfade(0);
        audioEngine.setPauseOnDisconnect(true);
        audioEngine.setPlayOnConnect(false);
        audioEngine.setAvoidShortTracks(true);
        audioEngine.setMinTrackDuration(30);
        musicLibrary.setAutoScan(true);

        store.showToast("Settings reset to defaults");
        setTimeout(() => window.location.reload(), 1000);
      }
    });
  }

  const renderFolders = () => {
    const container = page.querySelector("#folder-list-container");
    if (!container) return;

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

  const addFolderBtn = page.querySelector("#add-folder-btn");
  if (addFolderBtn) {
    addFolderBtn.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.classList.contains("loading")) return;

      haptics.light();
      musicLibrary.pickAndScanFolder();
    });
  }

  const rescanBtn = page.querySelector("#rescan-btn");
  if (rescanBtn) {
    rescanBtn.addEventListener("click", async (e) => {
      haptics.medium();
      const btn = e.currentTarget;
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
      try {
        await musicLibrary.rescan();
        store.showToast("Library synchronized! 🎻");
      } catch (e) {
        store.showToast("Rescan failed");
      } finally {
        btn.style.opacity = "1";
        btn.style.pointerEvents = "all";
      }
    });
  }

  const clearCacheBtn = page.querySelector("#clear-cache-btn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      haptics.medium();
      musicLibrary.clearMetadataCache();
    });
  }

  container.appendChild(page);
}
