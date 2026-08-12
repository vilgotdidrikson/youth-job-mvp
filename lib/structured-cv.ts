export interface CvPersonalInfo {
  name?: string;
  city?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  portfolio?: string;
  sourceNotes?: string[];
}

export interface CvWorkExperience {
  employer?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  responsibilities: string[];
  tools: string[];
  collaboration?: string;
  projects: string[];
  achievements: string[];
  learnings: string[];
  sourceNotes: string[];
}

export interface CvEducation {
  school?: string;
  program?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  expectedGraduation?: string;
  courses: string[];
  projects: string[];
  achievements: string[];
  sourceNotes: string[];
}

export interface CvProject {
  name?: string;
  description?: string;
  role?: string;
  contributions: string[];
  tools: string[];
  results: string[];
  sourceNotes: string[];
}

export interface CvSkill {
  name: string;
  category: "technical" | "digital" | "language" | "other";
  evidence: string;
}

export interface CvCertification {
  name?: string;
  issuer?: string;
  year?: string;
  reason?: string;
  sourceNotes: string[];
}

export interface CvLanguage {
  name: string;
  level?: "Modersmål" | "Flytande" | "Mycket god" | "God" | "Grundläggande";
  abilities: string[];
  evidence: string;
}

export interface CvOtherExperience {
  title?: string;
  type?: string;
  organization?: string;
  period?: string;
  details: string[];
  sourceNotes: string[];
}

export interface StructuredCvData {
  personalInfo: CvPersonalInfo;
  profile: {
    strengths: string[];
    traits: string[];
    interests: string[];
    targetRoles: string[];
    differentiators: string[];
    sourceNotes: string[];
  };
  workExperience: CvWorkExperience[];
  education: CvEducation[];
  projects: CvProject[];
  skills: CvSkill[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  otherExperience: CvOtherExperience[];
}

export function createEmptyStructuredCv(personalInfo: CvPersonalInfo = {}): StructuredCvData {
  return {
    personalInfo,
    profile: { strengths: [], traits: [], interests: [], targetRoles: [], differentiators: [], sourceNotes: [] },
    workExperience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    languages: [],
    otherExperience: [],
  };
}

const clean = (value?: string) => value?.trim() ?? "";
const compact = (values: Array<string | undefined>) => values.map(clean).filter(Boolean);
const split = (value?: string) => compact((value ?? "").split(/[,;\n]/));

export function structuredCvFromForm(input: {
  full_name?: string;
  city?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  portfolio?: string;
  profile_details?: string;
  target_job?: string;
  projects_text?: string;
  skills_text?: string;
  desired_roles?: string[];
  strengths?: string;
  languages?: string;
  work_experience?: string;
  education?: string;
  certificates?: string;
  extracurriculars?: string;
  work_experiences?: Array<{ title?: string; company?: string; location?: string; start_date?: string; end_date?: string; is_current?: boolean; description?: string }>;
  educations?: Array<{ school?: string; degree?: string; subject?: string; start_date?: string; end_date?: string; description?: string }>;
  certificate_entries?: Array<{ name?: string; issuer?: string; issue_date?: string; description?: string }>;
  other_entries?: Array<{ title?: string; type?: string; value?: string }>;
}): StructuredCvData {
  const cv = createEmptyStructuredCv({
    name: clean(input.full_name), city: clean(input.city), phone: clean(input.phone), email: clean(input.email),
    linkedin: clean(input.linkedin), portfolio: clean(input.portfolio),
  });
  cv.profile.strengths = split(input.strengths);
  cv.profile.targetRoles = [...compact(input.desired_roles ?? []), ...split(input.target_job)];
  cv.profile.sourceNotes = compact([input.profile_details, input.strengths]);
  cv.languages = split(input.languages).map((name) => ({ name, abilities: [], evidence: name }));

  cv.workExperience = (input.work_experiences ?? []).filter((item) => Object.values(item).some(Boolean)).map((item) => ({
    employer: clean(item.company), role: clean(item.title), location: clean(item.location), startDate: clean(item.start_date),
    endDate: item.is_current ? "Pågående" : clean(item.end_date), responsibilities: compact([item.description]), tools: [],
    projects: [], achievements: [], learnings: [], sourceNotes: compact([item.description]),
  }));
  if (!cv.workExperience.length && clean(input.work_experience)) {
    cv.workExperience.push({ responsibilities: [clean(input.work_experience)], tools: [], projects: [], achievements: [], learnings: [], sourceNotes: [clean(input.work_experience)] });
  }

  cv.education = (input.educations ?? []).filter((item) => Object.values(item).some(Boolean)).map((item) => ({
    school: clean(item.school), program: compact([item.degree, item.subject]).join(", "), startDate: clean(item.start_date),
    endDate: clean(item.end_date), courses: [], projects: [], achievements: [], sourceNotes: compact([item.description]),
  }));
  if (!cv.education.length && clean(input.education)) {
    cv.education.push({ school: clean(input.education), courses: [], projects: [], achievements: [], sourceNotes: [clean(input.education)] });
  }

  if (clean(input.projects_text)) {
    cv.projects.push({ description: clean(input.projects_text), contributions: [], tools: [], results: [], sourceNotes: [clean(input.projects_text)] });
  }
  cv.skills = split(input.skills_text).map((name) => ({ name, category: "other", evidence: name }));

  cv.certifications = (input.certificate_entries ?? []).filter((item) => Object.values(item).some(Boolean)).map((item) => ({
    name: clean(item.name), issuer: clean(item.issuer), year: clean(item.issue_date), reason: clean(item.description), sourceNotes: compact([item.description]),
  }));
  if (!cv.certifications.length && clean(input.certificates)) cv.certifications.push({ name: clean(input.certificates), sourceNotes: [clean(input.certificates)] });

  cv.otherExperience = (input.other_entries ?? []).filter((item) => Object.values(item).some(Boolean)).map((item) => ({
    title: clean(item.title), type: clean(item.type), details: compact([item.value]), sourceNotes: compact([item.value]),
  }));
  if (!cv.otherExperience.length && clean(input.extracurriculars)) {
    cv.otherExperience.push({ details: [clean(input.extracurriculars)], sourceNotes: [clean(input.extracurriculars)] });
  }
  return cv;
}

function bullets(values: string[], limit = 4) {
  return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit).map((value) => `- ${value}`);
}

