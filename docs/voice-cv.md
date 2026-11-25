# Röst-CV

## Flöde och kostnad

- `gpt-transcribe` transkriberar färdiga svenska inspelningar via `/v1/audio/transcriptions`, med `languages: ["sv"]`, inte det äldre `language`-fältet. Högst 90 sekunder per inspelning. Tysta inspelningar pausas lokalt.
- `gpt-6-luna` bedömer täckningen med Responses och `reasoning.effort: "none"`. Besvarade frågor, överhoppade områden och tidigare ställda frågor filtreras bort i kod. Högst 16 frågor per intervju.
- `gpt-realtime-2.1-mini`, röst `marin`, läser den fasta frågebanken via serverns Realtime-WebSocket. En textpost skickas och ljudets PCM-delar samlas till WAV (mono, 24 kHz, 16 bit). Den gamla Speech-endpointen används inte. Generering begränsas till 20 sekunder och 2 MB PCM; ofullständiga svar/fel cachas inte. Bara generiska frågor cachas. Modell/röst/format ingår i cachenyckeln och ljud-URL har version 3.
- `gpt-6-luna` skriver hela CV:t och hämtar fakta från redigerad text med Responses, strikt JSON-schema och `reasoning.effort: "none"`. Transkripten skickas en gång med frågekontext. Faktagranskning och uttryckligt godkännande kvarstår.
- Det separata WebRTC-samtalet använder `gpt-realtime-2.1` i stället för pensionerade `gpt-realtime`, med oförändrat avslutningsverktyg och användarstyrd slutbekräftelse.
- Råanteckningar sparas inte automatiskt som ett färdigt CV. Misslyckad generering visas som ett fel med möjlighet att försöka igen. Användaren granskar CV:t innan text, profilfält och PDF sparas.

Serverinställningar: `OPENAI_API_KEY` krävs. `OPENAI_VOICE_INTERVIEW_MODEL` och `OPENAI_CV_MODEL` kan ersätta textmodellerna. `OPENAI_SPEECH_MODEL` kan välja en kompatibel Realtime-uppläsningsmodell; `OPENAI_REALTIME_MODEL` gäller WebRTC-samtalet. Kända pensionerade text- och Realtime-modellnamn, även daterade snapshots, mappas till sina aktuella ersättare. Behörigheter, kvoter och `NEXT_PUBLIC_VOICE_CV_ENABLED` ändras inte. Ingen Groq-nyckel behövs.

Verifiering av modellflytten: `npm run test:openai-migration` kör modell-/parameterkontroller, simulerade Realtime-händelser inklusive fel, timeout och avbrott samt verklig SDK-serialisering av transkriberingsbegäran mot simulerad transport. `npm run test:cv-quality -- --live` kräver konfigurerad OpenAI-nyckel och kör även ett riktigt svenskt ljudvarv. Godkända kontraktstester bevisar inte faktisk modellåtkomst eller uttalskvalitet; röstfunktionen får inte aktiveras utan separat liveverifiering.

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
