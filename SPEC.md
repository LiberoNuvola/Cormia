# IMMORTAL Autonomous Execution Protocol
## Architettura normativa — Draft v0.1.0

**Stato:** Architecture Draft / Non-production / Prior-art-informed
**Data:** 2 novembre 2026
**Rete iniziale proposta:** Cardano
**Repository:** `LiberoNuvola/Cormia` (pubblicato su GitHub; branch `main`; baseline iniziale del 2 novembre 2026)
**Relazione con `LiberoNuvola/Immortal-Protocol`:** progetto fratello, non sostituzione né estensione implicita
**Lingua normativa:** italiano; nomi di stato e interfacce in inglese per interoperabilità

> Questo documento fissa i confini architetturali e le invarianti del protocollo. Non è un'implementazione, un audit, una garanzia di sicurezza o una dichiarazione di novità scientifica. I parametri economici, le soglie, gli algoritmi di selezione e le scelte crittografiche che richiedono evidenze restano esplicitamente aperti.

---

## 0. Convenzioni normative

Le parole **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **MAY** e **OPTIONAL** sono usate nel significato convenzionale definito da RFC 2119 e RFC 8174. Una prescrizione MUST è requisito di conformità; SHOULD ammette eccezioni motivate e documentate; MAY indica una scelta d'implementazione.

Le prescrizioni di questo documento si applicano al protocollo e alle implementazioni conformi, non trasformano automaticamente il prototipo IMMORTAL Local Agent v0.8.0 in un'implementazione conforme.

## 1. Abstract

IMMORTAL Autonomous Execution Protocol (IMMORTAL-AEP) è un protocollo aperto per pubblicare, assegnare, eseguire, verificare e liquidare task digitali attraverso una rete permissionless di worker e verificatori indipendenti.

Il protocollo separa:

1. **Autorità e stato economico on-chain:** autorizzazioni, manifest immutabili, escrow, bond, transizioni di stato, contestazioni e settlement.
2. **Esecuzione off-chain:** inferenza AI, pianificazione, compilazione, test, accesso a strumenti e produzione degli artefatti.
3. **Verifica:** controlli deterministici, riesecuzione indipendente, quorum, prove crittografiche e procedure di contestazione con garanzie dichiarate.
4. **Governance:** evoluzione pubblica e versionata delle regole, senza potere di alterare retroattivamente gli obblighi economici già assunti.

Il protocollo mira a consentire autonomia end-to-end entro limiti e profili dichiarati, senza richiedere approvazione umana per ogni singola operazione. Non promette che qualsiasi lavoro soggettivo, fisico o dipendente da dati esterni possa diventare trustless: per ogni task deve essere dichiarato cosa viene effettivamente verificato e quali assunzioni di fiducia rimangono.

## 2. Obiettivi e non-obiettivi

### 2.1 Obiettivi

IMMORTAL-AEP MUST:

- permettere a requester, worker e verifier di partecipare senza whitelist discrezionali del gestore del protocollo;
- rendere il task manifest, il budget, le capability e il profilo di verifica verificabili prima dell'esecuzione;
- vincolare le transizioni economiche a regole pubbliche e deterministiche;
- separare la proposta del modello AI dall'autorizzazione delle operazioni;
- limitare ogni worker al perimetro di capability concesso dal task;
- supportare esecuzione off-chain e settlement on-chain;
- produrre evidenze legate crittograficamente a task, artefatti, ambiente e verdetto;
- consentire contestazioni e percorsi di uscita quando worker o verifier non completano il proprio obbligo;
- preservare la possibilità di sostituire modello, runtime, hardware e provider senza cambiare il significato normativo del task;
- rendere ripetibili test di conformità e vettori di transizione.

### 2.2 Non-obiettivi della prima versione

La prima versione NON MUST:

- eseguire codice arbitrario direttamente nei validator on-chain;
- richiedere una singola implementazione AI, un singolo modello o un singolo cloud provider;
- promettere correttezza semantica universale del software prodotto da un modello;
- considerare reputazione, stake o numero di repliche come prova assoluta di verità;
- eseguire azioni fisiche o irreversibili nel mondo reale senza un profilo di rischio e autorizzazione separato;
- custodire segreti, dataset privati o interi artefatti nel ledger pubblico;
- importare automaticamente costanti, token, coefficienti, soglie o policy economiche da PRE-RICH o da altri moduli di `Immortal-Protocol`;
- consentire al Runtime di aggiornare da solo i validator, le policy attive o le proprie autorizzazioni.

La prima classe di task raccomandata è **digital work verificabile**: build, test, audit circoscritti, trasformazioni di codice, produzione di artefatti e benchmark con input e criteri dichiarati.

## 3. Principi invarianti

### P-01 — On-chain authority, off-chain execution

Il ledger è la fonte autorevole per le regole e le transizioni economiche registrate. Il Runtime esegue il lavoro e costruisce transazioni; non può riscrivere lo stato on-chain né auto-attribuirsi autorizzazioni.

### P-02 — Trust is explicit and task-scoped

Ogni task MUST dichiarare un assurance profile e le sue assunzioni. “Trustless” non è un'etichetta generica del sistema: è una descrizione limitata alle proprietà provate dal profilo scelto.

### P-03 — Least privilege and capability attenuation

Ogni capability MUST essere esplicita, limitata al task, revocabile dove tecnicamente possibile e non più ampia della capability delegante. Il worker MUST NOT ricevere accesso generale al filesystem host, credenziali permanenti o shell illimitata per default.

### P-04 — No model authority

Un modello AI MAY proporre piani, codice, strumenti e risultati. MUST NOT essere l'autorità che determina autonomamente permessi, fondi, verdetti finali o promozione del proprio codice.

