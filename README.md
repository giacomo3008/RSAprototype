# RAS Agentica

Prototipo web funzionante per il coordinamento di una RSA, realizzato con **React 19, TypeScript, Vite e Tailwind CSS 4**. Interfaccia in inglese, dati esclusivamente fittizi, nessun servizio a pagamento o chiave AI necessario.

## Avvio rapido

Richiede Node.js **22.12+** (verificato con Node 24) e npm.

```bash
npm ci
npm run dev
```
   |

### Percorsi collegati

1. **Segnalazione**: da qualsiasi schermata assistenziale, un tocco su **Report event**. Seleziona tipo, residente o Other e luogo. Note, voce e foto sono facoltative. La priorità proposta segue esattamente gli otto tipi richiesti; le modifiche di priorità e orario sono conservate.
2. **Presa in carico**: aprire chat o leggere il report non assegna responsabilità. **Take charge** è una transazione esclusiva. Solo il responsabile può chiudere con un esito.
3. **Chat**: gruppo del reparto, messaggi diretti, thread evento e assistente privato. Testo, risposte, correzioni non distruttive, foto, voce e fonti persistono. **Create event** apre una bozza da confermare; un messaggio ordinario non crea eventi.
4. **Assistant**: prova i suggerimenti oppure una domanda su Cedar da Willow. Le risposte sono derivate deterministicamente dai record autorizzati attuali, con fonti apribili. Le richieste di modifica rimandano all'azione esplicita sul record; l'assistente non esegue mutazioni.
5. **OCR**: Diary → Capture document → Use synthetic sample → Attach. Correggi l'orario e conferma il testo. L'output originale resta disponibile; il medico esegue la validazione separata. Per immagini reali l'OCR automatico è esplicitamente non collegato e viene richiesta trascrizione manuale.
6. **Consegna**: aggiungi un contributo, prepara una nuova bozza con i record attuali, passa al coordinatore per revisione e firma, poi a un destinatario entrante per **Acknowledge this version**. Una versione firmata resta preservata; una nuova bozza è una versione di emendamento, con nuove firme richieste.
7. **Offline**: attiva Simulate offline e invia un evento. Rimane Queued, senza destinatari notificati. Disattivando la simulazione, lo stesso ID viene sincronizzato una sola volta, preservando l'orario di occorrenza. Se cambiano i permessi/assegnazioni, l'errore resta nella coda con Retry.
8. **Escalation**: Advance time +10 min rivaluta gli alert non presi in carico. Gli eventi non vengono duplicati e la presa in carico ferma promemoria/escalation.

Sono presenti due reparti, tre turni per reparto, residenti assegnati, personale presente/assente/occupato/in pausa, High non gestito, Medium preso in carico, Low senza alert, documento da revisionare e consegna firmata in attesa di acknowledgement.

## Regole e assunzioni della demo

- **High**: infermieri qualificati in servizio e coordinatore presente; escalation dopo **5 minuti**.
- **Medium**: infermieri qualificati in servizio, modalità operativa quiet; promemoria dopo **10 minuti**, escalation al coordinatore dopo **20 minuti**.
- **Low**: diario e fonti delle consegne, senza notifica mirata.
- I numeri sono **assunzioni dimostrative, non una policy clinicamente approvata**. Sono nel seed e nelle impostazioni riservate.
- Routing deterministico per reparto, ruolo, competenze (`care` o `safety`), check-in e disponibilità. Il personale in pausa o fuori servizio è escluso; il personale qualificato Busy resta eleggibile. Senza destinatari, l'evento resta visibilmente non gestito; non si inventano destinatari fuori ambito.
- Il demo clock può essere avanzato; l'escalation viene valutata da questo controllo, non da un job server sempre attivo.
- I turni sono scenari operativi sintetici, inizialmente Morning: non rappresentano un sistema di pianificazione basato sull'ora reale.
- Gestione medica e amministrazione non ereditano capacità cliniche. L'acknowledgement è limitato ai destinatari esplicitamente assegnati. Queste assunzioni conservative richiedono conferma della struttura prima della produzione.
- `Delivered` in chat significa salvato nel repository condiviso locale della demo. `Read` richiede apertura di una conversazione da parte della persona demo. Non è una garanzia di consegna a dispositivi o persone reali.
- Le schede browser dello **stesso origin** condividono IndexedDB e ricevono aggiornamenti via BroadcastChannel. La persona scelta è locale alla scheda già aperta; schede diverse possono usare persone diverse. Non è un servizio multiutente remoto.
- L'interfaccia usa risorse di traduzione con chiavi per i flussi principali (`src/i18n/en.ts`) e uno scaffold italiano disabilitato (`it.ts`). Date e ore usano `en-GB` e **Europe/Rome**. I record sintetici e i messaggi applicativi sono inglesi; completare l'estrazione delle stringhe secondarie prima di abilitare altre lingue.

## Struttura del codice

```text
src/
  domain/types.ts          entità, relazioni e contratto CareApi
  domain/permissions.ts    capacità esplicite per ruolo/reparto + eligibility
  domain/seed.ts           unico insieme connesso di dati fittizi
  services/repository.ts  repository async, transazioni IndexedDB, BroadcastChannel
  services/api.ts         operazioni autorizzate e orchestrazione deterministica demo
  services/contracts.ts   interfacce dei servizi funzionali sostituibili
  services/backend.ts     adattatore HTTP e contratto AgentProvider
  i18n/                   locale inglese, scaffold italiano, date di struttura
  components/             shell di lavoro, eventi, chat, OCR, consegne, console
  App.tsx                 sessione dimostrativa, navigazione e composizione
public/
  sw.js                   cache limitata alla shell pubblica
  manifest.webmanifest    shell PWA installabile dove supportata
  sample-document.svg     documento sintetico, non una fotografia reale
```

