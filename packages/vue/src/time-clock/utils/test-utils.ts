/**
 * The client coordinates of the point of `face` at `angle` degrees from 12 o'clock, clockwise, and
 * at `ratio` of its radius from the center.
 */
export function pointOnFace(face: Element, angle: number, ratio = 0.9) {
  const rect = face.getBoundingClientRect();
  const radius = (Math.min(rect.width, rect.height) / 2) * ratio;
  const radians = (angle * Math.PI) / 180;
  return {
    clientX: rect.left + rect.width / 2 + Math.sin(radians) * radius,
    clientY: rect.top + rect.height / 2 - Math.cos(radians) * radius,
  };
}
