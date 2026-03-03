import { YouthProfile } from "@/lib/types";

export function profileStrength(profile: YouthProfile): number {
  let points = 0;
  const total = 11;
  if (profile.name.trim()) points += 1;
  if (profile.age) points += 1;
  if (profile.city.trim()) points += 1;
  if (profile.contactEmail.trim()) points += 1;
  if (profile.contactPhone.trim()) points += 1;
  if (profile.targetRole.trim()) points += 1;
  if (profile.skills.length > 0) points += 1;
  if (profile.interests.length > 0) points += 1;
  if (profile.experience.length > 0) points += 1;
  if (profile.availability.trim()) points += 1;
  if (profile.cv) points += 1;
  return Math.round((points / total) * 100);
}
