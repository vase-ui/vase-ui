import * as REASONS from './reason-parts';

export { REASONS };
export type VaseUIEventReasons = typeof REASONS;
export type VaseUIEventReason = VaseUIEventReasons[keyof VaseUIEventReasons];
