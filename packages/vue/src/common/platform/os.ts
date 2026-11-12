import { lowerUserAgent, lowerPlatform, maxTouchPoints } from './shared';

// iPadOS 13 and later report `MacIntel`. `maxTouchPoints > 1` marks them as iOS.
// https://github.com/mui/base-ui/issues/1309
export const ios =
  /^i(os$|p)/.test(lowerPlatform) || (lowerPlatform === 'macintel' && maxTouchPoints > 1);

// Android shows in the platform or in the user agent.
const ANDROID_STRING = 'android';
export const android = lowerPlatform === ANDROID_STRING || lowerUserAgent.includes(ANDROID_STRING);

// Does not include iPadOS.
export const mac = !ios && lowerPlatform.startsWith('mac');

export const windows = lowerPlatform.startsWith('win');

// Includes Chrome OS. Does not include Android.
export const linux = !android && /^(linux|chrome os)/.test(lowerPlatform);

export const apple = mac || ios;