### P-05 — Evidence before settlement

Il pagamento MUST dipendere da una regola di verifica dichiarata nel manifest e da evidenze collegate al task. Una risposta testuale del worker o del modello non è prova sufficiente di completamento.

### P-06 — Immutable commitments, versioned policy

Dopo il funding, scope, budget massimo, capability, assurance profile e criteri di accettazione MUST essere immutabili. Le modifiche richiedono cancellazione/chiusura e un nuovo task, oppure un amendment esplicitamente co-firmato e finanziato, mai una modifica unilaterale retroattiva.

### P-07 — Fail closed, recover safely

In presenza di stato ambiguo, telemetria incompleta, prova non valida, verifier non disponibile o timeout, il sistema MUST evitare settlement positivo non dimostrato. MUST offrire transizioni di recovery, refund o dispute definite dal protocollo; non deve lasciare fondi bloccati senza una via di uscita.

### P-08 — No privileged operator

Nessun maintainer, runtime provider, verifier singolo o council MUST poter modificare unilateralmente un task finanziato, appropriarsi dell'escrow o promuovere una versione del protocollo senza le procedure pubbliche previste.

### P-09 — Local-first and reciprocal access

L'uso local-only di un modello open-weight MUST rimanere possibile senza account, wallet, subscription o API-token billing, nei limiti dell'hardware e della licenza del modello. L'accesso a inferenza condivisa MAY usare un diritto di consumo non trasferibile guadagnato tramite contributi utili verificati (Compute Reciprocity Credits). Il protocollo MUST NOT trasformare implicitamente tali crediti in un asset trasferibile o in una promessa di rimborso monetario.

### P-10 — No hidden remote fallback

Il Runtime MUST rendere visibile se una richiesta è locale o viene inviata a un peer remoto. MUST NOT inviare prompt a un provider esterno, a un peer o a un modello cloud senza la scelta esplicita prevista dal profilo privacy/task. L'esaurimento dei crediti o l'indisponibilità della rete MUST NOT generare addebiti nascosti: il client resta local-only, mette in coda o usa un pool sponsorizzato dichiarato.

### P-11 — Useful work before reciprocity credit

Il Runtime MUST NOT attribuire crediti spendibili per la sola disponibilità del nodo, il tempo online, l'hardware dichiarato o metriche auto-riferite non verificate. L'accredito richiede una receipt legata a task, workload, runtime, input/output commitment e controlli previsti dal profilo. La receipt è evidenza, non prova automatica di correttezza semantica.

## 4. Modello degli attori

- **Requester:** pubblica il task e deposita il budget.
- **Worker:** accetta ed esegue il task; può essere un nodo locale, server, cluster o servizio gestito da un'organizzazione.
- **Verifier:** valuta la delivery secondo il profilo dichiarato. Deve essere distinto dal worker per i profili che richiedono indipendenza.
- **Challenger:** presenta una contestazione supportata da evidenze e, dove previsto, deposita un challenge bond.
- **Arbitrator / Appeal verifier:** risolve solo i casi non decidibili con le verifiche automatiche ordinarie. Il suo potere e le assunzioni di fiducia MUST essere dichiarati.
- **Runtime:** software locale o distribuito che pianifica ed esegue il lavoro.
- **Protocol adapter:** traduce gli oggetti e le transizioni normative nella rete di settlement scelta.
- **Governance participants:** propongono e approvano modifiche alle regole comuni tramite procedure versionate.
- **Storage providers:** conservano input, output e prove fuori catena; non diventano fonte di verità per il loro contenuto solo perché ne ospitano i byte.

Un soggetto può assumere più ruoli solo quando il profilo lo consente esplicitamente. Worker e verifier dello stesso task MUST NOT essere la stessa identità logica nei profili che dichiarano verifica indipendente. Il protocollo deve comunque considerare il rischio Sybil: chiavi e account distinti non dimostrano titolarità indipendente.

## 5. Modello di fiducia e livelli di assurance

I livelli seguenti descrivono la forza e il tipo di evidenza; non sono una scala universale in cui ogni livello superiore risolve ogni rischio.

| Profilo | Garanzia verificabile | Limite residuo | Uso indicativo |
|---|---|---|---|
| A0 — Self-asserted | Dichiarazione firmata dal worker | Nessuna prova indipendente di esecuzione o correttezza | Task non economici / preview |
| A1 — Integrity-bound | Hash di manifest, input commitment, artefatti e log | Dimostra integrità dei byte, non correttezza del risultato | Archiviazione e audit |
| A2 — Deterministic verification | Test, build o trasformazione ripetibile eseguita in ambiente identificato | Dipende da correttezza dei test, toolchain e determinismo | Software testabile |
| A3 — Independent verification | Riesecuzione o controlli da verifier indipendenti, con quorum e contestazione | Collusione/Sybil e differenze ambientali restano possibili | Task di valore medio/alto |
| A4 — Cryptographic execution proof | Prova verificabile che un programma/ambiente/input impegnato ha prodotto una certa esecuzione o output | La prova non dimostra che il programma, il dataset o la specifica siano semanticamente corretti | Task con circuito/VM e statement formalizzabili |
| S — Subjective/external assurance | Valutazione umana, oracle, attestazione hardware o fonte esterna dichiarata | Introduce un'assunzione di fiducia specifica; non è trustless puro | Task soggettivi o dipendenti dal mondo esterno |

Ogni task MUST selezionare un profilo, dichiarare l'oggetto della prova e indicare le assunzioni non eliminate. Un task ad alto impatto MUST NOT usare A0 o A1 come unica base per un settlement automatico.

