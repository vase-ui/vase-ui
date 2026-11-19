import { useTriggerPress } from '../../src/utils/popups/usePopupTrigger';
export { useFloating } from '../floating-ui-tests/useFloating';

export function useTestClick(...args: Parameters<typeof useTriggerPress>) {
  return { reference: useTriggerPress(...args) };
}
