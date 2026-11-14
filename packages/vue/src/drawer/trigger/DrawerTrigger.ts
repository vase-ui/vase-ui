import DialogTrigger from '../../dialog/trigger/DialogTrigger.vue';
import type {
  DialogTriggerProps,
  DialogTriggerState,
} from '../../dialog/trigger/DialogTrigger.vue';

export const DrawerTrigger: typeof DialogTrigger = DialogTrigger;

export type DrawerTriggerProps<Payload = unknown> = DialogTriggerProps<Payload>;

export type DrawerTriggerState = DialogTriggerState;