export function renderStructuredCv(cv: StructuredCvData): string {
  const output: string[] = [];
  const section = (title: string, lines: string[]) => { if (lines.length) output.push(title, ...lines, ""); };
  const contact = compact([cv.personalInfo.city, cv.personalInfo.phone, cv.personalInfo.email, cv.personalInfo.linkedin, cv.personalInfo.portfolio]);
  if (clean(cv.personalInfo.name)) output.push(clean(cv.personalInfo.name).toUpperCase());
  if (contact.length) output.push(contact.join(" | "));
  if (output.length) output.push("");

  const profileFacts = [...cv.profile.sourceNotes, ...cv.profile.strengths, ...cv.profile.differentiators];
  section("PROFIL", [...new Set(profileFacts.map(clean).filter(Boolean))].slice(0, 3));

  section("ARBETSLIVSERFARENHET", cv.workExperience.flatMap((item) => {
    const heading = compact([compact([item.role, item.employer]).join(" - "), compact([item.startDate, item.endDate || item.duration]).join(" - ")]).join(" | ");
    return [heading, ...bullets([...item.responsibilities, ...item.projects, ...item.achievements, ...item.learnings], 4)].filter(Boolean);
  }));

  section("UTBILDNING", cv.education.flatMap((item) => {
    const heading = compact([compact([item.program, item.school]).join(" - "), compact([item.startDate, item.endDate || item.expectedGraduation]).join(" - ")]).join(" | ");
    return [heading, ...bullets([...item.courses, ...item.projects, ...item.achievements, ...item.sourceNotes], 3)].filter(Boolean);
  }));

  section("PROJEKT", cv.projects.flatMap((item) => [compact([item.name, item.role]).join(" - "), ...bullets([item.description ?? "", ...item.contributions, ...item.results], 3)].filter(Boolean)));
  section("KOMPETENSER", bullets(cv.skills.map((skill) => skill.name), 10));
  section("CERTIFIKAT OCH MERITER", cv.certifications.flatMap((item) => [compact([item.name, item.issuer, item.year]).join(" | "), ...bullets(compact([item.reason]), 1)].filter(Boolean)));
  section("SPRÅK", bullets(cv.languages.map((language) => compact([language.name, language.level, language.abilities.join(", ")]).join(" - ")), 8));
  section("ÖVRIG ERFARENHET", cv.otherExperience.flatMap((item) => [compact([item.title, item.organization, item.period]).join(" | "), ...bullets(item.details, 3)].filter(Boolean)));

  let wordCount = 0;
  return output.map((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    const remaining = Math.max(0, 500 - wordCount);
    wordCount += Math.min(words.length, remaining);
    return words.slice(0, remaining).join(" ");
  }).filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join("\n").trim();
}

