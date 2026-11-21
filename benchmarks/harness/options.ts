/** The labels of the options of Select and Combobox: `Option 1` to `Option N`, N from the URL parameter `options`, else 5. */
export const options = Array.from(
  { length: Number(new URLSearchParams(location.search).get('options') ?? 5) },
  (_, index) => `Option ${index + 1}`,
);