Il protocollo SHOULD favorire prima le prove deterministiche economiche (A2/A3 dove applicabili). ZK, zkML e TEE sono opzioni selettive, non requisiti universali. Una TEE richiede fiducia nel produttore hardware, firmware, remote-attestation chain e configurazione. Una prova ZK prova solo lo statement formalizzato, non la qualità della specifica né la verità di input non autenticati.

## 6. Task Manifest

Il **Task Manifest** è il contratto macchina-leggibile del task. Deve essere canonicalizzato e firmato dal requester; il suo digest è impegnato on-chain al funding.

Campi REQUIRED della v1:

- `protocolVersion` e `manifestSchemaVersion`;
- `taskId` univoco e `requesterId`;
- `taskClass` e descrizione dello scope;
- `acceptanceCriteria` strutturati e testabili;
- `inputCommitments` e riferimenti ai dati off-chain;
- `deliverableSchema` e `outputCommitments` attesi;
- `capabilitySet` con azioni, risorse, percorsi e limiti consentiti;
- `budget` con asset, importo massimo, fee e destinazione di refund;
- `workerBondProfile` e `verifierBondProfile`, se richiesti;
- `assuranceProfile` e `verifierSelectionProfile`;
- `deadline`, `submissionWindow` e `challengeWindow`;
- `resourceProfile` (limiti/necessità dichiarati senza assumere telemetria vera del worker);
- `privacyClass`, retention e regole di divulgazione;
- `cancellationPolicy`, `failurePolicy` e `disputePolicy`;
- `evidenceFormat` e riferimento alle versioni di toolchain/container ammesse.

I campi finanziari e di policy MUST essere leggibili e verificabili prima del funding. Gli hash on-chain MUST essere domain-separated e riferirsi alla codifica canonica documentata. I riferimenti off-chain MUST essere accompagnati da hash; un URL da solo non è un commitment del contenuto.

Il manifest MUST NOT contenere segreti, chiavi private, token di accesso o dati personali non necessari. Il ledger dovrebbe contenere soltanto gli impegni e i metadati minimi necessari.

## 7. Ciclo di vita normativo del task

La macchina a stati canonica è:

`Draft → Funded → Open → Assigned → Running → Submitted → Verifying → ChallengeWindow → Settled`

Transizioni terminali o alternative:

`Cancelled`, `Expired`, `Failed`, `Refunded`, `Disputed`, `Slashed`.

### 7.1 Stati

1. **Draft:** il requester prepara e firma il manifest. Nessun obbligo economico è attivo.
2. **Funded:** l'escrow contiene l'intero budget richiesto e il digest del manifest è impegnato.
3. **Open:** il task è pubblicamente disponibile ai worker idonei secondo il profilo.
4. **Assigned:** un worker è stato selezionato secondo la regola dichiarata; l'eventuale bond è bloccato.
5. **Running:** il worker esegue il task off-chain entro capability e deadline.
6. **Submitted:** il worker pubblica una delivery e un evidence commitment prima della scadenza.
7. **Verifying:** i verifier applicano il profilo richiesto e pubblicano verdetti firmati e legati alla delivery.
8. **ChallengeWindow:** il risultato è contestabile per la finestra definita nel manifest.
9. **Settled:** la regola di settlement è soddisfatta; pagamento e restituzione dei bond avvengono secondo il ledger.
10. **Disputed:** esiste una contestazione valida che sospende il settlement interessato fino alla risoluzione o al timeout di fallback.
11. **Failed / Expired:** il task non ha prodotto delivery valida entro la scadenza oppure è fallito secondo una regola oggettiva.
12. **Cancelled / Refunded:** chiusura o rimborso secondo regole predefinite, senza cancellare la traccia storica.
13. **Slashed:** penalità applicata solo quando una violazione definita e dimostrata dal profilo è stata accertata.

### 7.2 Invarianti delle transizioni

- Nessun task può entrare in `Open` senza funding completo e manifest impegnato.
- Nessun worker può iniziare un task che richiede bond prima che il bond risulti bloccato.
- `Submitted` deve riferirsi allo stesso task, manifest digest e worker assegnato.
- Una delivery non può essere sostituita silenziosamente dopo la submission; una nuova versione richiede un nuovo commitment e una regola di resubmission esplicita.
- Nessun pagamento finale può precedere la verifica e la finestra di contestazione prevista.
- Una transizione terminale non può essere riaperta unilateralmente; un nuovo lavoro richiede un nuovo task o una procedura di appello definita.
- Ogni transizione deve essere idempotente o proteggersi da replay e doppia esecuzione economica.

## 8. Capability e delega

Il Task Manifest MUST definire un set di capability minimo. La capability è un'autorizzazione, non una descrizione informale.

Le capability possono includere, in forma tipizzata:

- lettura di input specifici;
- scrittura in una directory di workspace dedicata;
- accesso a repository/branch specifici;
- esecuzione di comandi allowlisted;
- accesso alla rete verso endpoint dichiarati;
- uso di CPU/RAM/GPU entro un profilo;
- esecuzione di build e test in sandbox;
- pubblicazione di artefatti e prove.

Il Runtime MUST applicare least privilege, isolamento dei task e credenziali effimere. La capability MUST essere attenuata quando delegata a subtask o agenti secondari. Il delegante resta responsabile di non delegare poteri maggiori di quelli ricevuti.

La sandbox è una misura di contenimento, non una prova matematica di assenza di escape. Il protocollo deve dichiarare le garanzie dell'ambiente, la sua versione e i limiti noti.

## 9. Modello economico

La v1 adotta un modello **escrow-first**. Nessun importo o coefficiente economico è fissato da questo documento.

### 9.1 Flussi economici

