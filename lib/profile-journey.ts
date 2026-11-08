/** Ordered, reusable journey. Completion comes from saved data, never a UI click. */
export const PROFILE_JOURNEY = [
  {key:"cv",title:"CV",description:"Erfarenhet, utbildning och språk",optional:false},
  {key:"preferences",title:"Vad jag söker",description:"Jobb, plats och motivation",optional:true},
  {key:"availability",title:"När jag kan jobba",description:"Dagar, tider och omfattning",optional:true},
  {key:"qualifications",title:"Kunskaper",description:"Verktyg och behörigheter",optional:true},
  {key:"examples",title:"Egna exempel",description:"Visa något du har gjort",optional:true},
] as const;
export type ProfileJourneyStep = typeof PROFILE_JOURNEY[number]["key"];
export function isProfileJourneyStep(value: unknown): value is ProfileJourneyStep {
  return PROFILE_JOURNEY.some(step=>step.key===value);
}
/**
 * Where the person is in the profile, in words instead of "Steg 2 av 5" (D06): the CV is
 * the only required part, the other steps are optional. Without `done` the CV state is left out.
 */
export function profileStepStatus(step: ProfileJourneyStep, done?: readonly string[]): string {
  if (step === "cv") return "CV · krävs för att söka jobb";
  const optional = PROFILE_JOURNEY.filter(item => item.optional);
  const part = `valfri del ${optional.findIndex(item => item.key === step) + 1} av ${optional.length}`;
  if (!done) return part.charAt(0).toLocaleUpperCase("sv-SE") + part.slice(1);
  return `${done.includes("cv") ? "CV klart" : "CV saknas"} · ${part}`;
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
