import { onTestFinished, vi } from 'vitest';

/** A picture of 2 by 2 pixels in a new colour, so that no image of the document has loaded it. */
function newPicture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext('2d')!;
  context.fillStyle = `#${Math.floor(Math.random() * 0x1000000)
    .toString(16)
    .padStart(6, '0')}`;
  context.fillRect(0, 0, 2, 2);
  return canvas;
}

/** A data URL that is in the list of available images of the document. */
export async function pictureThatBrowserHas() {
  const url = newPicture().toDataURL();
  const image = new Image();
  image.src = url;
  await image.decode();
  return url;
}

/** A new blob URL: the browser loads it in a later task. */
export async function pictureThatMustLoad() {
  const blob = await new Promise<Blob | null>((resolve) => newPicture().toBlob(resolve));
  const url = URL.createObjectURL(blob!);
  onTestFinished(() => URL.revokeObjectURL(url));
  return url;
}

let missingCount = 0;

/** A URL with no file: the browser loads it in a later task, and then it fails. */
export function pictureThatFails() {
  missingCount += 1;
  return `/missing-avatar-${missingCount}.png`;
}

/** Puts in place of `Image` a subclass that keeps each instance. */
export function recordImageObjects() {
  const images: HTMLImageElement[] = [];
  const BrowserImage = Image;
  vi.stubGlobal(
    'Image',
    class extends BrowserImage {
      constructor() {
        super();
        images.push(this);
      }
    },
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return images;
}

/** Waits for the next frame of the browser, before its paint. */
export function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
