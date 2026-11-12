import { apple } from './os';

// A page cannot detect that a screen reader runs. This flag is true on each Apple platform.
// VoiceOver is the system screen reader there and works with each browser.
// Check the engine at the call site for a defect of one engine.
export const voiceOver = apple;
