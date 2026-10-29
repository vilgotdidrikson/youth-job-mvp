# L13 – privat ansökningsunderlag för intern exportgranskning

Reservation före kodarbete 2026-10-29: Vilgot / Codex, `codex/l13-private-review-reader-20261029`, från dev ec0582d. Aktuell dev och öppna PR:er kontrollerade. Fortsättning inom egen L13.

Bygg en snävt avgränsad serverintern läsning av ungdomens egna privata delningsunderlag och historiska bedömningar. Service-only RPC med uttryckligt ungdomsfilter, kolumnprojektion och sidgränser; ingen generell schema-/tabellåtkomst eller företagsutökning. Vanliga klienter ska inte kunna anropa den. Verifiera behörigheter och fel utan känsliga loggar. Ny autentisering, innehållsgranskning och säker exporthämtning återstår före användaraktivering. Ingen AI-användning eller produktionsändring. L13 fortsatt Pågår.


## Implementation och gräns

Migration `20261029101100_l13_private_export_review_reader.sql` inför en enda fast RPC: `read_personal_data_review_page(p_source, p_subject_id, p_after_id, p_limit)`. Funktionen är SECURITY INVOKER med tom search_path, fasta fullt kvalificerade tabeller och uttryckliga JSON-projektioner. EXECUTE återkallas från PUBLIC, anon och authenticated och beviljas enbart service_role. Dessutom krävs current_user = service_role; en JWT-rolluppgift ersätter inte databasrollen. Inga nya schema-/tabellrättigheter eller RLS-policyer införs.

Endast två källor tillåts: private.application_disclosures och public.candidate_assessments. Varje fråga kräver youth_user_id = uttryckligt konto-ID och en skyddad profiles-rad med role = youth. Företag kan inte användas som exportsubjekt. Läsningen begränsas till 1–100 rader per sida och strikt stigande UUID (job_id respektive id). Okänd källa, null-ID, fel subjekt eller ogiltig gräns avvisas. Ingen dynamisk SQL, historikmutation, filhämtning eller AI-användning.

Projektionen bevarar privata packet/matching_input samt äldre bedömningars result/criteria_snapshot för granskning; source_token och input_hash väljs inte på toppnivån. Nästlade JSON-fält är fortfarande originalunderlag och kan innehålla tredje persons information eller annat som kräver innehållsgranskning. Inget resultat är godkänt för direkt utlämnande.

`collectPersonalDataForReview(userClient, expectedSubjectId, signal?, reviewClient?)` använder separat serverkonstruerad serviceklient ENDAST till den fasta RPC:n. Begärande konto verifieras via den vanliga användarklientens getUser före och efter hela insamlingen. Före verifierad identitet sker ingen privilegierad läsning. Främmande rad eller kontobyte stoppar hela resultatet; läsfel kastar källans delresultat. Gemensamma budgetar, avbrytning och JSON-validering återanvänds. De övriga 34 källorna behåller användarens RLS-klient.

Utan reviewClient kvarstår de två privata källorna uttryckligen not_collected och visibility = caller_rls; med klienten anges subject_review. Alla 24 kategorier/85 relationer redovisas fortfarande och reviewState förblir pending. Med lyckad privat läsning omfattas totalt 36 källor. Ingen sida/API importerar insamlingen och ingen export aktiveras. Ny autentisering/revokeringskontroll krävs vid framtida beställning/hämtning; getUser ersätter inte detta.

## Faktiskt verifierat

120 lokala insamlingskontroller passerar, däribland 105 äldre bedömningar med korta sidor, eget privat delningsunderlag, främmande rad, källfel utan delresultat, extra/utelämnade fält, konto före/efter och installerad Supabase-SDK:s riktiga RPC-serialisering mot simulerad HTTP. Paketets 76 och inventeringens 21 regressioner, riktad ESLint, TypeScript, diff-check och produktionsbygge/57 routes passerar. Befintlig metadataBase-varning kvarstår.

`scripts/test-private-review-reader.sql` passerade först tillsammans med migrationskoden i en återställd transaktion och därefter mot den faktiskt införda funktionen i DevStaging. Tre tillfälliga identiteter, tre jobb, tre delningsunderlag och 106 bedömningar skapas enbart i samma transaktion som slutar med ROLLBACK. Inga lösenord/sessioner eller Auth API-registreringar används. Provet verifierar rätt ungdom, uteslutet främmande underlag, 105 äldre revisioner över sidgränser om sju, delningssidor om en, kolumnprojektion, skydd mot okända källor/injektion, ogiltig gräns/null/bolagssubjekt, SECURITY INVOKER och verkligt nekade anon/authenticated-anrop även med förfalskad JWT-roll. Detta är ett SQL-/rollprov, inte ett inloggat webbflöde eller riktig positiv service-HTTP-verifiering.

Ett separat verkligt anonymt HTTP POST mot RPC:n nekades med **401**. Efterkontroll visar anon_execute=false, authenticated_execute=false, noll temporära QA-identiteter, jobb och bedömningar. Migrationen finns i DevStagings migrationshistorik som **20261029101100**. Filen skapades med CLI migration new och synkroniserades sedan till den faktiskt införda versionen. Inga tabeller, kolumner, ägarrelationer eller buckets ändrades. Lokal `migration list --local` kunde inte verifieras eftersom lokal Postgres saknas (ECONNREFUSED 127.0.0.1:54322); aktuell remote-historik lästes via SQL.

Supabase security-advisors kontrollerades före/efter. Den nya funktionen flaggas inte; de tidigare kategorierna/antalet var oförändrade: 13 RLS utan policy, en pg_net i public, en anon- och 33 authenticated-körbara SECURITY DEFINER-funktioner samt avstängd leaked-password protection. Många är avsiktligt skyddade arbetsflöden eller service-only-tabeller, men ingen fullständig förnyad bedömning av dessa görs här. Relevanta befintliga underlag ligger i L05/L14; generella grants ändras inte för att tysta linter. [Funktionsbehörigheter](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Det första föreslagna HTTP-fixtureupplägget stoppades av automatisk granskning på grund av risken för kvarvarande testkonton. Inga sådana konton skapades. Det ersattes med den transaktionella kontrollen ovan. Första hopfogningen av SQL-testet hade ett dollar-escapingfel före körning av fixturedata; detta rättades och både slutkörningarna passerade.

## Återstår

Fullständig rättighets-/innehållsgranskning och maskering av tredje persons data, andra ej insamlade källor/legacy/Auth/Storage/externa/lokala uppgifter, verklig positiv service-HTTP och sammanhängande nyautentiserat användarflöde. Konsistens vid samtidiga ändringar, privat hämtning och paketfrist/gallring återstår. Funktionen begränsar läsning per sida, inte exakt databas-snapshot eller total framtida exportstorlek. L13 fortsatt Pågår. Produktion är orörd.
