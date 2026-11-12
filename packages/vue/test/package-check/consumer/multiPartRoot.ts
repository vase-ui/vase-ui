import { MultiPart } from '@vase-ui/vue/multi-part';
import { createApp } from 'vue';

createApp(MultiPart.Root, { payload: 1 }).mount(document.body);
