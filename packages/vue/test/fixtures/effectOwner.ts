import { isVaporParts } from '../testApp';
import Owner from './EffectOwner.vue';
import VaporOwner from './VaporEffectOwner.vue';

export const EffectOwner = isVaporParts ? VaporOwner : Owner;
