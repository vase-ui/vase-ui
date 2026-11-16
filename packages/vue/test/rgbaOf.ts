export type Rgba = [number, number, number, number];

// A 2D canvas gives the sRGB bytes of each color form that an engine writes, `oklch()` included.
const canvasContext = document
  .createElement('canvas')
  .getContext('2d', { willReadFrequently: true })!;

export function rgbaOf(color: string): Rgba {
  canvasContext.clearRect(0, 0, 1, 1);
  canvasContext.fillStyle = color;
  canvasContext.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvasContext.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}