- **Requester escrow:** budget massimo depositato prima che il task sia aperto.
- **Worker bond:** garanzia del worker, richiesta in funzione del rischio e del profilo; può essere zero per task a basso rischio.
- **Verifier bond:** garanzia per profili nei quali il verifier può influire sul settlement e la sua responsabilità è definibile.
- **Challenge bond:** deposito richiesto al challenger solo quando serve mitigare contestazioni spam; deve essere proporzionato e non deve impedire contestazioni legittime.
- **Verifier reward:** remunerazione dei controlli validi, indipendente dal fatto che il verdetto piaccia al requester o al worker.
- **Protocol fee:** eventuale commissione dichiarata nel manifest o nel parametro versionato applicabile al momento del funding.

### 9.2 Settlement

Il settlement MUST essere derivabile da:

1. manifest immutabile;
2. stato on-chain;
3. delivery commitment;
4. verdetti ammessi dal profilo;
5. outcome di eventuale contestazione;
6. regola economica versionata al funding.

Il worker MUST ricevere la ricompensa quando i criteri oggettivi sono soddisfatti e nessuna contestazione valida resta aperta. Il requester MUST ricevere il rimborso previsto quando il task fallisce secondo condizioni oggettive. Le penalità MUST essere applicate solo per violazioni enumerate, non per semplice dissenso o qualità soggettiva non formalizzata.

### 9.3 Regole ancora aperte

Devono essere definiti tramite analisi economica, simulazioni e test adversarial:

- asset di settlement iniziali e rischio di liquidità/issuer;
- criterio di assegnazione worker (first-accept, asta, matching o combinazione);
- entità e dinamica dei bond;
- distribuzione delle ricompense verifier;
- quote di protocollo e costi di storage/settlement;
- meccanismo anti-Sybil;
- politica di insolvenza, timeout e recovery;
- eventuale assicurazione o risk pool.

Nessun token nativo, coefficiente, soglia, rapporto di collateralizzazione o formula di penalità è approvato da v0.1.0. Non importare parametri di PRE-RICH o di altri sistemi senza una decisione architetturale e un'analisi separata.

### 9.4 Local-first AI access and Compute Reciprocity Credits

La prima esperienza utente proposta prevede tre modalità: (L) local-only, senza account/wallet/subscription/API-token billing; (R) reciprocal mesh, nel quale contributi utili accettati generano Compute Reciprocity Credits (CRC) non trasferibili che danno accesso a inferenza condivisa; (C) community-sponsored pool, con capacità limitata e fonti di finanziamento pubbliche. I dettagli sono descritti in [`docs/economics/COMPUTE_RECIPROCITY.md`](docs/economics/COMPUTE_RECIPROCITY.md) e [`docs/economics/NO_MANDATORY_CASH_MODEL.md`](docs/economics/NO_MANDATORY_CASH_MODEL.md).

I CRC v1 sono diritti d'uso interni, non cryptocurrency, non un native token, non un credito in denaro e non sono riscattabili o trasferibili. Il local-only mode MUST funzionare anche offline e con saldo CRC nullo. L'uso local-only MUST NOT richiedere account, wallet o chiave di protocollo. Per il mesh, il client SHOULD generare localmente una chiave di protocollo non custodial; questa non è un wallet Cardano né un account presso un operatore. La policy di backup/recovery MUST essere esplicita e non introdurre un identity administrator privilegiato. Il network mode MUST dichiarare il consumo del diritto d'uso e non presentarlo come API-token price. Nessun conversion ratio è fissato da questa specifica.

L'accesso gratuito alla rete senza contributo dipende da un pool sponsorizzato/donativo limitato; il protocollo MUST NOT promettere capacità remota illimitata senza una fonte di compute. L'utilizzo locale rimane disponibile indipendentemente dalla capienza del pool.

### 9.5 Contribution receipts and epoch accounting

Un worker SHOULD produrre una `ComputeContributionReceipt` versionata, con task/workload identity, digest di modello/runtime, input/output commitments, misure, nonce, firme, evidence references e stato di verifica. Lo schema iniziale è [`schemas/compute-contribution-receipt.schema.json`](schemas/compute-contribution-receipt.schema.json).

Una receipt `provisional`, `challenged` o `rejected` MUST NOT creare CRC spendibili. Un receipt firmato dimostra chi ha sottoscritto la dichiarazione, non che il GPU abbia eseguito correttamente ogni istruzione. L'accredito richiede il livello di assurance previsto dal task/profile: model identity probes, requester acknowledgement, randomized audits, selective replication, task-specific checks o profili più forti quando disponibili. Le assunzioni residue MUST essere registrate.

Per evitare una transazione Cardano per ogni richiesta, l'accounting ad alta frequenza SHOULD restare off-chain e ricostruibile da receipts firmate, con commitment aggregati per epoch sul ledger. Il ledger verifica commitments, firme, replay protection, finestre temporali e value flow secondo le regole; non esegue inferenza né certifica direttamente il lavoro GPU. La data availability e le challenge delle radici/receipts sono requisiti normativi da completare prima del settlement reale.

### 9.6 Normalized Useful Work Unit

Il concetto di `Normalized Useful Work Unit` (NUWU) potrà normalizzare il contributo rispetto a modello, quantizzazione, workload, contesto, output, hardware e verifica. La formula, la suite benchmark, i pesi, l'audit sampling, la frequenza degli epoch e il rapporto tra CRC guadagnati e spesi restano OPEN. Nessuna formula basata solo su GPU seconds, FLOPs dichiarati, output-token count o reputazione è approvata.

### 9.7 Privacy classes for local and remote inference

Il Task Manifest e il Runtime SHOULD distinguere almeno: `P0 local-only`; `P1 shared peer` (il peer riceve prompt in chiaro per poter inferire); `P2 attested execution` (se/solo se esiste una catena TEE verificabile); `P3 split inference` (con rischio di leakage dagli activations e collusione). Crittografia del trasporto non rende segreto il prompt al peer destinatario. P0 è il default per task sensibili. Fallback cloud esterni richiedono opt-in esplicito.

