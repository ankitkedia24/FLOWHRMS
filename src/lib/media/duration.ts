/**
 * How long an animation runs, so one over the 4-second limit is refused
 * before it is uploaded. Pure for GIFs (tested); videos ask the browser.
 */

/**
 * Total play time of one loop of a GIF, in seconds: the sum of every
 * frame's delay (Graphic Control Extension, in 1/100 s). Browsers show a
 * delay of 0 or 1 as 0.1 s, so this does too.
 */
export function gifDurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 13 || String.fromCharCode(...bytes.slice(0, 3)) !== "GIF") return null;
  let total = 0;
  let frames = 0;
  for (let i = 13; i < bytes.length - 5; i++) {
    // 0x21 0xF9 0x04 = Graphic Control Extension, block size 4.
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
      const delay = bytes[i + 4] | (bytes[i + 5] << 8);
      total += delay <= 1 ? 10 : delay;
      frames++;
      i += 7;
    }
  }
  return frames === 0 ? 0 : total / 100;
}

/** A video file's length in seconds, read by the browser. */
export function videoDurationSeconds(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}
