export function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
export async function getDominantColors(imgSrc) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 10;
      canvas.height = 10;
      ctx.drawImage(img, 0, 0, 10, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;

      const getAvg = (start, end) => {
        let r = 0,
          g = 0,
          b = 0;
        let count = 0;
        for (let i = start; i < end; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        return {
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
        };
      };

      const mid = Math.floor(data.length / 8) * 4;
      const color1 = getAvg(0, mid);
      const color2 = getAvg(mid, data.length);

      resolve([color1, color2]);
    };
    img.onerror = () =>
      resolve([
        { r: 29, g: 185, b: 84 },
        { r: 18, g: 18, b: 18 },
      ]);
  });
}

export function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function createElement(tag, className, innerHTML) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function cleanTitle(title, maxLength = 35) {
  if (!title) return "";

  let cleaned = title
    .replace(
      /[\(\[][^\]\)]*(Official|Lyric|Video|Audio|HD|4K)[^\]\)]*[\)\]]/gi,
      "",
    )
    .replace(/[\(\[][^\]\)]*(feat|with)[^\]\)]*[\)\]]/gi, "")
    .trim()
    .replace(/\s*-\s*$/, "")
    .trim();

  if (cleaned.length > maxLength) {
    return cleaned.substring(0, maxLength - 3) + "...";
  }
  return cleaned;
}
