/**
 * The time of each toast of the fixture `Toasts`, in milliseconds: the URL parameter `timeout`,
 * else 60,000, so that no check loses its toast to the timer.
 */
export const toastTimeout = Number(new URLSearchParams(location.search).get('timeout') ?? 60_000);
