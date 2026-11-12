interface NavigatorUAData {
  readonly brands: ReadonlyArray<{ brand: string; version: string }>;
  readonly mobile: boolean;
  readonly platform: string;
}

interface RawNavigatorData {
  readonly userAgent: string;
  readonly platform: string;
  readonly maxTouchPoints: number;
}

// The legacy fields `userAgent` and `platform` work in each browser.
// A development build reads `userAgentData` on Chromium, so DevTools shows no deprecation warning.
// A production build drops that branch.
function readRawData(): RawNavigatorData {
  // eslint-disable-next-line no-restricted-globals -- The user agent is the same in each window of a page, and the typeof check makes the read safe with no navigator.
  const nav = typeof navigator === 'undefined' ? undefined : navigator;

  if (nav === undefined) {
    return { userAgent: '', platform: '', maxTouchPoints: 0 };
  }

  if (process.env.NODE_ENV !== 'production') {
    const uaData = (nav as Navigator & { userAgentData?: NavigatorUAData | undefined })
      .userAgentData;

    if (uaData && Array.isArray(uaData.brands)) {
      return {
        userAgent: uaData.brands.map(({ brand, version }) => `${brand}/${version}`).join(' '),
        platform: uaData.platform ?? nav.platform ?? '',
        maxTouchPoints: nav.maxTouchPoints ?? 0,
      };
    }
  }

  return {
    userAgent: nav.userAgent,
    platform: nav.platform ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
  };
}

const { userAgent, platform, maxTouchPoints } = readRawData();
export const lowerUserAgent = userAgent.toLowerCase();
export const lowerPlatform = platform.toLowerCase();
export { maxTouchPoints };
