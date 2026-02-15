# Flow Music Player

Flow is a premium, high-performance music player built with Capacitor and Vite. It features a stunning "Glass Tiles 2.0" design, high-fidelity audio engine with crossfade Support, and advanced library management.

## ✨ Features

- **Premium UI & UX**:
  - Modern glassmorphism design with dynamic accent colors.
  - **Smooth Page Transitions**: Slide and fade animations for a seamless feel.
  - **Skeleton Loaders**: Polished loading states for improved perceived performance.
  - **Swipe Gestures**: Swipe down to close the Now Playing screen.
- **Advanced Audio Engine**:
  - Gapless playback and crossfading (0-12s).
  - 5-band parametric equalizer with makeup gain.
  - Mono audio downmixing and "Avoid Short Tracks" filtering.
- **Queue & Library**:
  - **Drag & Drop Reordering**: Natural touch-based reordering in the queue.
  - **Play Next**: Context menu option to jump tracks to the top of the queue.
  - Blazing fast local scanning with metadata editing.
  - Artist and Album automatic grouping.
- **Now Playing**:
  - Dynamic background colors based on album art.
  - Real-time progress and seek controls.
  - Tactile haptic feedback on all major interactions.
- **Customization**:
  - Custom background images (Gallery pick).
  - Multiple accent color presets.
  - Adjustable sleep timer with real-time countdown.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Android Studio (for native builds)
- Capacitor CLI

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

### 📱 Android Build

To build the debug APK:

1. Build web assets:

   ```bash
   npm run build
   ```

2. Sync with Capacitor:

   ```bash
   npx cap sync android
   ```

3. Build APK:
   ```bash
   cd android && ./gradlew assembleDebug
   ```

The APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

## 🛠 Tech Stack

- **Frontend**: Vanilla HTML/JS, Vite
- **Styling**: Modern CSS (Variables, HSL, Glassmorphism)
- **Native**: Capacitor
- **Icons**: Custom SVG Icon system

## 📄 License

MIT
