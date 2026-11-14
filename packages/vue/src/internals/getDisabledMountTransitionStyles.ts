import type { CSSProperties } from 'vue';
import { EMPTY_OBJECT } from '../common/empty';
import { DISABLED_TRANSITIONS_STYLE } from './constants';
import type { TransitionStatus } from './useTransitionStatus';

export function getDisabledMountTransitionStyles(transitionStatus: TransitionStatus): {
  style?: CSSProperties | undefined;
} {
  return transitionStatus === 'starting' ? DISABLED_TRANSITIONS_STYLE : EMPTY_OBJECT;
}
