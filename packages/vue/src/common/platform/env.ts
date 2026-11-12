import { lowerUserAgent } from './shared';

// A user of the library can run tests in jsdom or HappyDOM.
export const jsdom = /jsdom|happydom/.test(lowerUserAgent);
