# Röst-CV

## Flöde och kostnad

- `gpt-4o-mini-transcribe` transkriberar svenska svar, högst 90 sekunder per inspelning. Tysta inspelningar pausas lokalt.
- `gpt-4o-mini` bedömer täckningen av varje fråga mot hela samtalet. Besvarade frågor, överhoppade områden och tidigare ställda frågor filtreras bort i kod. Högst 16 frågor per intervju.
- `gpt-4o-mini-tts`, röst `marin`, läser den fasta frågebanken. Ljud hämtas separat och återanvänds via en begränsad processcache samt HTTP-cache. Bara generiska frågor cachas. En kall server eller utgången cache kan behöva generera ljud igen.
- `gpt-4.1-mini` skriver hela CV:t vid användarens slutliga generering. Transkripten skickas en gång, med frågekontext, och hålls åtskilda från färdiga CV-fält. Extra uppgifter i sista formulärsteget inkluderas.
- Råanteckningar sparas inte automatiskt som ett färdigt CV. Misslyckad generering visas som ett fel med möjlighet att försöka igen. Användaren granskar CV:t innan text, profilfält och PDF sparas.

Serverinställningar: `OPENAI_API_KEY` krävs. `OPENAI_VOICE_INTERVIEW_MODEL` och `OPENAI_CV_MODEL` kan ersätta ovanstående textmodeller (de måste stödja Responses, strikt JSON-schema och temperatur). Ingen Groq-nyckel behövs för CV.

## Verifiering

```sh
npm run test:cv-quality
node --env-file=.env.local scripts/test-cv-quality.mjs --live
node scripts/test-voice-interview.mjs --skip-only
npm run build
```

Första testet är lokalt och kostnadsfritt. `--live` använder OpenAI med syntetiska uppgifter och kostar API-anrop. Det verifierar separata arbetsgivare, täckning mellan områden, negativa svar, skolprojekt, rättelser och svensk talgenerering/transkribering. Exempelresultat skrivs till `tmp/voice-quality/`. Intervjutestet kräver en lokal server på port 3000; utan `--skip-only` krävs även en ljudfil via `VOICE_TEST_AUDIO`.

Kontrollera dessutom manuellt på mobil: Starta → svara → automatisk turtagning → längre tankepaus → paus/fortsätt → hoppa över område → extra uppgifter → granska och spara. Kontrollera också blockerad ljuduppspelning och avbruten nätverksanslutning. API-tester bedömer inte hur rösten upplevs eller mikrofonens beteende på en fysisk telefon.

Officiell dokumentation: [Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
