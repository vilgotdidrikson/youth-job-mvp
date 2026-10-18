/** Ordered, reusable journey. Completion comes from saved data, never a UI click. */
export const PROFILE_JOURNEY = [
  {key:"cv",title:"CV",description:"Erfarenhet, utbildning och språk",optional:false},
  {key:"preferences",title:"Vad jag söker",description:"Jobb, plats och motivation",optional:true},
  {key:"availability",title:"När jag kan jobba",description:"Dagar, tider och omfattning",optional:true},
  {key:"qualifications",title:"Kunskaper",description:"Kompletterande verktyg och behörigheter",optional:true},
  {key:"examples",title:"Egna exempel",description:"Visa något du har gjort",optional:true},
] as const;
export type ProfileJourneyStep = typeof PROFILE_JOURNEY[number]["key"];
export function isProfileJourneyStep(value: unknown): value is ProfileJourneyStep {
  return PROFILE_JOURNEY.some(step=>step.key===value);
}
export function nextProfileStep(current: ProfileJourneyStep): ProfileJourneyStep | null {
  return PROFILE_JOURNEY[PROFILE_JOURNEY.findIndex(step=>step.key===current)+1]?.key??null;
}
export function profileStepUrl(step: ProfileJourneyStep): string {
  if(step==='cv')return '/youth/cv?return=build&edit=1';
  return `/profile/develop?section=${step}&return=build`;
}
export function resumeProfileStep(saved: readonly string[]): ProfileJourneyStep {
  return PROFILE_JOURNEY.find(step=>!saved.includes(step.key))?.key??'cv';
}

/** Old saved video steps continue with preferences; no obsolete video screen. */
export function restoredProfileStep(value: unknown): ProfileJourneyStep | null {
  if(value === 'video') return 'preferences';
  return isProfileJourneyStep(value) ? value : null;
}
