export * as OTPField from './index.parts';

export { default as OTPFieldRoot } from './root/OTPFieldRoot.vue';
export { default as OTPFieldSeparator } from '../separator/Separator.vue';

export type * from './root/OTPFieldRoot.vue';
export type {
  SeparatorProps as OTPFieldSeparatorProps,
  SeparatorState as OTPFieldSeparatorState,
} from '../separator/Separator.vue';

export * as OTPFieldRootDataAttributes from './root/OTPFieldRootDataAttributes';
export * as OTPFieldSeparatorDataAttributes from '../separator/SeparatorDataAttributes';