export function appendInterviewAnswer(cv: StructuredCvData, area: keyof Omit<StructuredCvData, "personalInfo"> | "personalInfo", transcript: string): StructuredCvData {
  const answer = clean(transcript);
  if (!answer) return cv;
  const next = structuredClone(cv);
  if (area === "personalInfo") {
    next.personalInfo.sourceNotes = [...(next.personalInfo.sourceNotes ?? []), answer];
    next.personalInfo.email ??= answer.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
    next.personalInfo.phone ??= answer.match(/(?:\+46|0)[\d\s-]{7,}/)?.[0]?.trim();
    const urls = answer.match(/https?:\/\/\S+|(?:linkedin\.com|github\.com)\/\S+/gi) ?? [];
    next.personalInfo.linkedin ??= urls.find((url) => /linkedin/i.test(url));
    next.personalInfo.portfolio ??= urls.find((url) => !/linkedin/i.test(url));
  } else if (area === "profile") {
    next.profile.sourceNotes.push(answer);
  } else if (area === "workExperience") {
    next.workExperience[0] ??= { responsibilities: [], tools: [], projects: [], achievements: [], learnings: [], sourceNotes: [] };
    next.workExperience[0].sourceNotes.push(answer);
    next.workExperience[0].responsibilities.push(answer);
  } else if (area === "education") {
    next.education[0] ??= { courses: [], projects: [], achievements: [], sourceNotes: [] };
    next.education[0].sourceNotes.push(answer);
  } else if (area === "projects") {
    next.projects[0] ??= { contributions: [], tools: [], results: [], sourceNotes: [] };
    next.projects[0].sourceNotes.push(answer);
    next.projects[0].contributions.push(answer);
  } else if (area === "skills") {
    next.skills.push({ name: answer, category: "other", evidence: answer });
  } else if (area === "certifications") {
    next.certifications.push({ name: answer, sourceNotes: [answer] });
  } else if (area === "languages") {
    next.languages.push({ name: answer, abilities: [], evidence: answer });
  } else {
    next.otherExperience[0] ??= { details: [], sourceNotes: [] };
    next.otherExperience[0].details.push(answer);
    next.otherExperience[0].sourceNotes.push(answer);
  }
  return next;
}

export function structuredCvToLegacy(cv: StructuredCvData) {
  return {
    strengths: [...cv.profile.strengths, ...cv.profile.sourceNotes],
    workExperience: cv.workExperience.flatMap((item) => item.sourceNotes),
    education: cv.education.flatMap((item) => item.sourceNotes),
    languages: cv.languages.map((item) => item.name),
    certificates: cv.certifications.flatMap((item) => item.sourceNotes),
    extracurriculars: cv.otherExperience.flatMap((item) => item.sourceNotes),
  };
}