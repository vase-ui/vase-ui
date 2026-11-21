declare global {
  interface Window {
    /** Mounts the app of a page that has the URL parameter `manual`. */
    startApp?: () => void;
  }
}

/** Mounts the app. With the URL parameter `manual`, a timing run calls `window.startApp` later. */
export function start(mount: () => void): void {
  if (new URLSearchParams(location.search).has('manual')) {
    window.startApp = mount;
  } else {
    mount();
  }
}