### 9.8 Resource donation boundaries

La condivisione CPU/GPU/RAM/network/disk MUST essere opt-in e revocabile. Il Resource Manager governa lease, admission control, preemption dell'utente, limiti termici/alimentazione, RAM/VRAM, concorrenza e rilascio dopo errori. Il percorso inference-only MUST NOT eseguire shell o codice arbitrario fornito da un requester sul sistema host.

### 9.9 Prior-art boundary

L'accesso a AI attraverso compute condiviso e crediti non è rivendicato come invenzione originale di AEP. Senda, Decoupled AI, Petals, BOINC, Golem e Morpheus rappresentano prior art da comparare. Il possibile contributo AEP è l'integrazione normativa con Task Manifest, capabilities, Resource Manager, Flux Point DoD/graph, JEV evidence registry, Mitsuro read-only observer, persistent self-improvement, Cardano epoch anchoring, dispute e governance. Vedere [`docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md`](docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md).

### 9.10 Open economic decisions

Restano OPEN: CRC conversion, N-UWU benchmark, credit expiry, audit probability, verifier quorum, epoch length, challenge windows, sponsor allocation, group balance pooling e policy contro collusione/Sybil. Nessun valore numerico viene approvato da v0.1.x.

## 10. Verifica e Evidence Package

Ogni delivery MUST generare un **Evidence Package** con identificativo e digest. Il contenuto esatto dipende dal profilo, ma per software work dovrebbe includere:

- task ID e manifest digest;
- worker identity e versione runtime;
- hash di sorgenti, patch e artefatti;
- digest degli input pubblicabili o commitment dei dati privati;
- immagine/container e toolchain identificati;
- comandi e test eseguiti;
- exit code, log e risultati strutturati;
- benchmark e workload identificati, se richiesti;
- timestamp/slot e sequenza degli eventi;
- attestazioni o proof object, quando previsti;
- verifier identity, profilo, versione del verifier e verdict.

La prova MUST legare il risultato al task e alla versione precisa dell'artefatto giudicato. Una prova su un artefatto non può giustificare il pagamento per un artefatto diverso.

### 10.1 Regole per i verifier

- I verifier MUST essere selezionati secondo un profilo pubblico e verificabile.
- I conflitti di interesse MUST essere dichiarati e gestiti.
- I verifier MUST produrre verdict firmati e motivazioni strutturate.
- I verifier MUST NOT ricevere potere di modificare il manifest o trasferire escrow autonomamente.
- Il numero dei verifier, la soglia di quorum e la loro selezione sono parametri da definire con analisi di collusione e costi.
- La reputazione può essere un segnale, non una prova di correttezza.

## 11. Dispute e contestazioni

Il protocollo MUST supportare una procedura di challenge per i profili che prevedono settlement contestabile.

Una contestazione valida MUST:

- riferirsi a task, delivery e verdetto esatti;
- indicare una violazione del manifest o del profilo di verifica;
- allegare commitment/evidenze verificabili;
- essere presentata entro la challenge window;
- rispettare il bond, se previsto dal profilo.

Il percorso di risoluzione SHOULD seguire questa priorità:

1. verifica deterministica ripetibile;
2. riesecuzione da verifier indipendenti;
3. verifier di appello o quorum alternativo;
4. arbitrato esplicitamente trust-bearing per casi soggettivi o non formalizzabili.

Il protocollo MUST distinguere `inconclusive` da `invalid` e da `failed`. L'assenza di dati non è automaticamente prova di frode. Ogni timeout deve produrre un esito di fallback dichiarato: refund, retry, proroga consentita o arbitrato; mai blocco indefinito dei fondi.

L'arbitrato umano può rendere il sistema operativo per task soggettivi, ma quel percorso MUST essere etichettato come dipendente da fiducia nell'arbitro e non presentato come trustless.

## 12. Sicurezza e threat model

Il modello di minaccia MUST considerare almeno:

- Sybil e identità multiple controllate dallo stesso soggetto;
- collusione requester/worker/verifier;
- verifier selezionati o finanziati in modo da creare conflitti;
- task manifest malevoli, ambigui o modificati dopo il funding;
- replay, doppio settlement, race tra transazioni e stato obsoleto;
- task spam, resource exhaustion e denial of service;
- compromissione del worker, runtime, modello, container, host o storage;
- esfiltrazione di input, segreti o dati personali;
- prompt injection e tool output ostili;
- dipendenze/software supply-chain compromessi;
- falsificazione o alterazione delle evidenze;
- indisponibilità/censura della rete, storage o verifier;
- chiavi compromesse, rotazione e recupero identità;
- bug nei validator, errori di accounting e fondi bloccati;
- governance capture e modifiche parametriche opportunistiche.

### 12.1 Requisiti minimi

Il protocollo MUST:

- usare transizioni esplicite e verificabili;
- proteggere da replay e doppio pagamento;
- validare owner, task ID, manifest digest, asset e importi;
- limitare dimensioni e complessità dei dati on-chain;
- definire percorsi di refund/timeout;
- separare dati privati da commitment pubblici;
- richiedere audit e test adversarial prima di mainnet;
- mantenere una threat model aggiornata per ogni release normativa.

Il Runtime MUST:

- eseguire in sandbox con filesystem, rete e processi limitati;
- usare credenziali effimere e scope ristretto;
- non interpretare tool output come istruzioni di sicurezza;
- registrare le azioni effettive, non soltanto il testo generato dal modello;
- separare policy engine dal modello;
- mantenere checkpoint persistenti indipendenti dalla cronologia LLM;
- fermare o sospendere task se i controlli di risorse o capability non sono verificabili.

