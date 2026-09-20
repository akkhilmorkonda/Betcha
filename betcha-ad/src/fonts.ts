import { loadFont as loadSpaceGrotesk, fontFamily as spaceGroteskFamily } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadDMSans, fontFamily as dmSansFamily } from '@remotion/google-fonts/DMSans';

loadSpaceGrotesk('normal');
loadDMSans('normal');

export const SPACE_GROTESK = spaceGroteskFamily;
export const DM_SANS = dmSansFamily;
