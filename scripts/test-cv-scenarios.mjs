const scenarios = [
  {
    name: "young-without-work",
    body: {
      full_name: "Alex Test", city: "Malmö", email: "alex@example.se", target_job: "butik",
      profile_details: "Jag gillar att lösa praktiska problem och söker mitt första extrajobb.",
      strengths: "ansvarstagande,noggrann", education: "Teknikprogrammet på Testgymnasiet, examen 2027",
      projects_text: "Byggde en enkel webbplats i ett skolprojekt och ansvarade för layouten.",
      skills_text: "HTML,CSS", languages: "Svenska modersmål, Engelska god", extracurriculars: "Lagkapten i fotbollslaget",
    },
    requiredSections: ["UTBILDNING", "PROJEKT", "KOMPETENSER", "ÖVRIG ERFARENHET"],
  },
  {
    name: "experienced",
    body: {
      full_name: "Sam Test", city: "Göteborg", profile_details: "Söker en arbetsledande roll inom service.",
      work_experiences: Array.from({ length: 12 }, (_, index) => ({
        title: `Servicemedarbetare ${index + 1}`, company: `Företag ${index + 1}`, start_date: "2020", end_date: "2025",
        description: "Ansvarade för kundservice, planering och daglig samordning i team.",
      })),
      skills_text: "Kundservice,Planering,Teamarbete", education: "Gymnasieexamen", languages: "Svenska flytande",
    },
    requiredSections: ["ARBETSLIVSERFARENHET", "KOMPETENSER"],
  },
  {
    name: "fact-guard",
    body: { full_name: "Kim Test", projects_text: "Skapade en webbplats med React.", skills_text: "React" },
    requiredSections: ["PROJEKT", "KOMPETENSER"],
  },
];

for (const scenario of scenarios) {
  const response = await fetch("http://localhost:3000/api/youth/cv/generate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(scenario.body),
  });
  const result = await response.json();
  const words = String(result.cv ?? "").trim().split(/\s+/).filter(Boolean).length;
  const missing = scenario.requiredSections.filter((section) => !String(result.cv).includes(section));
  const invented = /Angular|Tyska|TypeScript/i.test(String(result.cv));
  if (!response.ok || !result.structured || words > 500 || missing.length || invented) {
    throw new Error(`${scenario.name} failed: status=${response.status}, words=${words}, missing=${missing.join(",")}, invented=${invented}`);
  }
  console.log(`${scenario.name}: ${words} words, sections OK, no control facts invented`);
}