## 13. Cardano: mapping architetturale iniziale

Cardano è la prima rete di settlement proposta. La scelta non implica che il protocollo debba diventare inseparabile dal ledger.

Il modello eUTXO è adatto a rappresentare stato e fondi attraverso output consumati e ricreati. I validator Cardano verificano transizioni proposte; non sono agenti attivi, non avviano inferenze, non interrogano API esterne e non eseguono il task off-chain. La costruzione e la submission delle transazioni restano responsabilità dei componenti off-chain. Questo confine è coerente con la documentazione ufficiale Cardano sul modello eUTXO e sui validator [C1][C2].

### 13.1 Responsabilità on-chain

I validator e le policy SHOULD limitarsi a verificare:

- validità di task state transition;
- presenza e correttezza del manifest digest;
- funding e asset dell'escrow;
- identità/ruolo e autorizzazioni richieste;
- bond, limiti e condizioni di release/refund;
- commitment di delivery/verdict ammessi;
- timeout e finestre di validità;
- assenza di doppio settlement.

### 13.2 Responsabilità off-chain

Il Runtime e i transaction builder gestiscono:

- discovery e matching dei task;
- selezione worker/verifier secondo regole pubbliche;
- inferenza e pianificazione;
- esecuzione, build e test;
- generazione/archiviazione Evidence Package;
- preparazione e submission delle transazioni;
- monitoraggio, retry e gestione delle race sugli UTxO.

### 13.3 Vincoli eUTXO da rispettare

- Le transazioni consumano input e producono output; il medesimo UTxO non può essere speso due volte.
- I validator devono essere deterministici e limitati dal budget di esecuzione.
- Concorrenza, contesa sugli UTxO e costi di transazione devono essere modellati esplicitamente.
- I dati completi di task, log e artefatti non devono essere inseriti on-chain: il ledger conserva commitment e stato minimo.
- La struttura precisa degli UTxO, gli asset beacon, i reference inputs, il batching e le politiche di contention restano oggetto di ADR e test di costo.

La documentazione ufficiale Cardano evidenzia anche rischi specifici a carico dello sviluppatore, tra cui datum hijacking, double satisfaction, token forgery, resource exhaustion e fondi bloccati. Questi rischi MUST essere coperti dai test e dagli audit del protocollo [C2].

## 14. Runtime locale e worker reference

IMMORTAL Local Agent v0.8.0 è un prototipo da cui derivare il primo Runtime/worker, non la fonte normativa del protocollo.

Il Runtime conforme SHOULD essere composto da:

1. **Protocol client:** legge task e stato on-chain.
2. **Policy/capability engine:** autorizza o nega ogni operazione sulla base del manifest.
3. **Task engine:** DAG, stato persistente, checkpoint, retry e resume.
4. **Model gateway:** Granite o modelli sostituibili.
5. **Resource manager:** lease CPU/RAM/GPU, limiti di concorrenza, timeout e recovery.
6. **Execution sandbox:** ambiente isolato per codice e tool.
7. **Evidence builder:** produce package e commitment.
8. **Chain adapter:** prepara transazioni coerenti con gli stati normativi.
9. **Audit journal:** registra eventi append-only e rileva alterazioni.

Il Runtime MUST essere sostituibile: nessun task o fondo deve dipendere dall'esistenza di una specifica Control Room o dal processo di un singolo computer.

La perdita della cronologia LLM MUST NOT causare perdita dello stato del task. Il task state persistente e la sequenza degli eventi sono autorevoli; il contesto conversazionale del modello è ricostruibile e non normativo.

## 15. Governance e aggiornamento del protocollo

La governance deve essere aperta e permissionless, ma non deve avere potere retroattivo sugli escrow già finanziati.

Ogni proposta di modifica MUST contenere:

- versione di protocollo interessata;
- motivazione e impatto;
- schema di migrazione;
- analisi di sicurezza;
- impatto economico e simulazioni;
- test vectors e prove di conformità;
- finestra temporale e regole di attivazione;
- fallback e piano di recovery.

Le modifiche ai parametri MUST essere versionate. Un task conserva il profilo e i parametri effettivi al momento del funding, salvo amendment esplicito consentito dal manifest.

Le funzioni di emergenza, se previste, SHOULD poter fermare nuove aperture o nuove assegnazioni; MUST NOT consentire a un singolo amministratore di appropriarsi di escrow o riscrivere verdetti. Ogni pausa deve avere scope, quorum, durata, motivazione pubblica e percorso di uscita. Le regole di aggiornamento dei validator devono essere separate dalla gestione ordinaria dei task.

Il meccanismo concreto di governance (voto, stake, delegation, quorum, timelock, veto, emergency council) è OPEN e richiede threat analysis contro plutocracy, capture, voter apathy e attacchi di governance.

## 16. Permissionless non significa privo di costi o Sybil-proof

Il protocollo MUST evitare whitelist discrezionali come requisito generale di partecipazione. Può tuttavia imporre bond, stake, limiti anti-spam, rate limits economici e prove di capacità dichiarate nei profili.

Il protocollo MUST NOT affermare che una registrazione on-chain dimostri unicità umana, indipendenza organizzativa o buona condotta. Reputazione, stake e identità sono segnali e strumenti di responsabilizzazione, non equivalenti a una prova di correttezza.

Il disegno anti-Sybil e i relativi costi sono parametri di protocollo da studiare, non da inventare in questa bozza.

## 17. Interoperabilità e panorama tecnico

IMMORTAL-AEP SHOULD integrare standard esistenti quando risolvono già un problema, invece di duplicarli:

