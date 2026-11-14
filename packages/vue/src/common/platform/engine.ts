import { lowerUserAgent } from './shared';

// WebKit: Safari, each iOS browser and GNOME Web.
// The old name `-webkit-backdrop-filter` tells WebKit from Blink.
// Blink left WebKit in 2013 and has only the name without the prefix.
// The `typeof CSS` check keeps a server safe.
export const webkit =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- An engine with no `CSS.supports` gives `undefined`, and the export must be a Boolean.
  typeof CSS !== 'undefined' && !!CSS.supports?.('-webkit-backdrop-filter:none');

// Firefox on iOS is WebKit. Its user agent has `FxiOS/` and not `Firefox/`.
// The `!webkit` test keeps the engines exclusive.
export const gecko = !webkit && lowerUserAgent.includes('firefox');

// Chrome, Edge, Opera and Brave have `Chrome/` or `Chromium/` in the user agent.
// Both start with `chrom`, so one test finds them.
// Chrome on iOS has `CriOS/` and stays WebKit.
// An empty user agent matches nothing, so this is safe on a server.
export const blink = !webkit && lowerUserAgent.includes('chrom');