Una sola istanza logica dello stato collega le dodici entità operative e le entità di supporto. Il mapping protetto residenti/nome/stanza è separato dai riferimenti pseudonimizzati degli eventi. Le mutazioni sono transazioni, con idempotency key, correlation ID, versioni, firme e registrazioni audit/retention distinte. I test verificano anche la contesa usando due repository IndexedDB separati.

### Collegare FastAPI / LangGraph

1. Implementare sessioni corporate SSO/MFA nel backend. Le API devono ricavare identità, assegnazioni e capacità dall'account autenticato; **mai** fidarsi dei ruoli scelti dal browser.
2. Implementare i contratti di `CareApi` e delle interfacce in `services/contracts.ts` tramite endpoint FastAPI. `HttpCareApi` mostra il trasporto `credentials: include`; completare i metodi funzionali e aggiungere CSRF, validazione input ed errori strutturati prima di sostituire `DemoApi`.
3. PostgreSQL deve applicare transazioni e vincoli di unicità per idempotenza e claim. Media in object storage cifrato, riferimenti/fingerprint nel database e accesso autorizzato. Audit su archivio separato protetto.
4. L'orchestrazione LangGraph e gli eventuali provider AI vivono sul backend. Tutte le richieste degli agenti passano dal backend autenticato; nessuna chiave provider nel frontend.
5. Riutilizzare i test delle capacità e aggiungere test di contratto, autenticazione, concorrenza server, scope, provider e consegna notifiche.

## PWA, media e limiti espliciti

La build di produzione registra un service worker che conserva HTML/assets pubblici. Non mette API cliniche o media nella Cache API. L'installazione dipende dal browser e richiede un contesto sicuro (HTTPS; localhost è ammesso in sviluppo). Il dev server non registra il worker. Processi e connessioni non sopravvivono necessariamente al ripristino dell'ambiente: riavviare Vite con `npm run dev` nel checkout esistente, senza creare worktree salvo richiesta esplicita.

Camera e microfono usano `getUserMedia` e `MediaRecorder`: acquisizione, stop, riproduzione, scarto e durata per audio; anteprima, retake e attach per foto. Il file picker è un'alternativa esplicita. Le immagini caricate vengono ricodificate tramite canvas. La demo non scrive intenzionalmente nella galleria e non promette comportamento uniforme tra piattaforme. Se i permessi mancano, viene mostrato un errore reale e un campione sintetico chiaramente etichettato. La trascrizione della voce può essere inserita/revisionata manualmente, resta separata dall'audio e non blocca l'invio.

**Questa autorizzazione client-side non è un confine di sicurezza di produzione.** IndexedDB, localStorage, audit e retention contengono solo dati sintetici, ispezionabili e modificabili dall'utente del browser. Il reset demo sostituisce questi dati, senza promettere cancellazione sicura. I fingerprint dei media sono SHA-256; le snapshot di retention usano checksum dimostrativi FNV, senza garanzie crittografiche o di immutabilità.

Non sono collegati: autenticazione aziendale, database remoto, LangGraph/LLM reali, OCR automatico di immagini arbitrarie, STT automatico, storage protetto o push di sistema. L'assistente non formula diagnosi, trattamenti o punteggi clinici. Le firme sono registrazioni dimostrative, non firme digitali qualificate.

## Checklist implementazione e integrazioni successive

- [x] Modello connesso, servizi async, IndexedDB e permessi centralizzati.
- [x] Shell telefono/desktop, ruoli, Home, presenze e disponibilità.
- [x] Otto eventi, priorità, residenti assegnati/Other, media facoltativi, idempotenza.
- [x] Chat gruppo/diretta/evento/assistant, ricerca, risposte, versioni e fonti.
- [x] Inbox, claim atomico, chiusura, reminder/escalation dimostrativi.
- [x] Diario ricercabile, filtri e correzioni con storico.
- [x] Acquisizione documenti, OCR sintetico/revisione umana e validazione distinta.
- [x] Contributi, bozze derivate dalle fonti, revisione, firme, emendamenti e acknowledgement.
- [x] Coordinamento, aggregati con CSV autorizzato, account, integrazioni e audit di base.
- [x] Coda offline con rivalidazione e sincronizzazione senza duplicati; shell PWA.
- [ ] Approvare policy cliniche, fallback/escalation, destinatari, retention ed expiry.
- [ ] Completare i18n secondaria e revisione professionale delle traduzioni.
- [ ] Protezione offline di produzione, migrazioni e limiti quota media.
- [ ] DPIA, verifica vendor/security, hosting UE, cifratura, MFA, pseudonimizzazione e configurazione provider senza training reuse.
- [ ] Validazione intended-use, piattaforme push, payload lock-screen generico, acquisizione nativa e rimozione metadati su dispositivi reali.
- [ ] Integrazione HL7 FHIR, analytics avanzate/forecasting, editor no-code, modelli self-hosted e ricerca/export DPO avanzati: backlog, non funzioni simulate come connesse.

I controlli automatici e la demo non certificano GDPR, dispositivi medici, conservazione qualificata o sicurezza clinica di produzione.