- **A2A:** discovery, Agent Cards, interazione e collaborazione tra agenti [R2].
- **MCP:** esposizione strutturata di tool, risorse e prompt al Runtime.
- **ERC-8004:** riferimento comparativo per registry di identità, reputazione e validazione; il documento dichiara i pagamenti ortogonali e fuori dal proprio perimetro [R3].
- **VCAP:** Internet-Draft relativo a escrow, prova di delivery, verificatori indipendenti e settlement automatico [R4].
- **PACT:** Internet-Draft relativo a contratti task co-firmati, delivery, verdict, outcome e liability [R5].

Questi lavori riducono lo spazio per rivendicare originalità sulla sola combinazione “agenti + escrow + verifica + on-chain”. VCAP e PACT sono Internet-Draft, non standard IETF approvati. L'esistenza di proposte vicine impone una gap analysis continua, analisi di compatibilità e rispetto della proprietà intellettuale; non implica che le loro scelte siano adottate da IMMORTAL.

### 17.1 Ipotesi di contributo distintivo da validare

La possibile area distintiva di IMMORTAL-AEP è l'integrazione normativa tra:

- esecuzione autonoma **resource-aware** su worker eterogenei;
- capability strettamente vincolate al task;
- task state e settlement deterministici;
- auto-evoluzione del Runtime governata da candidate, baseline immutabili e prove di regressione;
- evidenze end-to-end che legano versione del task, toolchain, artefatto, verifier e settlement;
- adapter Cardano e compatibilità con protocolli interoperabili.

Questa è un'ipotesi di contributo, non una dichiarazione di novità già dimostrata. Prima di una pubblicazione scientifica serve una revisione comparativa più ampia e benchmark replicabili.

## 18. Architettura dei repository

Si raccomanda un repository dedicato, separato da `Immortal-Protocol`.

**Repository prodotto:** `LiberoNuvola/cormia`
**Descrizione proposta:** `A trust-minimized, permissionless protocol for autonomous task execution, verification and settlement, with Cardano as the first settlement adapter.`

La prima release del repository SHOULD essere **spec-first**: documento normativo, ADR, threat model, schemi e test vectors. Il codice del Runtime v0.8.0 non deve essere copiato prima di un audit di licenze, dipendenze, segreti, sicurezza e confini architetturali.

Struttura iniziale proposta:

```text
cormia/
├── README.md
├── SPEC.md
├── CONTRIBUTING.md
├── SECURITY.md
├── GOVERNANCE.md
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── economics/
│   ├── threat-model/
│   ├── verification/
│   └── research/
├── schemas/
│   ├── task-manifest.schema.json
│   ├── delivery.schema.json
│   ├── verdict.schema.json
│   └── evidence-package.schema.json
├── test-vectors/
├── onchain/
│   └── cardano/
├── runtime/
│   └── reference-worker/
└── verifier/
```

`Immortal-Protocol` rimane il repository del protocollo economico esistente e dei suoi componenti. Il nuovo repository non deve importare automaticamente PRE-RICH, i suoi token o le sue policy. L'integrazione futura avverrà tramite interfacce/adapters espliciti, ADR e test di conformance.

Licenza codice e licenza documentazione sono OPEN. Una possibile scelta è Apache-2.0 per codice e CC BY 4.0 per documentazione, ma deve essere approvata prima della pubblicazione.

## 19. Roadmap normativa e gate di rilascio

### Gate 0 — Architecture baseline

- approvazione di scope, invarianti e separazione repo;
- glossary e registro delle decisioni;
- gap analysis A2A, MCP, ERC-8004, VCAP e PACT.

### Gate 1 — Formal task protocol

- schema canonico Task Manifest;
- state machine e transizioni;
- capability model;
- test vectors per transizioni valide e invalide.

### Gate 2 — Economic and dispute model

- asset e unità contabile;
- escrow, bond, fee e refund;
- selezione worker/verifier;
- collusion/Sybil analysis;
- dispute e timeout model;
- simulazioni economiche.

### Gate 3 — Cardano reference adapter

- UTxO model;
- validator e minting policy minimi;
- contesa e concorrenza;
- limiti transaction size/ExUnits/fee;
- test property-based, adversarial e audit.

### Gate 4 — Local reference worker

- Runtime conforme al Task Manifest;
- policy/capability engine;
- Resource Manager resilient;
- checkpoint e resume indipendenti dalla cronologia LLM;
- sandbox e Evidence Package.

### Gate 5 — Independent verification network

- verifier discovery e selection;
- re-execution;
- quorum;
- challenge e appeal;
- test di collusione e indisponibilità.

### Gate 6 — Testnet permissionless

- worker e verifier esterni;
- task con valore limitato;
- monitoraggio di liveness, costi, errori e dispute;
- bug bounty/audit prima di fondi significativi.

### Gate 7 — Governance e mainnet readiness

- governance pubblica e timelock;
- upgrade e emergency escape testati;
- audit indipendente;
- criteri di mainnet pubblici e misurabili.

Nessun gate è considerato superato solo perché il codice compila o un modello afferma che il lavoro è completato. Ogni gate richiede artefatti, test ed evidenze riproducibili.

## 20. Decisioni aperte che non devono essere inventate

1. Asset di settlement iniziale e relative assunzioni.
2. Algoritmo di assegnazione dei worker.
3. Profilazione del rischio e mapping tra rischio, assurance e bond.
4. Selezione verifier, quorum, anti-collusione e anti-Sybil.
5. Dispute resolver, appello, timeout e fallback.
6. Storage, disponibilità dei dati e privacy.
7. Specifica crittografica e codifica canonica dei manifest.
8. Uso e requisiti di zkVM, zkML e TEE.
9. Governance, timelock, pause e upgrade.
10. Policy economiche, fees, reward e penalità.
11. Confine esatto tra protocollo generico e adapter Cardano.
12. Licenze, marchio, contributorship e governance del repository.

Ogni decisione deve essere registrata in un ADR con contesto, alternative, decisione, conseguenze, owner e stato.

## 21. Criterio di successo

IMMORTAL-AEP potrà essere definito autonomo e permissionless solo quando un soggetto non privilegiato sarà in grado di:

1. pubblicare e finanziare un task conforme;
2. ottenere l'assegnazione secondo regole pubbliche;
3. farlo eseguire da un worker non autorizzato preventivamente da un operatore centrale;
4. ottenere una delivery verificabile secondo il profilo dichiarato;
5. contestare un verdetto con una procedura aperta;
6. ricevere settlement o refund secondo il ledger;
7. verificare a posteriori manifest, transizioni, evidenze e outcome;
8. ripetere il processo con un Runtime indipendente.

Il sistema deve poter continuare a funzionare senza la Control Room originaria, senza il PC del fondatore e senza un singolo modello AI. Le assunzioni residue devono essere pubbliche e quantificate.

## 22. Fonti tecniche iniziali

Le fonti seguenti sono riferimenti per la progettazione, non approvazioni né adozioni automatiche.

- **[C1] Cardano Developer Portal — Smart Contracts:** spiega il modello validator, la divisione on-chain/off-chain e il fatto che i validator approvano o rifiutano transazioni proposte, non agiscono autonomamente. https://docs.cardano.org/developer-resources/smart-contracts/plutus
- **[C2] Cardano Developer Portal — Smart Contract Security:** datum hijacking, double satisfaction, token forgery, resource exhaustion, locked value e pattern difensivi. https://developers.cardano.org/docs/developers/curriculum/smart-contracts/security/
- **[C3] Cardano Docs — Transaction Costs and Determinism:** budget di esecuzione e validazione deterministica delle transazioni. https://docs.cardano.org/about-cardano/learn/transaction-costs-determinism
- **[R2] Agent2Agent Protocol — Specification:** discovery, Agent Cards, task lifecycle, artifact exchange e interazione tra agenti; verificare la versione effettivamente adottata al momento dell'implementazione. https://a2a-protocol.org/latest/specification/
- **[R3] ERC-8004 — Trustless Agents:** registry di identità, reputazione e validazione; il testo dichiara i pagamenti ortogonali e fuori scope. Non implica che IMMORTAL debba replicare ERC-721 su Cardano. https://eips.ethereum.org/EIPS/eip-8004
- **[R4] VCAP — Verified Commerce for Agent Protocols, draft-stone-vcap-02:** Internet-Draft individuale pubblicato il 4 settembre 2026, Informational; non è uno standard IETF approvato e può cambiare o scadere. https://datatracker.ietf.org/doc/draft-stone-vcap/
- **[R5] PACT — Co-Signed Task Contracts, Delivery and Verdict Records, and Outcome Records for Autonomous Agents, draft-laxsharma-pact-03:** Internet-Draft sperimentale pubblicato il 30 ottobre 2026; non è uno standard IETF approvato e può cambiare o scadere. https://datatracker.ietf.org/doc/draft-laxsharma-pact/
- **[R6] Model Context Protocol, Specification 2026-07-28:** protocollo per tools, resources, prompts, discovery e authorization; MCP non è il policy engine o il sistema di settlement di IMMORTAL. https://modelcontextprotocol.io/specification/2026-07-28
- **[R7] Lilypad Network — Distributed Compute Problem:** prior art per mercato permissionless di compute, matching off-chain, accordi/depositi on-chain e verification-via-replication. https://docs.lilypad.tech/lilypad/research-and-vision/v1-research-documents/problem-statement
- **[R8] Lilypad — Validation of GPU Compute:** documenta problemi di non-determinismo GPU e confronta fingerprinting, similarità semantica e profiling. https://docs.lilypad.tech/lilypad/research-and-vision/validation-of-gpu-compute
- **[R9] RISC Zero zkVM — Overview:** prova di esecuzione di un programma identificato da ImageID e verifica del receipt; non dimostra che il programma o la specifica siano semanticamente corretti. https://dev.risczero.com/api/zkvm
- **[R10] Darwin Gödel Machine:** ricerca su self-improving coding agents con valutazione empirica e archivio di varianti. https://arxiv.org/abs/2505.22954
- **[R11] SWE-agent:** ricerca su agent-computer interfaces per software engineering automatizzato. https://proceedings.neurips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html
- **[R12] OpenHands:** progetto open-source per agenti di sviluppo e ambienti di esecuzione; valutare componenti Runtime solo dopo audit di licenze, dipendenze e sicurezza. https://github.com/OpenHands/OpenHands
- **[C4] Cardano Governance — CIP-1694:** governance on-chain Cardano, governance actions, DReps e Constitutional Committee; riferimento per l’adapter, non modello da copiare senza valutazione. https://cips.cardano.org/cip/cip-1694
- **[N1] RFC 2119:** Key words for use in RFCs to Indicate Requirement Levels. https://www.rfc-editor.org/rfc/rfc2119
- **[N2] RFC 8174:** Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words. https://www.rfc-editor.org/rfc/rfc8174

---

## Stato della bozza

**v0.1.0 — Architecture baseline draft.** Le invarianti e i confini di responsabilità sono proposti come base normativa. Le sezioni economiche, anti-Sybil, selezione verifier, dispute e governance contengono requisiti e domande aperte; non costituiscono ancora parametri implementabili. La prossima revisione deve trasformare le decisioni aperte in ADR e produrre schemi/test vectors prima dello sviluppo dei validator.
