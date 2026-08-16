/**
 * Agent — Cyberpunk RED
 * Foundry VTT v12, sistema cyberpunk-red-core.
 *
 * Dati sull'attore (flags["cprx-agent"]):
 *   contatti, lavori, note   -> array di voci
 *   handle                   -> come l'Agent chiama il proprietario
 *   numero                   -> numero di rete dell'Agent, "555-0142"
 *   letti                    -> { numeroAltro: quando } per i pallini
 *   appPossedute             -> [chiave] App comprate, per sempre
 *   appInstallate            -> [chiave] App attualmente sulla schermata
 *   agentDistrutto           -> true dopo un duello perso
 *   agentInterno             -> l'Agent e' impiantato, non tascabile
 *   fortify, medscan, ziggurat -> stato delle App corrispondenti
 *
 * Le App NON sono oggetti dell'inventario: sono software dell'Agent.
 * Si comprano una volta sola dall'App Store e si installano o disinstallano
 * a piacere senza riacquistarle.
 *
 * Il traffico fra Agent (messaggi, chiamate, sfide, richieste) non sta nei
 * flag: vedi la sezione "Rete" per il perche'.
 */

const MODULO = "cprx-agent";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* ------------------------------------------------------------------ */
/* App di serie                                                         */
/* ------------------------------------------------------------------ */

const APP = {
  contatti: {
    etichetta: "CPRX.AppContatti",
    icona: "fa-solid fa-address-book",
    // La rubrica non ha un'icona sua: sta dentro Phone, come su un telefono
    // vero. `dentro` la toglie dalla griglia della home e dice dove tornare
    // dopo aver salvato una voce.
    dentro: "telefono",
    nuovo: "CPRX.NuovoContatto",
    campi: [
      { chiave: "nome", etichetta: "CPRX.CampoNome", tipo: "text", richiesto: true },
      { chiave: "numero", etichetta: "CPRX.CampoNumero", tipo: "text", numero: true },
      { chiave: "ruolo", etichetta: "CPRX.CampoRuolo", tipo: "text" },
      { chiave: "handle", etichetta: "CPRX.CampoHandle", tipo: "text" },
      { chiave: "preferito", etichetta: "CPRX.CampoPreferito", tipo: "check" },
      // Il numero si nasconde per contatto: verso questa persona, e basta.
      { chiave: "nascosto", etichetta: "CPRX.CampoNascondiNumero", tipo: "check" },
      { chiave: "note", etichetta: "CPRX.CampoNote", tipo: "textarea" }
    ],
    titolo: (v) => v.nome || "—",
    sottotitolo: (v) => [v.numero, v.ruolo, v.handle].filter(Boolean).join(" · "),
    // I contatti con un numero si possono chiamare e messaggiare dall'elenco.
    contattabile: (v) => !!v.numero
  },

  lavori: {
    etichetta: "CPRX.AppLavori",
    icona: "fa-solid fa-briefcase",
    campi: [
      { chiave: "titolo", etichetta: "CPRX.CampoTitolo", tipo: "text", richiesto: true },
      { chiave: "committente", etichetta: "CPRX.CampoCommittente", tipo: "text" },
      { chiave: "ricompensa", etichetta: "CPRX.CampoRicompensa", tipo: "number" },
      {
        chiave: "stato",
        etichetta: "CPRX.CampoStato",
        tipo: "select",
        opzioni: [
          { valore: "proposto", etichetta: "CPRX.StatoProposto" },
          { valore: "corso", etichetta: "CPRX.StatoCorso" },
          { valore: "concluso", etichetta: "CPRX.StatoConcluso" },
          { valore: "fallito", etichetta: "CPRX.StatoFallito" }
        ],
        predefinito: "proposto"
      },
      { chiave: "dettagli", etichetta: "CPRX.CampoDettagli", tipo: "textarea" }
    ],
    titolo: (v) => v.titolo || "—",
    sottotitolo: (v) => {
      const parti = [];
      if (v.committente) parti.push(v.committente);
      if (v.ricompensa) parti.push(`${v.ricompensa} eb`);
      return parti.join(" · ");
    }
  },

  note: {
    etichetta: "CPRX.AppNote",
    icona: "fa-solid fa-note-sticky",
    nuovo: "CPRX.NuovaNota",
    campi: [
      { chiave: "titolo", etichetta: "CPRX.CampoTitolo", tipo: "text", richiesto: true },
      { chiave: "testo", etichetta: "CPRX.CampoTesto", tipo: "textarea" }
    ],
    titolo: (v) => v.titolo || "—",
    sottotitolo: (v) => (v.testo ?? "").slice(0, 60)
  },

  messaggi: { etichetta: "CPRX.AppMessaggi", icona: "fa-solid fa-comment-sms", speciale: "messaggi" },
  calendario: { etichetta: "CPRX.AppCalendario", icona: "fa-solid fa-calendar-days", speciale: "calendario" },
  telefono: { etichetta: "CPRX.AppTelefono", icona: "fa-solid fa-phone", speciale: "telefono" },
  banca: { etichetta: "CPRX.AppBanca", icona: "fa-solid fa-building-columns", speciale: "banca" },
  casa: { etichetta: "CPRX.AppCasa", icona: "fa-solid fa-house-chimney", speciale: "casa" },
  negozio: { etichetta: "CPRX.AppNegozio", icona: "fa-solid fa-cart-shopping", speciale: "negozio" },
  appstore: { etichetta: "CPRX.AppStore", icona: "fa-solid fa-cloud-arrow-down", speciale: "appstore" },
  // Le impostazioni sono un'App come le altre: l'ingranaggio nella barra di
  // stato era un comando nascosto in un angolo, e non e' cosi' che si fa
  // su un telefono.
  impostazioni: { etichetta: "CPRX.Impostazioni", icona: "fa-solid fa-gear", speciale: "impostazioni" }
};

/* ------------------------------------------------------------------ */
/* App acquistabili                                                     */
/* Software dell'Agent, non oggetti. Prezzo e Disponibilita' seguono     */
/* Black Chrome; le descrizioni sono riassunti dell'effetto di gioco.     */
/*                                                                       */
/* `vista` e' il nome del blocco del template che l'App accende quando   */
/* la apri: e' li' che sta la funzione vera. Un'App senza `vista` mostra */
/* solo la sua scheda.                                                   */
/* Aggiungerne una significa aggiungere una voce qui.                    */
/* ------------------------------------------------------------------ */

const APP_ACQUISTABILI = {
  gladiator: {
    nome: "Digital Gladiator",
    produttore: "Segotari",
    prezzo: 20,
    disponibilita: "CPRX.DispComune",
    icona: "fa-solid fa-gamepad",
    descrizione: "CPRX.DescGladiator",
    vista: "gladiator",
    duePersone: true
  },
  fortify: {
    nome: "4Tify",
    produttore: "SecSystems",
    prezzo: 100,
    disponibilita: "CPRX.DispPremium",
    icona: "fa-solid fa-shield-halved",
    descrizione: "CPRX.DescFortify",
    vista: "fortify"
  },
  ncpd: {
    nome: "NCPD Database Criminale",
    produttore: "NCPD",
    prezzo: 500,
    disponibilita: "CPRX.DispOnerosa",
    icona: "fa-solid fa-fingerprint",
    descrizione: "CPRX.DescNcpd",
    vista: "ncpd",
    duePersone: true
  },
  medscan: {
    nome: "Trauma Team MedScan",
    produttore: "Trauma Team",
    prezzo: 20,
    disponibilita: "CPRX.DispComune",
    icona: "fa-solid fa-kit-medical",
    descrizione: "CPRX.DescMedscan",
    vista: "medscan",
    duePersone: true
  },
  ziggurat: {
    nome: "Ziggurat Database Urbano",
    produttore: "Ziggurat",
    prezzo: 100,
    disponibilita: "CPRX.DispPremium",
    icona: "fa-solid fa-city",
    descrizione: "CPRX.DescZiggurat",
    vista: "ziggurat"
  },
  reputazione: {
    nome: "StreetWire",
    produttore: "Night City Wire",
    prezzo: 50,
    disponibilita: "CPRX.DispComune",
    icona: "fa-solid fa-tower-broadcast",
    descrizione: "CPRX.DescReputazione",
    vista: "reputazione"
  },

  /* --- le App del DLC «Tutto sugli Agent» --------------------------- */
  /* Prezzo e disponibilita' sono quelli della tabella del manuale.      */
  /* BabelChat non c'e': e' l'App Messaggi, che l'Agent ha gia'.         */

  alex: {
    nome: "Ask Alex Anything",
    produttore: "Ziggurat",
    prezzo: 0,
    disponibilita: "CPRX.DispGratuita",
    icona: "fa-solid fa-magnifying-glass-chart",
    descrizione: "CPRX.DescAlex",
    vista: "alex",
    diSerie: true
  },
  zpost: {
    nome: "ZPost",
    produttore: "Ziggurat",
    prezzo: 0,
    disponibilita: "CPRX.DispGratuita",
    icona: "fa-solid fa-envelope",
    descrizione: "CPRX.DescZpost",
    vista: "zpost",
    duePersone: true,
    diSerie: true
  },
  garden: {
    nome: "Garden",
    produttore: "Ziggurat",
    prezzo: 0,
    disponibilita: "CPRX.DispGratuita",
    icona: "fa-solid fa-seedling",
    descrizione: "CPRX.DescGarden",
    vista: "garden",
    duePersone: true,
    diSerie: true
  },
  bangme: {
    nome: "BangMe!",
    produttore: "Eurobank",
    prezzo: 10,
    disponibilita: "CPRX.DispEconomica",
    icona: "fa-solid fa-money-bill-transfer",
    descrizione: "CPRX.DescBangme",
    vista: "bangme",
    duePersone: true
  },
  hustool: {
    nome: "HusTool",
    produttore: "No/Brainer",
    prezzo: 20,
    disponibilita: "CPRX.DispComune",
    icona: "fa-solid fa-hand-holding-dollar",
    descrizione: "CPRX.DescHustool",
    vista: "hustool"
  },
  roachrace: {
    nome: "Roach Race",
    produttore: "CD Projekt",
    prezzo: 20,
    disponibilita: "CPRX.DispComune",
    icona: "fa-solid fa-horse",
    descrizione: "CPRX.DescRoach",
    vista: "roachrace"
  },
  watchbox: {
    nome: "WatchBox",
    produttore: "No/Brainer",
    prezzo: 50,
    disponibilita: "CPRX.DispCostosa",
    icona: "fa-solid fa-video",
    descrizione: "CPRX.DescWatchbox",
    vista: "watchbox"
  },
  brainwasher: {
    nome: "Brainwasher",
    produttore: "No/Brainer",
    prezzo: 50,
    disponibilita: "CPRX.DispCostosa",
    icona: "fa-solid fa-head-side-virus",
    descrizione: "CPRX.DescBrainwasher",
    vista: "brainwasher"
  },
  elflines: {
    nome: "Elflines Online Elftracker",
    produttore: "Segotari",
    prezzo: 50,
    disponibilita: "CPRX.DispCostosa",
    icona: "fa-solid fa-dungeon",
    descrizione: "CPRX.DescElflines",
    vista: "elflines"
  },
  bigiaaa: {
    nome: "Big IAAA",
    produttore: "Ziggurat",
    prezzo: 100,
    disponibilita: "CPRX.DispPremium",
    icona: "fa-solid fa-brain",
    descrizione: "CPRX.DescBigIaaa",
    vista: "bigiaaa"
  },

  /* --- due App che il manuale non ha ------------------------------- */
  /* Vengono dal prototipo, non dal DLC. Le regole per Sentinel pero'   */
  /* ci sono: sono quelle dell'hacking di un Agent, viste dalla parte   */
  /* di chi lo subisce. Patch Pro invece sta tutta dentro Garden.       */

  sentinel: {
    nome: "Netwatch Sentinel",
    produttore: "Netwatch",
    prezzo: 500,
    disponibilita: "CPRX.DispOnerosa",
    icona: "fa-solid fa-shield-virus",
    descrizione: "CPRX.DescSentinel",
    vista: "sentinel"
  },
  patchpro: {
    nome: "Ziggurat Patch Pro",
    produttore: "Ziggurat",
    prezzo: 100,
    disponibilita: "CPRX.DispPremium",
    icona: "fa-solid fa-clapperboard",
    descrizione: "CPRX.DescPatchpro",
    vista: "patchpro"
  },

  /* Corp Link non si compra: te la installa il datore di lavoro. Costa
     zero, non e' di serie, e `soloMaster` dice che il tasto di scarico ce
     l'ha solo il master — al tavolo il datore di lavoro e' lui. Un
     giocatore non si assume in Arasaka da solo. */
  corp: {
    nome: "Corp Link",
    produttore: "Corporate",
    prezzo: 0,
    disponibilita: "CPRX.DispAziendale",
    icona: "fa-solid fa-id-badge",
    descrizione: "CPRX.DescCorp",
    vista: "corp",
    soloMaster: true
  }
};

/* ------------------------------------------------------------------ */
/* Sfondi                                                               */
/*                                                                      */
/* Un elenco **chiuso**, spedito col modulo. Non e' un `FilePicker` e    */
/* non lo diventera': dall'Agent non si carica niente nel mondo, e la    */
/* regola per cui l'NCPD non ha le foto vale ancora. Qui si sceglie da   */
/* una lista, che e' un'altra cosa.                                      */
/*                                                                      */
/* Aggiungerne uno: il file in `assets/sfondi/`, e una riga qui.         */
/* ------------------------------------------------------------------ */

const SFONDI = [
  { chiave: "nightcity", etichetta: "NIGHT CITY", file: "nightcity.jpg" },
  { chiave: "edgerunner", etichetta: "EDGERUNNER", file: "edgerunner.jpg" },
  { chiave: "combatzone", etichetta: "COMBAT ZONE", file: "combat-zone.jpg" },
  { chiave: "netrunner", etichetta: "NETRUNNER", file: "netrunner.jpg" },
  { chiave: "fixer", etichetta: "FIXER", file: "fixer.jpg" },
  { chiave: "dangergal", etichetta: "DANGER GAL", file: "dangergal.jpg" },
  { chiave: "arasaka", etichetta: "ARASAKA", file: "arasaka.jpg" },
  { chiave: "arasakaTorre", etichetta: "ARASAKA TOWER", file: "arasaka-tower.jpg" },
  { chiave: "arasakaArma", etichetta: "ARASAKA M-10AF", file: "arasaka-gun.jpg" },
  { chiave: "militech", etichetta: "MILITECH", file: "militech.jpg" },
  { chiave: "militechArma", etichetta: "MILITECH ARMS", file: "militech-gun.jpg" },
  { chiave: "traumateam", etichetta: "TRAUMA TEAM", file: "traumateam.jpg" }
];

const SFONDO_PREDEFINITO = "nightcity";

function percorsoSfondo(chiave) {
  const voce = SFONDI.find(s => s.chiave === chiave);
  return voce ? `modules/${MODULO}/assets/sfondi/${voce.file}` : "";
}

/**
 * Lo sfondo e' del personaggio, non di chi guarda: sta in un flag, come il
 * numero e la rubrica. Il tema invece resta un'impostazione client — quello
 * e' il gusto di chi ha il monitor davanti, questo e' il telefono di
 * qualcuno.
 */
function sfondoDi(attore) {
  const scelto = attore?.getFlag(MODULO, "sfondo");
  if (scelto === "") return "";
  return SFONDI.some(s => s.chiave === scelto) ? scelto : SFONDO_PREDEFINITO;
}

/** Temi. La chiave diventa una classe CSS: tema-notte, tema-sangue, ... */
const TEMI = {
  notte: "CPRX.TemaNotte",
  sangue: "CPRX.TemaSangue",
  militech: "CPRX.TemaMilitech",
  netrunner: "CPRX.TemaNetrunner",
  chiaro: "CPRX.TemaChiaro",
  acido: "CPRX.TemaAcido"
};

/** Le tre pagine della schermata principale, nell'ordine in cui scorrono. */
const PAGINE_HOME = 3;

/* ------------------------------------------------------------------ */
/* Eurodollari                                                          */
/* ------------------------------------------------------------------ */

const PERCORSI_EDDIES = [
  "wealth.value", "wealth", "currency.eb",
  "eddies.value", "money.value", "resources.eddies.value"
];

function trovaEddies(attore) {
  const sistema = attore?.system ?? {};

  const personale = (game.settings.get(MODULO, "percorsoEddies") ?? "").trim();
  if (personale) {
    const v = Number(foundry.utils.getProperty(sistema, personale));
    if (Number.isFinite(v)) return { valore: v, origine: `system.${personale}` };
  }

  for (const percorso of PERCORSI_EDDIES) {
    const grezzo = foundry.utils.getProperty(sistema, percorso);
    const v = Number(grezzo);
    if (grezzo !== null && grezzo !== undefined && grezzo !== "" && Number.isFinite(v)) {
      return { valore: v, origine: `system.${percorso}` };
    }
  }

  const contanti = (attore?.items ?? []).filter(i =>
    i.type === "cash" || /eurodollar|eurobuck|eddie|contant/i.test(i.name ?? ""));
  if (contanti.length) {
    const somma = contanti.reduce((tot, i) =>
      tot + (Number(i.system?.amount ?? i.system?.quantity ?? 0) || 0), 0);
    return { valore: somma, origine: "oggetti di tipo contante" };
  }

  return { valore: null, origine: null };
}

/** Scala una somma dagli eurodollari. Restituisce false se non e' possibile. */
async function paga(attore, importo) {
  return accredita(attore, -Math.abs(importo));
}

/**
 * Muove gli eurodollari sulla scheda: positivo accredita, negativo addebita.
 * Un addebito non puo' scendere sotto zero — la Banca non fa credito.
 * Restituisce false se il percorso non e' scrivibile o i soldi non bastano,
 * cosi' chi chiama puo' fermarsi prima di scrivere il registro.
 */
async function accredita(attore, importo) {
  const eddies = trovaEddies(attore);
  if (eddies.valore === null || !eddies.origine?.startsWith("system.")) return false;

  const nuovo = eddies.valore + importo;
  if (nuovo < 0) return false;

  const percorso = eddies.origine.slice("system.".length);
  await attore.update({ [`system.${percorso}`]: nuovo });
  return true;
}

/* ------------------------------------------------------------------ */
/* Rete                                                                 */
/*                                                                      */
/* Ogni Agent ha un numero. Messaggi, chiamate e servizi stanno nel      */
/* flag `filo` dell'attore, insieme a tutto il resto dei suoi dati: in   */
/* chat non deve comparire niente e niente deve restarci.                */
/*                                                                      */
/* Ma un giocatore non puo' scrivere sulla scheda di un altro, quindi il */
/* messaggio ha bisogno di un mezzo per attraversare il tavolo. Quel     */
/* mezzo e' un ChatMessage nascosto, che vive il tempo di essere         */
/* consegnato: il client di un GM lo raccoglie, ne scrive una copia nel  */
/* filo di tutti e due gli Agent — il GM possiede ogni scheda — e poi lo */
/* cancella. E' un ufficio postale, non un archivio.                     */
/*                                                                      */
/* Se nessun GM e' collegato la busta resta in giacenza, invisibile,     */
/* finche' non ne arriva uno. Nel frattempo l'Agent legge il filo e le   */
/* buste in giacenza insieme, quindi il giro funziona lo stesso: cambia  */
/* solo che la posta non e' ancora stata archiviata.                     */
/*                                                                      */
/* TRAPPOLA: non attaccare mai `rolls` a queste buste. Il getter         */
/* `visible` di ChatMessage lascia passare i tiri anche quando sono      */
/* sussurrati, e una busta in giacenza finirebbe sotto gli occhi di      */
/* tutti. I tiri pubblici passano da `annuncia()`, che e' un'altra cosa. */
/* ------------------------------------------------------------------ */

const TIPO = {
  SMS: "sms",
  CHIAMATA: "chiamata",
  SFIDA: "sfida",
  // La posta di ZPost: corrispondenza come gli SMS, ma con un oggetto e un
  // testo lungo. Sta nello stesso filo e passa dallo stesso ufficio postale.
  EMAIL: "email",
  // Ordini di servizio: portano una conseguenza, si consumano e spariscono.
  ESITO: "esito",
  SERVIZIO: "servizio",
  // Un post su Garden: non e' corrispondenza e non ha un destinatario, e'
  // una riga da appendere alla bacheca del tavolo. Si consuma anche lui.
  GARDEN: "garden"
};

/**
 * Cosa vale la pena tenere sulla scheda: la corrispondenza, non gli ordini
 * di servizio. Un consulto MedScan lascia il suo segno nel flag `medscan`,
 * non serve anche la ricevuta nel filo.
 */
const TIPI_DA_ARCHIVIARE = new Set([TIPO.SMS, TIPO.CHIAMATA, TIPO.SFIDA, TIPO.EMAIL]);

/** Uno squillo senza risposta si spegne da solo dopo questo tempo. */
const DURATA_SQUILLO = 45000;

/**
 * Tetto a una chiamata in corso. Serve perche' la chiusura e' un messaggio:
 * chi chiude il browser a meta' telefonata non lo manda mai, e senza un
 * limite la schermata di chiamata resterebbe incollata sull'Agent per sempre.
 */
const DURATA_MASSIMA_CHIAMATA = 30 * 60000;

/** Un invito a duello scade se resta appeso troppo a lungo. */
const DURATA_INVITO = 10 * 60000;

const SUONO_MESSAGGIO = "sounds/notify.wav";
const SUONO_CHIAMATA = "sounds/drums.wav";

function esc(testo) {
  return String(testo ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function suona(percorso) {
  if (!game.settings.get(MODULO, "suoni")) return;
  const aiuto = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
  try {
    aiuto?.play({ src: percorso, volume: 0.5, autoplay: true, loop: false }, false);
  } catch (errore) {
    console.warn("cprx-agent | suono non riproducibile:", errore);
  }
}

/* --- numeri --------------------------------------------------------- */

function prefissoNumeri() {
  const grezzo = (game.settings.get(MODULO, "prefissoNumeri") ?? "").replace(/\D/g, "");
  return grezzo || "555";
}

/** "5550142", "555 0142", "0142" diventano tutti "555-0142". */
function normalizzaNumero(grezzo) {
  const cifre = String(grezzo ?? "").replace(/\D/g, "");
  if (!cifre) return "";
  if (cifre.length <= 4) return `${prefissoNumeri()}-${cifre.padStart(4, "0")}`;
  return `${cifre.slice(0, -4)}-${cifre.slice(-4)}`;
}

function numeroDi(attore) {
  return attore?.getFlag(MODULO, "numero") ?? "";
}

function rubricaNumeri() {
  const mappa = new Map();
  for (const attore of game.actors) {
    const numero = attore.getFlag(MODULO, "numero");
    if (numero) mappa.set(numero, attore);
  }
  return mappa;
}

function attorePerNumero(grezzo) {
  const numero = normalizzaNumero(grezzo);
  return numero ? (rubricaNumeri().get(numero) ?? null) : null;
}

/** Il nome da mostrare accanto a un numero: prima la rubrica, poi il mondo. */
function nomePerNumero(attore, numero) {
  const contatto = leggiVoci(attore, "contatti")
    .find(v => v.numero && normalizzaNumero(v.numero) === numero);
  if (contatto?.nome) return contatto.nome;
  return attorePerNumero(numero)?.name ?? "";
}

/**
 * Il numero nasce dall'id dell'attore: cancellarlo e riassegnarlo restituisce
 * lo stesso, a meno che nel frattempo qualcuno non se lo sia preso. Con
 * `forza` si pesca a caso, per cambiare numero dopo che ti hanno scoperto.
 */
async function assegnaNumero(attore, { forza = false } = {}) {
  if (!attore?.isOwner) return numeroDi(attore);
  if (!forza && numeroDi(attore)) return numeroDi(attore);

  const usati = rubricaNumeri();
  usati.delete(numeroDi(attore));

  let seme = 0;
  for (const carattere of attore.id) seme = (seme * 31 + carattere.charCodeAt(0)) % 10000;
  if (forza) seme = Math.floor(Math.random() * 10000);

  const prefisso = prefissoNumeri();
  for (let passo = 0; passo < 10000; passo++) {
    const candidato = `${prefisso}-${String((seme + passo) % 10000).padStart(4, "0")}`;
    if (usati.has(candidato)) continue;
    await attore.setFlag(MODULO, "numero", candidato);
    return candidato;
  }

  ui.notifications.error(game.i18n.localize("CPRX.NumeriEsauriti"));
  return "";
}

/* --- chi riceve, chi applica ---------------------------------------- */

/**
 * Tema e accento sulla radice della finestra. Le classi dei temi valgono
 * **solo** sull'elemento radice, quindi qui e non su un figlio.
 *
 * La usano tutte e due le finestre: la console e' un Agent anche in questo,
 * e un banco del master col tema di serie mentre il tavolo gioca in verde
 * acido si vedeva subito che era un'altra cosa.
 */
function applicaTemaA(elemento) {
  if (!elemento) return;

  for (const classe of [...elemento.classList]) {
    if (classe.startsWith("tema-")) elemento.classList.remove(classe);
  }
  const tema = game.settings.get(MODULO, "tema");
  elemento.classList.add(`tema-${TEMI[tema] ? tema : "notte"}`);

  const accento = (game.settings.get(MODULO, "accento") ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(accento)) elemento.style.setProperty("--agent-accento", accento);
  else elemento.style.removeProperty("--agent-accento");
}

/** Utenti che devono vedere il messaggio: i GM piu' i proprietari coinvolti. */
function ascoltatori(...attori) {
  const ids = new Set();
  for (const utente of game.users) {
    if (utente.isGM) { ids.add(utente.id); continue; }
    if (attori.some(a => a?.testUserPermission(utente, "OWNER"))) ids.add(utente.id);
  }
  return [...ids];
}

/**
 * Le conseguenze di un'App si scrivono sulla scheda di chi le subisce, e solo
 * un suo proprietario puo' farlo. Il messaggio arriva a tutti i client, quindi
 * serve eleggerne uno: il primo giocatore collegato, altrimenti il primo GM.
 */
function applicanteDi(attore) {
  if (!attore) return null;
  const attivi = game.users.filter(u => u.active && attore.testUserPermission(u, "OWNER"));
  const giocatori = attivi.filter(u => !u.isGM).sort((a, b) => a.id.localeCompare(b.id));
  if (giocatori.length) return giocatori[0].id;
  const master = attivi.filter(u => u.isGM).sort((a, b) => a.id.localeCompare(b.id));
  return master[0]?.id ?? null;
}

function toccaAMe(attore) {
  return applicanteDi(attore) === game.user.id;
}

/* --- la rubrica di lavoro del master ---------------------------------- */

/**
 * Gli attori che il master gestisce sempre: bersagli dei pagamenti,
 * destinatari degli avvisi. E' un'impostazione di mondo perche' non
 * appartiene a nessun personaggio — la compila il master una volta.
 */
function elencoGiocatori() {
  const dati = game.settings.get(MODULO, "elencoGiocatori");
  const ids = Array.isArray(dati?.ids) ? dati.ids : [];
  return ids.map(id => game.actors.get(id)).filter(Boolean);
}

async function scriviElencoGiocatori(ids) {
  return game.settings.set(MODULO, "elencoGiocatori", { ids });
}

/** L'identita' libera del master: un nome e un numero senza scheda dietro. */
function identitaMaster() {
  const dati = game.settings.get(MODULO, "identitaMaster") ?? {};
  return {
    nome: dati.nome ?? "",
    numero: dati.numero ?? "",
    filo: Array.isArray(dati.filo) ? dati.filo : []
  };
}

async function scriviIdentitaMaster(parziale) {
  return game.settings.set(MODULO, "identitaMaster", { ...identitaMaster(), ...parziale });
}

/* --- banca ------------------------------------------------------------ */

/**
 * I soldi restano dove sono sempre stati: `system.wealth.value` sulla scheda.
 * La Banca non tiene un secondo saldo — sarebbe una seconda verita' destinata
 * a divergere dalla prima. Tiene il **registro**: chi ha mosso quanto, quando
 * e perche'. Il saldo si legge sempre dalla scheda.
 */
function movimenti(attore) {
  const dati = attore?.getFlag(MODULO, "banca");
  return Array.isArray(dati) ? dati : [];
}

/**
 * Scrive un movimento sul registro di una scheda. Serve possederla: dal lato
 * di chi non la possiede il movimento viaggia come ordine di servizio e lo
 * scrive il client eletto, come per ogni altra conseguenza a distanza.
 */
async function segnaMovimento(attore, voce) {
  if (!attore?.isOwner) return false;

  const voci = movimenti(attore);
  if (voci.some(v => v.id === voce.id)) return true;

  voci.push(voce);
  const limite = limiteFilo();
  await attore.setFlag(MODULO, "banca", voci.length > limite ? voci.slice(-limite) : voci);
  return true;
}

/* --- numero coperto --------------------------------------------------- */

/**
 * Il numero si nasconde per contatto, non in blocco: la spunta sta sulla
 * voce della rubrica, e vale solo verso quella persona. Chi non e' in
 * rubrica riceve il numero in chiaro.
 */
function nascondoCon(attore, numero) {
  const cercato = normalizzaNumero(numero);
  if (!cercato) return false;

  return leggiVoci(attore, "contatti").some(v =>
    v.nascosto && v.numero && normalizzaNumero(v.numero) === cercato);
}

/**
 * Il GM smista la posta, quindi i numeri coperti li ha comunque sotto mano:
 * l'impostazione decide solo se glieli mostra anche l'interfaccia. Di serie
 * e' spenta — coperto vuol dire coperto per tutti, GM compreso.
 *
 * ATTENZIONE: la copertura e' una convenzione da tavolo, non un lucchetto.
 * Il numero resta nei dati della voce, e la voce sta sulla scheda di chi la
 * riceve: chi apre la console lo trova. Serve a far giocare "numero
 * sconosciuto", non a reggere contro un giocatore che vuole barare.
 */
function vedoInChiaro() {
  if (!game.user?.isGM) return false;
  try {
    return game.settings.get(MODULO, "gmVedeCoperti") === true;
  } catch (errore) {
    return false;
  }
}

/**
 * Solo le voci che aprono un contatto dicono se il filo e' coperto: un SMS
 * o uno squillo. Risposta, chiusura e rifiuto sono contabilita' della
 * chiamata — arrivano anche da me, e comunque non sono qualcuno che si
 * presenta col suo numero.
 */
function vocePresenta(voce) {
  return voce.tipo === TIPO.SMS || (voce.tipo === TIPO.CHIAMATA && voce.stato === "squilla");
}

/**
 * Le iniziali di un nome: due lettere, per il tondo della chiamata.
 *
 * Le parentesi vanno tolte, non contate: «Riffstorm (Bradley Ortiz)» dava
 * `R(`, che non e' un'iniziale di niente.
 */
function iniziali(nome) {
  const parole = String(nome ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parole.length) return "?";
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}

/**
 * Quando e' successa una cosa, scritto come lo scriverebbe un telefono:
 * l'orario se e' di oggi, la data corta se e' di prima. Un orario secco su
 * una riga di tre settimane fa non dice niente, e una data completa su una
 * riga di stamattina ruba lo spazio al nome.
 *
 * E' l'ora del mondo reale, come tutto quello che il telefono mostra fuori
 * dal calendario: l'orologio di gioco sta nella console.
 */
function etichettaQuando(quando) {
  if (!quando) return "";
  const d = new Date(quando);
  const oggi = new Date();
  const stessoGiorno = d.toDateString() === oggi.toDateString();

  return stessoGiorno
    ? d.toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(game.i18n.lang, { day: "2-digit", month: "2-digit" });
}

/** Al posto del nome, e al posto di qualunque altra informazione. */
function etichettaCoperta() {
  return game.i18n.localize("CPRX.Sconosciuto");
}

/** I numeri che questo Agent non deve vedere: rubrica compresa. */
function numeriCoperti(attore) {
  return new Set(conversazioni(attore)
    .filter(c => c.coperto && c.numero)
    .map(c => c.numero));
}

/* --- i gruppi -------------------------------------------------------- */

/**
 * Un gruppo **non ha un registro**. Esiste nelle voci: ogni SMS di gruppo
 * porta `idGruppo`, `nomeGruppo` e `membri`, e il filo si ricava leggendoli —
 * la stessa strada degli stati di una chiamata. Nessuna impostazione da
 * tenere allineata, nessuna scheda da possedere per creare un gruppo, e chi
 * riceve il messaggio riceve anche l'elenco di chi altro lo ha ricevuto.
 *
 * Il prezzo e' che l'elenco dei membri e' quello dell'**ultima voce**: chi
 * esce dal gruppo lo fa mandando una riga con l'elenco accorciato.
 *
 * Nel filo un gruppo si indirizza con una chiave `g:<id>` invece che con un
 * numero. `stato.conversazione` e la mappa `letti` accettano tutte e due le
 * forme, perche' per loro sono solo stringhe.
 */
const PREFISSO_GRUPPO = "g:";

function chiaveGruppo(id) {
  return `${PREFISSO_GRUPPO}${id}`;
}

function eChiaveGruppo(chiave) {
  return typeof chiave === "string" && chiave.startsWith(PREFISSO_GRUPPO);
}

function idGruppoDa(chiave) {
  return eChiaveGruppo(chiave) ? chiave.slice(PREFISSO_GRUPPO.length) : null;
}

/** I numeri di un gruppo, normalizzati e senza doppioni. */
function membriDi(voce) {
  const numeri = Array.isArray(voce?.membri) ? voce.membri : [];
  return [...new Set(numeri.map(n => normalizzaNumero(n)).filter(Boolean))];
}

/**
 * Il nome che si mostra a un gruppo senza nome. Un gruppo puo' non averlo:
 * meglio "Gruppo · 4" che una riga vuota nell'elenco.
 */
function nomeGruppoPredefinito(membri) {
  return game.i18n.format("CPRX.GruppoSenzaNome", { quanti: membri.length });
}

/* --- archivio sulla scheda ------------------------------------------- */

function limiteFilo() {
  const valore = Number(game.settings.get(MODULO, "limiteFilo"));
  return Number.isFinite(valore) && valore > 0 ? valore : 300;
}

function filo(attore) {
  const dati = attore?.getFlag(MODULO, "filo");
  return Array.isArray(dati) ? dati : [];
}

/** Scrive una voce nel filo di un Agent. Serve possedere la scheda. */
async function archivia(attore, voce) {
  if (!attore?.isOwner) return false;

  const voci = filo(attore);
  if (voci.some(v => v.idVoce === voce.idVoce)) return true;

  voci.push(voce);
  voci.sort((a, b) => a.quando - b.quando);

  const limite = limiteFilo();
  await attore.setFlag(MODULO, "filo", voci.length > limite ? voci.slice(-limite) : voci);
  return true;
}

/* --- l'ufficio postale ----------------------------------------------- */

/**
 * Un GM solo fa il postino, sempre lo stesso: il primo collegato in ordine di
 * id. Se non ce n'e' nessuno la posta resta in giacenza e viene consegnata
 * quando ne arriva uno.
 */
function sonoIlPostino() {
  const master = game.users.filter(u => u.active && u.isGM).sort((a, b) => a.id.localeCompare(b.id));
  return master[0]?.id === game.user.id;
}

async function consegna(messaggio) {
  const f = messaggio.flags?.[MODULO];
  if (!f?.tipo) return;

  // Un post di Garden non ha un destinatario: va sulla bacheca del tavolo,
  // che e' un'impostazione di mondo e quindi la scrive solo il postino.
  if (f.tipo === TIPO.GARDEN && game.user.isGM) {
    const voci = gardenPatch();
    if (!voci.some(v => v.id === f.idVoce)) {
      await scriviGardenPatch([...voci, {
        id: f.idVoce,
        autore: f.daNome || f.da || "—",
        numero: f.da ?? "",
        testo: f.testo ?? "",
        quando: f.quando ?? Date.now(),
        cuori: []
      }]);
    }
  }

  if (TIPI_DA_ARCHIVIARE.has(f.tipo)) {
    const voce = { ...f };
    delete voce.applica;
    delete voce.accredito;

    // In un gruppo i capi sono piu' di due: `aAttori` porta tutti gli altri
    // destinatari, e la copia va scritta sulla scheda di ognuno.
    const coinvolti = [f.daAttore, f.aAttore, ...(Array.isArray(f.aAttori) ? f.aAttori : [])];
    for (const id of new Set(coinvolti.filter(Boolean))) {
      const attore = game.actors.get(id);
      if (attore) await archivia(attore, voce);
    }

    // Il capo senza scheda: il numero libero del master. Il suo archivio e'
    // un'impostazione di mondo, quindi lo scrive solo il postino — che e'
    // un GM, l'unico che possa scriverci.
    if ((f.aMaster || f.daMaster) && game.user.isGM) {
      const master = identitaMaster();
      if (!master.filo.some(v => v.idVoce === voce.idVoce)) {
        const filoNuovo = [...master.filo, voce].sort((a, b) => a.quando - b.quando);
        const limite = limiteFilo();
        await scriviIdentitaMaster({
          filo: filoNuovo.length > limite ? filoNuovo.slice(-limite) : filoNuovo
        });
      }
    }
  }

  try {
    await messaggio.delete();
  } catch (errore) {
    console.warn("cprx-agent | busta non cancellabile:", errore);
  }
}

/** Le buste rimaste in giacenza mentre non c'era nessun GM collegato. */
async function consegnaArretrati() {
  if (!sonoIlPostino()) return 0;

  const giacenza = game.messages.filter(m => m.flags?.[MODULO]?.tipo);
  for (const messaggio of giacenza) await consegna(messaggio);

  if (giacenza.length) console.log(`cprx-agent | consegnate ${giacenza.length} buste`);
  return giacenza.length;
}

/* --- invio e lettura ------------------------------------------------- */

async function invia(dati) {
  const daAttore = dati.daAttore ?? null;
  const aAttore = dati.aAttore ?? null;
  const aAttori = (Array.isArray(dati.aAttori) ? dati.aAttori : []).filter(Boolean);

  const carico = {
    ...dati,
    idVoce: foundry.utils.randomID(),
    daAttore: daAttore?.id ?? null,
    aAttore: aAttore?.id ?? null,
    aAttori: aAttori.map(a => a.id),
    daNome: dati.daNome ?? daAttore?.name ?? (dati.daMaster ? identitaMaster().nome : ""),
    aNome: dati.aNome ?? aAttore?.name ?? (dati.aMaster ? identitaMaster().nome : ""),
    // In un gruppo il numero non si copre: entrarci vuol dire mostrarlo a
    // tutti quelli che ci sono dentro, e un `???` in mezzo a sei persone
    // non sarebbe copertura, sarebbe un buco nell'elenco dei membri.
    anonimo: dati.idGruppo ? false : (dati.anonimo ?? nascondoCon(daAttore, dati.a)),
    quando: Date.now()
  };

  // La classe sulla busta serve al foglio di stile: nasconde la riga in
  // chat senza aspettare l'hook, cosi' non lampeggia nemmeno per un frame.
  // Nell'intestazione il numero non ci va se e' coperto: la busta e'
  // nascosta e dura un istante, ma quell'istante arriva a tutti i client.
  return ChatMessage.create({
    speaker: { alias: carico.anonimo ? "AGENT" : `AGENT ${carico.da ?? ""}`.trim() },
    content: `<div class="cprx-busta">${cartaChat(carico)}</div>`,
    whisper: ascoltatori(daAttore, aAttore, ...aAttori),
    flags: { [MODULO]: carico }
  });
}

/**
 * Una riga dentro un gruppo: **una busta sola** per tutti i membri, e il
 * postino ne scrive una copia sulla scheda di ognuno.
 *
 * Chi manda non e' per forza un attore: dal numero libero del master il
 * mittente e' `daMaster`, e il numero del master fra i membri diventa
 * `aMaster` — cosi' il postino archivia anche nell'impostazione di mondo.
 *
 * Torna `false` (e avvisa) se non e' rimasto nessuno a cui consegnare.
 */
async function spedisciAlGruppo({
  idGruppo, nomeGruppo = "", membri = [], testo, immagine = "",
  da, daAttore = null, daNome = "", daMaster = false
} = {}) {
  const numeri = [...new Set(membri.map(n => normalizzaNumero(n)).filter(Boolean))];
  const mio = normalizzaNumero(da);
  const destinatari = numeri.filter(n => n !== mio);

  if (!destinatari.length) {
    ui.notifications.warn(game.i18n.localize("CPRX.GruppoPochiMembri"));
    return false;
  }

  const numeroMaster = normalizzaNumero(identitaMaster().numero);
  const attori = [];
  const spenti = [];
  let aMaster = false;

  for (const numero of destinatari) {
    if (numeroMaster && numero === numeroMaster) { aMaster = true; continue; }
    const attore = attorePerNumero(numero);
    if (attore) attori.push(attore);
    else spenti.push(numero);
  }

  if (!attori.length && !aMaster) {
    ui.notifications.warn(game.i18n.format("CPRX.NumeroInesistente",
      { numero: spenti.join(", ") || "—" }));
    return false;
  }

  // Un numero spento non ferma il gruppo: gli altri il messaggio lo devono
  // ricevere lo stesso, e chi scrive deve sapere chi e' rimasto fuori.
  if (spenti.length) {
    ui.notifications.warn(game.i18n.format("CPRX.GruppoNumeriSpenti",
      { numeri: spenti.join(", ") }));
  }

  await invia({
    tipo: TIPO.SMS,
    testo,
    immagine,
    da: mio,
    a: null,
    idGruppo,
    nomeGruppo,
    membri: numeri,
    daAttore,
    daNome,
    daMaster,
    aAttore: null,
    aAttori: attori,
    aMaster
  });
  return true;
}

/**
 * Carta pubblica: quello che l'App fa al tavolo lo vedono tutti. Serve per le
 * azioni che hanno un effetto sulla scena, non per la corrispondenza privata.
 */
async function annuncia(attore, icona, titolo, testo, tiri = []) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attore }),
    content: `<div class="cprx-carta">
      <header class="cprx-carta-testata">
        <i class="${icona}"></i>
        <span class="cprx-carta-titolo">${esc(titolo)}</span>
      </header>
      <p class="cprx-carta-testo">${esc(testo)}</p>
    </div>`,
    rolls: tiri
  });
}

/** Le buste ancora in giacenza che toccano questo Agent. */
function giacenza(attore) {
  const id = attore?.id;
  if (!id) return [];

  const voci = [];
  for (const messaggio of game.messages) {
    const f = messaggio.flags?.[MODULO];
    if (!f?.tipo || !TIPI_DA_ARCHIVIARE.has(f.tipo)) continue;
    const altri = Array.isArray(f.aAttori) ? f.aAttori : [];
    if (f.daAttore !== id && f.aAttore !== id && !altri.includes(id)) continue;
    voci.push({ ...f, quando: f.quando ?? messaggio.timestamp });
  }
  return voci;
}

/**
 * Tutto il traffico che tocca questo Agent, dal piu' vecchio al piu' nuovo:
 * quello gia' archiviato sulla scheda piu' quello ancora in giacenza, senza
 * doppioni. Cosi' il giro funziona anche mentre nessun GM e' collegato.
 */
function traffico(attore) {
  if (!attore) return [];

  const viste = new Set();
  const voci = [];

  for (const voce of [...filo(attore), ...giacenza(attore)]) {
    if (voce.idVoce) {
      if (viste.has(voce.idVoce)) continue;
      viste.add(voce.idVoce);
    }
    voci.push(voce);
  }

  return voci.sort((a, b) => a.quando - b.quando);
}

/**
 * I fili di questo Agent: uno per numero, piu' uno per ogni gruppo.
 *
 * La chiave e' il numero dell'altro capo, oppure `g:<id>` per un gruppo —
 * e' quella che finisce in `stato.conversazione` e nella mappa `letti`.
 */
function conversazioni(attore) {
  const letti = attore.getFlag(MODULO, "letti") ?? {};
  const gruppi = new Map();

  for (const voce of traffico(attore)) {
    if (voce.tipo !== TIPO.SMS && voce.tipo !== TIPO.CHIAMATA) continue;

    const uscente = voce.daAttore === attore.id;
    const diGruppo = !!voce.idGruppo;
    const numero = diGruppo ? null : (uscente ? voce.a : voce.da);
    if (!diGruppo && !numero) continue;

    const chiave = diGruppo ? chiaveGruppo(voce.idGruppo) : numero;

    const gruppo = gruppi.get(chiave)
      ?? { chiave, numero, gruppo: diGruppo, idGruppo: voce.idGruppo ?? null,
           membri: [], nomeGruppo: "",
           voci: [], ultimo: 0, nonLetti: 0, presentazioni: 0, inChiaro: 0 };

    // L'elenco dei membri e il nome sono quelli dell'ultima voce arrivata:
    // chi entra o esce lo fa scrivendo una riga nuova con l'elenco cambiato.
    if (diGruppo) {
      const membri = membriDi(voce);
      if (membri.length) gruppo.membri = membri;
      if (voce.nomeGruppo) gruppo.nomeGruppo = voce.nomeGruppo;
    }

    // La copertura si conta qui, sulle voci grezze, prima che le chiamate si
    // accorpino: una chiamata e' fatta di piu' messaggi e gli ultimi sono
    // spesso miei, quindi la riga accorpata direbbe "in chiaro" anche quando
    // a chiamare era un numero coperto.
    // Un gruppo non si copre: chi ci scrive dentro mostra il numero a tutti
    // quelli che ci sono, e il conto della copertura qui non si fa nemmeno.
    if (!diGruppo && !uscente && vocePresenta(voce)) {
      gruppo.presentazioni += 1;
      if (!voce.anonimo) gruppo.inChiaro += 1;
    }

    // Una chiamata e' fatta di piu' messaggi (squillo, risposta, chiusura) ma
    // nel filo deve restare una riga sola, quella con lo stato piu' recente.
    const precedente = voce.tipo === TIPO.CHIAMATA
      ? gruppo.voci.findIndex(v => v.idChiamata === voce.idChiamata)
      : -1;

    if (precedente >= 0) {
      gruppo.voci[precedente] = { ...voce, uscente: gruppo.voci[precedente].uscente };
    } else {
      gruppo.voci.push({ ...voce, uscente });
      if (!uscente && voce.quando > (letti[chiave] ?? 0)) gruppo.nonLetti += 1;
    }

    gruppo.ultimo = Math.max(gruppo.ultimo, voce.quando);
    gruppi.set(chiave, gruppo);
  }

  for (const gruppo of gruppi.values()) {
    if (gruppo.gruppo) {
      gruppo.coperto = false;
      gruppo.nome = gruppo.nomeGruppo || nomeGruppoPredefinito(gruppo.membri);
      gruppo.etichettaNumero = "";
      continue;
    }

    // Coperto finche' nessuno si e' presentato in chiaro: le proprie risposte
    // non scoprono niente, una riga in chiaro dell'altro si'.
    gruppo.coperto = gruppo.presentazioni > 0 && gruppo.inChiaro === 0 && !vedoInChiaro();
    gruppo.nome = gruppo.coperto
      ? etichettaCoperta()
      : (nomePerNumero(attore, gruppo.numero) || gruppo.numero);
    // Coperto vuol dire coperto: il numero non si mostra da nessuna parte.
    gruppo.etichettaNumero = gruppo.coperto ? "" : gruppo.numero;
  }
  return [...gruppi.values()].sort((a, b) => b.ultimo - a.ultimo);
}

/**
 * I fili da mostrare in Messaggi: quelli con almeno un SMS, e senza le voci
 * delle chiamate.
 *
 * **`conversazioni()` continua a leggere anche le chiamate**, e non e' una
 * dimenticanza: e' li' che si conta la copertura, e uno squillo anonimo e'
 * una presentazione a tutti gli effetti (`vocePresenta()`). Togliere le
 * chiamate da quella funzione aprirebbe un filo coperto. Si filtra qui, dove
 * si mostra.
 */
function conversazioniSms(attore) {
  return conversazioni(attore)
    .map(c => ({ ...c, voci: c.voci.filter(v => v.tipo === TIPO.SMS) }))
    .filter(c => c.voci.length > 0);
}

function messaggiNonLetti(attore) {
  return conversazioniSms(attore).reduce((totale, c) => {
    const letti = attore.getFlag(MODULO, "letti") ?? {};
    const soglia = letti[c.chiave] ?? 0;
    return totale + c.voci.filter(v => !v.uscente && v.quando > soglia).length;
  }, 0);
}

/** `chiave` e' un numero, oppure `g:<id>` per un gruppo. */
async function segnaLetta(attore, chiave) {
  if (!attore?.isOwner) return;
  const letti = { ...(attore.getFlag(MODULO, "letti") ?? {}) };
  letti[chiave] = Date.now();
  await attore.setFlag(MODULO, "letti", letti);
}

/**
 * Lo stato della chiamata non e' scritto da nessuna parte: si ricava
 * dall'ultima catena di voci con lo stesso `idChiamata`. Cosi' uno squillo
 * senza risposta scade da solo, senza timer da fermare quando la finestra
 * si chiude.
 *
 * **I capi sono N.** Una chiamata di gruppo e' la stessa cosa con dentro
 * `membri` — gli stessi numeri che portano i messaggi di gruppo — e lo stato
 * di ognuno si legge dalle sue voci: chi ha risposto, chi ha rifiutato, chi
 * ha riagganciato. Chi non compare sta ancora squillando.
 *
 * La chiamata e' finita per me quando ho chiuso io, o quando non e' rimasto
 * nessun altro in linea.
 */
function chiamataCorrente(attore) {
  const chiamate = traffico(attore).filter(v => v.tipo === TIPO.CHIAMATA);
  if (!chiamate.length) return null;

  const idChiamata = chiamate[chiamate.length - 1].idChiamata;
  const eventi = chiamate.filter(v => v.idChiamata === idChiamata);
  const apertura = eventi[0];
  const mio = numeroDi(attore);

  // I membri sono quelli dell'ultima voce che li porta: chi si aggiunge in
  // corsa manda una voce con l'elenco allargato.
  let membri = [];
  for (const v of eventi) {
    const elenco = membriDi(v);
    if (elenco.length) membri = elenco;
  }
  if (!membri.length) membri = [apertura.da, apertura.a].filter(Boolean);

  // `persa` la scrive chi annulla uno squillo a cui non ha risposto nessuno:
  // vale per tutta la chiamata, non per un capo solo.
  if (eventi.some(v => v.stato === "persa")) return null;

  const statoDi = (numero) => {
    const suoi = eventi.filter(v => normalizzaNumero(v.da) === numero);
    for (let i = suoi.length - 1; i >= 0; i -= 1) {
      if (["risposta", "rifiuto", "chiusa"].includes(suoi[i].stato)) return suoi[i].stato;
    }
    // Chi ha aperto la chiamata e' in linea dal primo squillo.
    return normalizzaNumero(apertura.da) === numero ? "risposta" : "squilla";
  };

  const mioStato = statoDi(mio);
  if (["rifiuto", "chiusa"].includes(mioStato)) return null;

  const altri = membri.filter(n => n !== mio).map(n => ({ numero: n, stato: statoDi(n) }));
  const inLinea = altri.filter(a => a.stato === "risposta");
  const squillano = altri.filter(a => a.stato === "squilla");

  // Nessuno in linea e nessuno che squilla piu': la chiamata e' finita.
  if (!inLinea.length && !squillano.length) return null;

  const risposta = eventi.find(v => v.stato === "risposta");
  const scaduta = !inLinea.length && Date.now() - apertura.quando > DURATA_SQUILLO;
  if (scaduta) return null;
  if (risposta && Date.now() - risposta.quando > DURATA_MASSIMA_CHIAMATA) return null;

  const uscente = normalizzaNumero(apertura.da) === mio;
  const inArrivo = !uscente && mioStato === "squilla";
  const gruppo = membri.length > 2;

  // Il capo di una chiamata a due: e' quello che finisce sul display.
  const numero = uscente ? (altri[0]?.numero ?? apertura.a) : apertura.da;

  // Coperta se squilla anonima, ma anche se sto richiamando un filo coperto:
  // il numero non lo conosco, e il display non deve insegnarmelo. In un
  // gruppo non si copre niente: entrarci vuol dire mostrarsi.
  const coperti = numeriCoperti(attore);
  const coperto = !gruppo && !vedoInChiaro()
    && ((!uscente && !!apertura.anonimo) || coperti.has(numero));

  const nomeDi = (n) => nomePerNumero(attore, n)
    || attorePerNumero(n)?.name
    || n;

  return {
    idChiamata,
    // «In linea» vuol dire che c'e' qualcun altro dall'altra parte: chi ha
    // chiamato e' in linea per definizione, ma finche' non risponde nessuno
    // la sua schermata deve dire «sto chiamando».
    stato: inLinea.length ? "risposta" : "squilla",
    connesso: inLinea.length > 0 && mioStato === "risposta",
    mioStato,
    inArrivo,
    uscente,
    gruppo,
    coperto,
    numero,
    membri,
    // Chi ha riagganciato sparisce dall'elenco: e' uscito dalla stanza, e
    // lasciarlo scritto farebbe sembrare che ci sia ancora.
    partecipanti: altri.filter(a => a.stato !== "chiusa" && a.stato !== "rifiuto").map(a => ({
      numero: a.numero,
      stato: a.stato,
      inLinea: a.stato === "risposta",
      squilla: a.stato === "squilla",
      nome: (!gruppo && coperto) ? etichettaCoperta() : nomeDi(a.numero),
      etichettaNumero: (!gruppo && coperto) ? "" : a.numero
    })),
    etichettaNumero: coperto ? "" : (gruppo ? "" : numero),
    // Il nome di una chiamata di gruppo conta chi c'e' adesso, non chi c'era
    // all'inizio: se due se ne vanno, «Gruppo · 5» sarebbe una bugia.
    nome: gruppo
      ? (apertura.nomeGruppo
          || nomeGruppoPredefinito([mio, ...inLinea.map(a => a.numero), ...squillano.map(a => a.numero)]))
      : (coperto ? etichettaCoperta() : (nomeDi(numero) || (uscente ? apertura.aNome : apertura.daNome))),
    idGruppo: apertura.idGruppo ?? null,
    nomeGruppo: apertura.nomeGruppo ?? "",
    daQuando: apertura.quando,
    rispostaQuando: risposta?.quando ?? null,
    scadeFra: inLinea.length ? 0 : Math.max(0, DURATA_SQUILLO - (Date.now() - apertura.quando))
  };
}

/**
 * Manda una voce di chiamata a tutti i capi: una busta sola, come per i
 * messaggi di gruppo. Vale anche per la telefonata a due — li' `membri` ha
 * due numeri e cambia solo quello.
 */
async function spedisciChiamata({
  idChiamata, stato, membri = [], da, daAttore = null, daNome = "", daMaster = false,
  idGruppo = null, nomeGruppo = "", durata = null, anonimo = undefined
} = {}) {
  const numeri = [...new Set(membri.map(n => normalizzaNumero(n)).filter(Boolean))];
  const mio = normalizzaNumero(da);
  const destinatari = numeri.filter(n => n !== mio);
  if (!destinatari.length) return false;

  const numeroMaster = normalizzaNumero(identitaMaster().numero);
  const attori = [];
  let aMaster = false;

  for (const numero of destinatari) {
    if (numeroMaster && numero === numeroMaster) { aMaster = true; continue; }
    const attore = attorePerNumero(numero);
    if (attore) attori.push(attore);
  }
  if (!attori.length && !aMaster) return false;

  const gruppo = numeri.length > 2;

  await invia({
    tipo: TIPO.CHIAMATA,
    stato,
    idChiamata,
    da: mio,
    // A due capi il destinatario resta scritto: e' quello che leggono le
    // viste vecchie e il registro di sistema.
    a: gruppo ? null : destinatari[0],
    membri: numeri,
    idGruppo,
    nomeGruppo,
    durata,
    daAttore,
    daNome,
    daMaster,
    aAttore: gruppo ? null : attori[0] ?? null,
    aAttori: gruppo ? attori : attori.slice(1),
    aMaster,
    // In un gruppo il numero non si copre, come per i messaggi.
    anonimo: gruppo ? false : anonimo
  });
  return true;
}

/** Come si chiama, a schermo, l'esito di una telefonata. */
const ESITO_CHIAMATA = {
  fatta: "CPRX.ChiamataFatta",
  ricevuta: "CPRX.ChiamataRicevuta",
  persa: "CPRX.ChiamataPersa"
};

/**
 * Lo storico delle chiamate, dalla piu' recente. Una telefonata e' fatta di
 * piu' voci con lo stesso `idChiamata`: qui diventano una riga sola, con
 * l'esito ricavato dalla catena — persa se non c'e' mai stata una risposta.
 *
 * Sta qui e non nei messaggi: su un telefono le chiamate stanno nel telefono.
 * La copertura la applica chi rende (`#coperto()`), come ovunque.
 */
function chiamateRecenti(attore, quante = 40) {
  const righe = new Map();

  for (const voce of traffico(attore)) {
    if (voce.tipo !== TIPO.CHIAMATA) continue;
    const id = voce.idChiamata;
    if (!id) continue;

    const uscente = voce.daAttore === attore.id;
    const riga = righe.get(id) ?? {
      idChiamata: id,
      quando: voce.quando,
      uscente,
      numero: uscente ? voce.a : voce.da,
      nome: uscente ? voce.aNome : voce.daNome,
      anonimo: !uscente && !!voce.anonimo,
      membri: [],
      nomeGruppo: voce.nomeGruppo ?? "",
      risposta: false
    };

    if (Array.isArray(voce.membri) && voce.membri.length) riga.membri = membriDi(voce);
    if (voce.nomeGruppo) riga.nomeGruppo = voce.nomeGruppo;
    if (voce.stato === "risposta") riga.risposta = true;
    riga.quando = Math.max(riga.quando, voce.quando);

    righe.set(id, riga);
  }

  return [...righe.values()]
    .sort((a, b) => b.quando - a.quando)
    .slice(0, quante)
    .map(r => ({
      ...r,
      gruppo: r.membri.length > 2,
      // Tre esiti, come su un telefono: fatta, ricevuta, persa.
      esito: r.uscente ? "fatta" : (r.risposta ? "ricevuta" : "persa")
    }));
}

/** Quante chiamate perse non ancora guardate: il pallino sull'icona Phone. */
function chiamatePerse(attore) {
  const visto = Number(attore?.getFlag(MODULO, "chiamateViste")) || 0;
  return chiamateRecenti(attore)
    .filter(r => r.esito === "persa" && r.quando > visto)
    .length;
}

function sfidaAperta(attore) {
  const sfide = traffico(attore).filter(v => v.tipo === TIPO.SFIDA);
  if (!sfide.length) return null;

  const eventi = sfide.filter(v => v.idSfida === sfide[sfide.length - 1].idSfida);
  if (eventi[eventi.length - 1].stato !== "invito") return null;

  const apertura = eventi[0];
  if (Date.now() - apertura.quando > DURATA_INVITO) return null;

  return { ...apertura, inArrivo: apertura.aAttore === attore.id };
}

/* --- NCPD: lo schedario del GM ---------------------------------------- */

/**
 * Il casellario e' un'impostazione di mondo, non un compendio: ci scrive solo
 * il GM, lo legge chiunque abbia l'App. Chi non e' schedato non risulta —
 * l'App non inventa niente, e' il GM a decidere chi ci finisce dentro.
 */
function schedario() {
  const dati = game.settings.get(MODULO, "ncpdSchedario");
  return Array.isArray(dati?.voci) ? dati.voci : [];
}

async function scriviSchedario(voci) {
  return game.settings.set(MODULO, "ncpdSchedario", { voci });
}


/* --- la carta che finisce in chat ------------------------------------ */

function cartaChat(f) {
  const T = (chiave, dati = {}) => game.i18n.format(chiave, dati);

  const testata = (icona, titolo, riga) => `
    <header class="cprx-carta-testata">
      <i class="${icona}"></i>
      <span class="cprx-carta-titolo">${esc(titolo)}</span>
      ${riga ? `<span class="cprx-carta-riga">${esc(riga)}</span>` : ""}
    </header>`;

  // Il mittente coperto resta coperto anche qui dentro: la busta e' nascosta
  // e viene cancellata, ma finche' esiste il suo contenuto sta sui client di
  // tutti, e scriverci il numero sarebbe stato darlo via.
  const mittente = f.anonimo ? T("CPRX.Sconosciuto") : (f.daNome || f.da);
  // In un gruppo il capo dall'altra parte non e' un numero ma un elenco: la
  // scia dice il nome del gruppo e quanti sono.
  const capo = f.idGruppo
    ? `${f.nomeGruppo || T("CPRX.GruppoTitolo")} (${(f.membri ?? []).length})`
    : (f.a ?? T("CPRX.Servizio"));
  const scia = `${f.anonimo ? T("CPRX.Sconosciuto") : (f.da ?? "?")} → ${capo}`;

  switch (f.tipo) {
    case TIPO.SMS:
      return `<div class="cprx-carta cprx-carta--sms">
        ${testata(f.idGruppo ? "fa-solid fa-users" : "fa-solid fa-comment-sms", mittente, scia)}
        <p class="cprx-carta-testo">${esc(f.testo)}</p>
      </div>`;

    case TIPO.CHIAMATA: {
      const chiavi = {
        squilla: "CPRX.CartaChiamataSquilla",
        risposta: "CPRX.CartaChiamataRisposta",
        rifiuto: "CPRX.CartaChiamataRifiuto",
        chiusa: "CPRX.CartaChiamataChiusa",
        persa: "CPRX.CartaChiamataPersa"
      };
      const testo = T(chiavi[f.stato] ?? chiavi.squilla, {
        da: mittente, a: f.aNome || f.a, durata: f.durata ?? "—"
      });
      return `<div class="cprx-carta cprx-carta--chiamata">
        ${testata("fa-solid fa-phone", mittente, scia)}
        <p class="cprx-carta-testo">${esc(testo)}</p>
      </div>`;
    }

    case TIPO.EMAIL:
      return `<div class="cprx-carta cprx-carta--email">
        ${testata("fa-solid fa-envelope", mittente, scia)}
        <p class="cprx-carta-riga">${esc(f.oggetto || T("CPRX.ZpostSenzaOggetto"))}</p>
        <p class="cprx-carta-testo">${esc(f.testo)}</p>
      </div>`;

    case TIPO.GARDEN:
      return `<div class="cprx-carta cprx-carta--garden">
        ${testata("fa-solid fa-seedling", T("CPRX.AppGardenTitolo"), mittente)}
        <p class="cprx-carta-testo">${esc(f.testo)}</p>
      </div>`;

    case TIPO.SFIDA:
      return `<div class="cprx-carta cprx-carta--sfida">
        ${testata("fa-solid fa-gamepad", T("CPRX.CartaSfidaTitolo"), scia)}
        <p class="cprx-carta-testo">${esc(T(
          f.stato === "invito" ? "CPRX.CartaSfidaInvito" : "CPRX.CartaSfidaRifiuto",
          { da: mittente, a: f.aNome || f.a }))}</p>
      </div>`;

    case TIPO.ESITO:
      return `<div class="cprx-carta cprx-carta--esito">
        ${testata("fa-solid fa-gamepad", T("CPRX.CartaDuelloTitolo"), scia)}
        <p class="cprx-carta-testo">${esc(f.riassunto)}</p>
        ${f.conseguenza ? `<p class="cprx-carta-nota">${esc(f.conseguenza)}</p>` : ""}
      </div>`;

    case TIPO.SERVIZIO:
      return `<div class="cprx-carta cprx-carta--servizio">
        ${testata("fa-solid fa-tower-broadcast", f.titolo ?? T("CPRX.Servizio"), scia)}
        <p class="cprx-carta-testo">${esc(f.testo)}</p>
      </div>`;

    default:
      return `<div class="cprx-carta"><p class="cprx-carta-testo">${esc(f.testo ?? "")}</p></div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Meccaniche delle App                                                 */
/*                                                                      */
/* Le conseguenze si applicano da sole. Ogni scrittura sulla scheda      */
/* passa da un percorso cercato a runtime e sta dentro un try: se il     */
/* sistema cambia nomi, l'App degrada a carta in chat invece di          */
/* rompersi.                                                             */
/* ------------------------------------------------------------------ */

const PERCORSI_STATISTICA = ["stats.%.value", "stats.%.max", "%.value", "%"];

function statistica(attore, nome) {
  for (const modello of PERCORSI_STATISTICA) {
    const valore = Number(foundry.utils.getProperty(attore?.system ?? {}, modello.replace("%", nome)));
    if (Number.isFinite(valore)) return valore;
  }
  return 0;
}

/** Tiro da Cyberpunk RED: 1d10, il 10 esplode e l'1 morde. */
async function tiroCpr(modificatore = 0) {
  const primo = await new Roll("1d10").evaluate();
  let dado = primo.total;
  let nota = "";

  if (primo.total === 10) {
    const extra = await new Roll("1d10").evaluate();
    dado += extra.total;
    nota = "critico";
  } else if (primo.total === 1) {
    const extra = await new Roll("1d10").evaluate();
    dado -= extra.total;
    nota = "fumble";
  }

  return { totale: dado + modificatore, dado, modificatore, nota };
}

/**
 * Con che nome l'Agent si rivolge al proprietario: "handle" o "nome". Sono
 * le uniche due possibilita' — il campo libero dove scrivevi un terzo nome
 * qualsiasi non c'e' piu'.
 */
function salutoCon(attore) {
  return attore?.getFlag(MODULO, "saluto") === "nome" ? "nome" : "handle";
}

/** Handle e nome vero, con i ripieghi: senza handle vale il nome dell'attore. */
function identita(attore) {
  const handle = (attore?.getFlag(MODULO, "handle") ?? "").trim();
  const nome = (attore?.getFlag(MODULO, "nomeVero") ?? "").trim();
  return {
    handle: handle || attore?.name || "",
    nome: nome || attore?.name || ""
  };
}

/**
 * Numero di serie: e' flavor, ma nasce dall'id dell'attore e quindi resta
 * lo stesso per sempre. Un dato finto che cambia a ogni apertura si nota
 * subito e fa sembrare rotto tutto il resto.
 */
/**
 * Il numero della carta e la sua scadenza. Non sono dati: sono cifre di
 * facciata, ricavate dall'identificativo dell'attore come il seriale, e
 * quindi stabili — la stessa carta a ogni apertura. Il mezzo numero coperto
 * (`4471 ·· ·· 8820`) e' quello che una banca stampa davvero.
 */
function numeroCarta(attore) {
  const id = attore?.id ?? "";
  let a = 0, b = 0;
  for (let i = 0; i < id.length; i++) {
    a = (a * 41 + id.charCodeAt(i)) % 10000;
    b = (b * 43 + id.charCodeAt(i)) % 10000;
  }
  const q = (n) => String(n).padStart(4, "0");
  return `${q(a)} ·· ·· ${q(b)}`;
}

function scadenzaCarta(attore) {
  const id = attore?.id ?? "";
  let m = 0;
  for (let i = 0; i < id.length; i++) m = (m * 17 + id.charCodeAt(i)) % 12;
  const anno = istante().getUTCFullYear() + 3;
  return `${String(m + 1).padStart(2, "0")}/${String(anno % 100).padStart(2, "0")}`;
}

function serialeDi(attore) {
  const id = attore?.id ?? "";
  let a = 0, b = 0;
  for (let i = 0; i < id.length; i++) {
    a = (a * 31 + id.charCodeAt(i)) % 46656;
    b = (b * 37 + id.charCodeAt(i)) % 46656;
  }
  const base36 = (n) => n.toString(36).toUpperCase().padStart(3, "0");
  return `CR-${base36(a)}-${base36(b)}`;
}

/* --- la prima accensione ---------------------------------------------- */

/**
 * Un Agent appena tirato fuori dalla scatola non e' il telefono di nessuno:
 * non sa come ti chiami, che sfondo vuoi, dove abiti. Prima di lasciarti
 * entrare fa la stessa cosa che fa un telefono vero — chiede.
 *
 * Il segno che l'ha gia' fatto e' il flag `setup`. E' una sola chiave e non
 * un conto dei passi: mezzo setup non esiste, o l'hai finito o lo rifai.
 *
 * Le domande sono quelle a cui il modulo sa gia' rispondere da solo se non
 * gliele fai — handle, saluto, tema, sfondo, alloggio, vitto, Agent interno.
 * Nessuna e' una meccanica nuova: e' la stessa roba delle Impostazioni e di
 * Casa, chiesta una volta invece che cercata in due schermate.
 */
const SETUP_PASSI = ["avvio", "identita", "aspetto", "casa", "dispositivo"];

function setupFatto(attore) {
  // Una volta che il setup e' cominciato decide solo il flag. Senza questo
  // ramo il primo passo si sabotava da solo: scrivi l'handle, l'euristica
  // qui sotto vede un Agent «gia' usato» e ti butta fuori a meta' giro.
  const segno = attore?.getFlag(MODULO, "setup");
  if (segno) return segno.fatto === true;

  // Un Agent gia' usato non si fa riconfigurare: il setup e' arrivato dopo,
  // e senza questo controllo il primo aggiornamento avrebbe messo la
  // schermata di benvenuto davanti a chi gioca con quel telefono da mesi.
  // Basta un segno di vita — un handle scritto, una voce in rubrica, un
  // messaggio in archivio.
  const dati = attore?.flags?.[MODULO] ?? {};
  return !!(dati.handle || dati.nomeVero
    || (Array.isArray(dati.contatti) && dati.contatti.length)
    || (Array.isArray(dati.filo) && dati.filo.length));
}

/**
 * Il ripristino: il telefono torna come appena comprato e riparte dal setup.
 *
 * Cancella quello che sta **sul dispositivo** — identita', preferenze,
 * rubrica, note, lavori, archivio, registro della banca. Non tocca la scheda
 * del personaggio (eddies e reputazione sono suoi, non del telefono) e non
 * tocca le App comprate: quelle sono pagate, e un ripristino non ti
 * ripresenta il conto. Si riscaricano da sole, come dopo un Agent bruciato.
 */
const CHIAVI_RIPRISTINO = [
  "setup", "handle", "nomeVero", "saluto", "gps", "agentInterno", "sfondo",
  "contatti", "note", "lavori", "banca", "filo", "letti", "chiamateViste",
  "casa", "corp", "calendario", "downtime",
  "fortify", "medscan", "ziggurat", "watchbox", "brainwasher", "bigiaaa",
  "hustool", "roachrace", "elflines", "sentinel", "patchpro", "gladiatore"
];

async function ripristinaAgent(attore) {
  if (!attore?.isOwner) return false;
  const cancella = {};
  for (const chiave of CHIAVI_RIPRISTINO) cancella[`flags.${MODULO}.-=${chiave}`] = null;
  await attore.update(cancella);
  return true;
}

/**
 * L'Agent e' un oggetto: senza quello in inventario il telefono non ce
 * l'hai, e il tasto per aprirlo non deve nemmeno comparire.
 *
 * Il nome e' l'unico appiglio: nel sistema l'Agent e' gear come tutto il
 * resto, e non porta niente che lo distingua a livello di dati.
 *
 * Il confronto e' volutamente largo. Il sistema traduce i compendi con
 * babele, e nelle sue tabelle l'oggetto si chiama "Agent", "Agente",
 * "Agent Interno", "Agente interno", "Internal Agent", "Interner Agent",
 * "Agent wewnetrzny": un `\bagent\b` avrebbe fatto sparire il tasto a
 * tutti i tavoli che giocano in italiano. Vale anche per l'Agent interno,
 * che e' un Agent a tutti gli effetti.
 */
const NOMI_AGENT = /agent/i;

function haOggettoAgent(attore) {
  return (attore?.items ?? []).some(i => NOMI_AGENT.test(i.name ?? ""));
}

/**
 * Chi puo' aprire l'Agent di questo attore. Il master passa sempre: gli
 * serve poter guardare dentro il telefono di chiunque, anche di un NPC a
 * cui non ha mai messo l'oggetto in tasca. L'impostazione di mondo
 * `richiediOggetto` toglie del tutto il vincolo per i tavoli che l'Agent
 * lo danno per scontato.
 */
function puoAvereAgent(attore) {
  if (!attore) return false;
  if (game.user.isGM) return true;
  if (!game.settings.get(MODULO, "richiediOggetto")) return true;
  return haOggettoAgent(attore);
}

function haAgentInterno(attore) {
  if (attore.getFlag(MODULO, "agentInterno")) return true;
  return (attore.items ?? []).some(i =>
    NOMI_AGENT.test(i.name ?? "") && /intern|impiant|wewn/i.test(i.name ?? ""));
}

function agentDistrutto(attore) {
  return attore?.getFlag(MODULO, "agentDistrutto") === true;
}

const NOMI_COMMOZIONE = /commozione|concussion/i;

/** Pesca la ferita critica dai compendi. Se non c'e', restituisce null. */
async function applicaCommozione(attore) {
  for (const pacchetto of game.packs.filter(p => p.documentName === "Item")) {
    let indice;
    try {
      indice = await pacchetto.getIndex();
    } catch (errore) {
      continue;
    }
    const voce = indice.contents.find(v =>
      /critical/i.test(v.type ?? "") && NOMI_COMMOZIONE.test(v.name ?? ""));
    if (!voce) continue;

    try {
      const documento = await pacchetto.getDocument(voce._id);
      await attore.createEmbeddedDocuments("Item", [documento.toObject()]);
      return documento.name;
    } catch (errore) {
      console.warn("cprx-agent | ferita critica non applicabile:", errore);
      return null;
    }
  }
  return null;
}

/* --- casa e vitto ----------------------------------------------------- */

/**
 * Gli alloggi del manuale, col canone mensile. Il Corporativo non paga: la
 * casa gliela da' l'azienda, ed e' anche il guinzaglio — se perde il posto
 * perde pure il tetto, ma quello e' un fatto da giocare, non da automatizzare.
 */
const ALLOGGI = {
  cubicolo: { etichetta: "CPRX.CasaCubicolo", canone: 200 },
  conapt: { etichetta: "CPRX.CasaConapt", canone: 1000 },
  conaptCorp: { etichetta: "CPRX.CasaConaptCorp", canone: 2000, corporativo: true },
  villa: { etichetta: "CPRX.CasaVilla", canone: 5000, corporativo: true },
  strada: { etichetta: "CPRX.CasaStrada", canone: 0 }
};

/** I livelli di vitto: quanto spendi al mese per mangiare. */
const VITTO = {
  kibble: { etichetta: "CPRX.VittoKibble", costo: 100 },
  generico: { etichetta: "CPRX.VittoGenerico", costo: 500 },
  buono: { etichetta: "CPRX.VittoBuono", costo: 1000 }
};

/**
 * Le tabelle qui sopra sono quelle del manuale, e restano dove sono: sono la
 * regola scritta. Ma non sono l'unica verita' — il master puo' aggiungere
 * alloggi e vitti suoi e cambiare i canoni di serie, e quello sta
 * nell'impostazione di mondo `casaExtra`:
 *
 *   { alloggi: [{ chiave, nome, canone }], vitti: [...], canoni: { chiave: n } }
 *
 * Una voce del manuale porta `etichetta` (chiave di lingua), una homebrew
 * porta `nome` (testo scritto dal master): `etichettaCasa()` risolve tutti e
 * due i casi, e nessun chiamante deve sapere quale dei due ha in mano.
 *
 * **Nessuno legge piu' `ALLOGGI` e `VITTO` direttamente.** Si passa da
 * `alloggi()` e `vitti()`, altrimenti un canone cambiato dal master vale in
 * una schermata e non nell'altra.
 */
function casaExtra() {
  const dati = game.settings.get(MODULO, "casaExtra") ?? {};
  return {
    alloggi: Array.isArray(dati.alloggi) ? dati.alloggi : [],
    vitti: Array.isArray(dati.vitti) ? dati.vitti : [],
    canoni: (dati.canoni && typeof dati.canoni === "object") ? dati.canoni : {}
  };
}

async function scriviCasaExtra(dati) {
  return game.settings.set(MODULO, "casaExtra", { ...casaExtra(), ...dati });
}

/** Il nome da mostrare: chiave di lingua per il manuale, testo per l'homebrew. */
function etichettaCasa(def) {
  if (!def) return "";
  return def.etichetta ? game.i18n.localize(def.etichetta) : (def.nome || "—");
}

function tabellaCasa(base, chiaveCosto, elenco) {
  const extra = casaExtra();
  const fuse = {};

  for (const [chiave, def] of Object.entries(base)) {
    const scostamento = Number(extra.canoni?.[chiave]);
    fuse[chiave] = {
      ...def,
      [chiaveCosto]: Number.isFinite(scostamento) ? Math.max(0, scostamento) : def[chiaveCosto],
      // Il canone di serie serve alla console, per dire cosa e' stato cambiato.
      base: def[chiaveCosto]
    };
  }

  for (const voce of extra[elenco]) {
    if (!voce?.chiave) continue;
    const costo = Math.max(0, Math.floor(Number(voce[chiaveCosto] ?? voce.canone ?? voce.costo) || 0));
    fuse[voce.chiave] = { nome: voce.nome || voce.chiave, [chiaveCosto]: costo, homebrew: true };
  }

  return fuse;
}

function alloggi() {
  return tabellaCasa(ALLOGGI, "canone", "alloggi");
}

function vitti() {
  return tabellaCasa(VITTO, "costo", "vitti");
}

/** Il Corporativo ha casa e vitto pagati dall'azienda. */
const NOMI_CORPORATIVO = /corporate|corporativo|corpo\b/i;

function eCorporativo(attore) {
  if (attore?.getFlag(MODULO, "corporativo")) return true;
  if (!game.settings.get(MODULO, "corpGratis")) return false;
  return (attore?.items ?? []).some(i =>
    i.type === "role" && NOMI_CORPORATIVO.test(i.name ?? ""));
}

/**
 * Le migliorie del Quartier Generale, dal DLC «Non c'e' Posto Come Casa».
 * Costano Punti Miglioria (PMQG) e due di loro toccano il conto del mese:
 * la riduzione dell'affitto e l'orto idroponico. Le altre due sono
 * finzione — un'infermeria e un salotto non cambiano una cifra, cambiano
 * dove succedono le cose.
 *
 * Gli sconti sono quelli del prototipo, e sono percentuali di proposito:
 * «una fascia in meno» non si puo' scrivere in una tabella dove il master
 * ha aggiunto alloggi suoi.
 */
const MIGLIORIE_QG = {
  riduzione: { costo: 40, scontoCanone: 0.33 },
  infermeria: { costo: 40 },
  salotto: { costo: 40 },
  orto: { costo: 40, scontoCibo: 0.2 }
};

function statoCasa(attore) {
  const stato = attore?.getFlag(MODULO, "casa") ?? {};
  const corp = eCorporativo(attore);
  const tabellaAlloggi = alloggi();
  const tabellaVitti = vitti();

  const alloggio = tabellaAlloggi[stato.alloggio] ? stato.alloggio
    : (corp ? "conaptCorp" : "conapt");
  const vitto = tabellaVitti[stato.vitto] ? stato.vitto : "generico";

  const migliorie = Array.isArray(stato.migliorie)
    ? stato.migliorie.filter(m => MIGLIORIE_QG[m])
    : [];

  const canonePieno = corp ? 0 : tabellaAlloggi[alloggio].canone;
  const ciboPieno = corp ? 0 : tabellaVitti[vitto].costo;

  // Gli sconti si arrotondano **prima** di sottrarre: un totale che non
  // torna con le due righe che lo compongono e' un totale che nessuno crede.
  const scontoCanone = migliorie.includes("riduzione")
    ? Math.round(canonePieno * MIGLIORIE_QG.riduzione.scontoCanone) : 0;
  const scontoCibo = migliorie.includes("orto")
    ? Math.round(ciboPieno * MIGLIORIE_QG.orto.scontoCibo) : 0;

  const canone = canonePieno - scontoCanone;
  const cibo = ciboPieno - scontoCibo;

  return {
    alloggio,
    vitto,
    corporativo: corp,
    canone,
    cibo,
    canonePieno,
    ciboPieno,
    sconto: scontoCanone + scontoCibo,
    totale: canone + cibo,
    migliorie,
    pmqg: Math.max(0, Math.floor(Number(stato.pmqg) || 0)),
    // Quanti mesi il master ha segnato come non pagati.
    arretrati: Number(stato.arretrati) || 0,
    ultimoPagamento: stato.ultimoPagamento ?? null
  };
}

/**
 * Riscuote il mese su tutti quelli in rubrica: canone e vitto. Chi non ha i
 * soldi **non va sotto zero** — gli si segna un mese di arretrato, e cosa
 * succede a chi non paga l'affitto a Night City lo decide il master.
 *
 * Sta fuori dalla console perche' adesso ha due chiamanti: il tasto del
 * master e il calendario, quando il tempo del mondo scavalca il primo del
 * mese. Il conto e' lo stesso in tutti e due i casi.
 */
async function riscuotiMese({ causale = null } = {}) {
  let pagati = 0;
  let morosi = 0;

  for (const attore of elencoGiocatori()) {
    const stato = statoCasa(attore);
    if (stato.totale <= 0) continue;

    const eddies = trovaEddies(attore);
    const puoPagare = eddies.valore !== null && eddies.valore >= stato.totale;
    const attuale = attore.getFlag(MODULO, "casa") ?? {};

    if (puoPagare && await accredita(attore, -stato.totale)) {
      await segnaMovimento(attore, {
        id: foundry.utils.randomID(),
        quando: Date.now(),
        importo: -stato.totale,
        causale: causale ?? game.i18n.localize("CPRX.CasaCausale"),
        controparte: game.i18n.localize("CPRX.CasaPadrone")
      });
      await attore.setFlag(MODULO, "casa", { ...attuale, ultimoPagamento: Date.now() });
      pagati += 1;
    } else {
      await attore.setFlag(MODULO, "casa", {
        ...attuale,
        arretrati: (Number(attuale.arretrati) || 0) + 1
      });
      morosi += 1;
    }

    Agent.istanze.get(attore.id)?.render();
  }

  return { pagati, morosi };
}

/* --- Corp Link -------------------------------------------------------- */

/**
 * Le Corporazioni del manuale. Quello che sta qui e' la loro scheda —
 * quartier generale, chi comanda, quanta gente ci lavora — e sono dati di
 * ambientazione, non meccaniche: nessuno ci fa un conto sopra.
 *
 * I nomi propri e le cifre stanno in chiaro perche' non si traducono. Quello
 * che e' una frase — settore, uffici, note — passa da una chiave di lingua,
 * altrimenti un tavolo inglese si ritrova «SICUREZZA CORPORATIVA» sullo
 * schermo.
 *
 * Il colore non e' arbitrario: e' quello con cui la Corporazione compare nel
 * prototipo, e diventa la tinta della testata quando l'App e' aperta.
 */
const CORPORAZIONI = {
  arasaka: {
    nome: "Arasaka", glifo: "亜", colore: "#e03b3b",
    dirigente: "Hanako Arasaka", impiegati: "1 000 000"
  },
  militech: {
    nome: "Militech International", glifo: "▼", colore: "#4a7fe0",
    dirigente: "Donald Lundee", impiegati: "350 000 + 700 000"
  },
  biotechnica: {
    nome: "Biotechnica", glifo: "❦", colore: "#6ee7a8",
    dirigente: "Nicolò Loggagia", impiegati: "36 256"
  },
  traumateam: {
    nome: "Trauma Team", glifo: "✚", colore: "#ff2e6e",
    dirigente: "Carrie Lachanan · Bob Jones", impiegati: "15 000"
  },
  petrochem: {
    nome: "Petrochem", glifo: "◆", colore: "#ffb02e",
    dirigente: "Angus Youngblood", impiegati: "338 000"
  },
  sovoil: {
    nome: "SovOil", glifo: "★", colore: "#d8564f",
    dirigente: "Comitato Centrale", impiegati: "245 000"
  },
  continental: {
    nome: "Continental Brands", glifo: "◗", colore: "#e07a3b",
    dirigente: "Olivia Forsythe", impiegati: "147 000"
  },
  dangergal: {
    nome: "Danger Gal", glifo: "◈", colore: "#c98cff",
    dirigente: "Michiko Sanderson", impiegati: "1 800"
  },
  rocklin: {
    nome: "Rocklin Augmentics", glifo: "R", colore: "#8ec5ff",
    dirigente: "Jacinda Hidalgo", impiegati: "125 000"
  },
  network54: {
    nome: "Network 54", glifo: "◉", colore: "#b06ee7",
    dirigente: "Michelle Dreyer", impiegati: "62 000"
  }
};

/** I colori fra cui sceglie chi si inventa una Corporazione sua. */
const COLORI_CORP = ["#e03b3b", "#4a7fe0", "#6ee7a8", "#ffb02e", "#c98cff", "#8fa8c8"];

/**
 * Le cinque aree di serie. **Non sono l'archivio**: sono quello che si vede
 * finche' il master non ha scritto un accesso suo per quella Corporazione.
 * Un'App che si apre vuota non dice cos'e', e un master che deve scrivere
 * cinque righe prima di far vedere qualcosa non la usa.
 *
 * Il livello e' la soglia: un'area e' aperta se il badge ci arriva. Vale
 * anche per le aree scritte dal master — lui decide quali sono e a che
 * livello, il confronto lo fa il modulo.
 */
const AREE_CORP = [
  { chiave: "atrio", livello: 1 },
  { chiave: "uffici", livello: 2 },
  { chiave: "operativi", livello: 3 },
  { chiave: "archivio", livello: 4 },
  { chiave: "eliporto", livello: 5 }
];

/**
 * Cosa puo' scrivere il master nell'archivio di Corp Link. Tre generi, un
 * archivio solo: sono tutte cose che l'azienda dice ai dipendenti, e tenerle
 * in tre impostazioni diverse voleva dire tre volte lo stesso codice.
 */
const CORP_TIPI = {
  avviso: { etichetta: "CPRX.CorpBacheca" },
  accesso: { etichetta: "CPRX.CorpAccessi" },
  incarico: { etichetta: "CPRX.CorpIncarichi" }
};

const LIVELLO_CORP_MASSIMO = 5;

/** Il numero di badge: finto come il seriale, e stabile per la stessa ragione. */
function badgeCorp(attore) {
  const id = attore?.id ?? "";
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 29 + id.charCodeAt(i)) % 1000;
  const lettera = String.fromCharCode(65 + (n % 26));
  return `${String(n).padStart(3, "0")}-${lettera}`;
}

/**
 * A che Corporazione rispondi. Sta nel flag `corp`, e puo' essere una del
 * manuale (`chiave`) o una inventata al tavolo (`nome` e `colore` scritti a
 * mano): `statoCorp()` risolve i due casi, e nessun chiamante deve sapere
 * quale dei due ha in mano — la stessa regola di alloggi e vitti.
 *
 * `attivo` non lo scrive il giocatore: un badge lo sospende l'azienda, e al
 * tavolo l'azienda e' il master. Si spegne dalla console.
 */
function statoCorp(attore) {
  const dati = attore?.getFlag(MODULO, "corp") ?? {};
  const def = CORPORAZIONI[dati.chiave] ?? null;
  const livello = Math.min(LIVELLO_CORP_MASSIMO,
    Math.max(1, Math.floor(Number(dati.livello) || 2)));

  return {
    scelta: !!(def || (dati.nome ?? "").trim()),
    chiave: def ? dati.chiave : "",
    homebrew: !def && !!(dati.nome ?? "").trim(),
    nome: def ? def.nome : (dati.nome ?? "").trim(),
    glifo: def ? def.glifo : ((dati.nome ?? "").trim().charAt(0).toUpperCase() || "?"),
    colore: def ? def.colore : (dati.colore || COLORI_CORP[0]),
    settore: def ? game.i18n.localize(`CPRX.Corp_${dati.chiave}_Settore`)
      : game.i18n.localize("CPRX.CorpIndipendente"),
    qg: def ? game.i18n.localize(`CPRX.Corp_${dati.chiave}_Qg`) : "",
    uffici: def ? game.i18n.localize(`CPRX.Corp_${dati.chiave}_Uffici`) : "",
    note: def ? game.i18n.localize(`CPRX.Corp_${dati.chiave}_Note`) : "",
    dirigente: def ? def.dirigente : "",
    impiegati: def ? def.impiegati : "",
    livello,
    badge: badgeCorp(attore),
    attivo: dati.attivo !== false
  };
}

/**
 * L'archivio aziendale: avvisi, accessi e incarichi che l'azienda mette
 * davanti ai dipendenti.
 *
 * E' un'impostazione di mondo e non un flag, per la stessa ragione del
 * casellario NCPD e del Database Urbano: non appartiene a nessun
 * personaggio. **Ci scrive solo il master**, dalla console; l'App legge e
 * basta, e infatti li' dentro non c'e' un solo tasto di scrittura.
 *
 * Una voce con `corp: "*"` vale per tutte le Corporazioni — un avviso della
 * NET che riguarda chiunque abbia un badge.
 *
 *   { id, corp, tipo, titolo, testo, tag, livello, importo, quando }
 *
 * `livello` lo legge solo un accesso (e' la soglia del badge), `importo`
 * solo un incarico. Una chiave in piu' su una voce che non la usa costa
 * meno di tre archivi da tenere allineati.
 */
function corpArchivio(chiave = null, tipo = null) {
  const dati = game.settings.get(MODULO, "corpArchivio");
  let voci = Array.isArray(dati) ? dati : [];

  if (chiave !== null) voci = voci.filter(v => v.corp === "*" || v.corp === chiave);
  if (tipo !== null) voci = voci.filter(v => (v.tipo ?? "avviso") === tipo);

  return voci.slice().sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0));
}

async function scriviCorpArchivio(voci) {
  return game.settings.set(MODULO, "corpArchivio", voci);
}

/**
 * Come si chiama un'App **su quel telefono**. Per tutte e' il nome del
 * prodotto; per Corp Link e' la Corporazione per cui lavori, perche' sul
 * telefono di un dipendente Arasaka l'icona dice «Arasaka».
 *
 * Sta in un posto solo: griglia, testata e App Store passano di qui, e
 * l'unico che resta al nome del prodotto e' il catalogo — li' stai
 * guardando cosa scarichi, non cosa hai.
 */
function nomeAppPer(attore, chiave) {
  const def = APP_ACQUISTABILI[chiave];
  if (!def) return "";
  if (chiave !== "corp") return def.nome;

  const corp = statoCorp(attore);
  return corp.scelta ? corp.nome : def.nome;
}

/* --- reputazione ------------------------------------------------------ */

/**
 * La reputazione sta sulla scheda, e il sistema la tiene **gia' fatta**:
 * `system.reputation` e' un ledger — `value` piu' `transactions`, coppie
 * `[cosa e' cambiato, perche']` — con la stessa forma di `wealth`.
 *
 * Quindi qui non si tiene niente. Nessun secondo numero, nessun secondo
 * registro: sarebbero due verita' destinate a divergere, la stessa ragione
 * per cui la Banca non tiene un saldo suo. L'Agent legge e basta, e quando
 * scrive passa da `deltaLedgerProperty()`, che e' l'API del sistema e
 * aggiorna valore e registro insieme.
 *
 * Il percorso non e' indovinato: sta in
 * `modules/datamodels/actor/mixins/common-schema.js` e lo usa
 * `_createFacedownRoll()` per tirare COOL + REP.
 */
function trovaReputazione(attore) {
  const rep = attore?.system?.reputation;
  if (!rep || typeof rep !== "object") return { valore: null, registro: [] };

  const valore = Number(rep.value);
  return {
    valore: Number.isFinite(valore) ? valore : null,
    // Le transazioni del sistema sono array di stringhe: `[frase, motivo]`.
    registro: Array.isArray(rep.transactions) ? rep.transactions : []
  };
}

/**
 * I livelli della tabella del manuale: quanto lontano arriva il tuo nome.
 * `da` e' il valore minimo del livello, e l'ultimo prende tutto il resto.
 *
 * Le soglie sono qui e non in un'impostazione perche' sono la tabella, non
 * una preferenza: chi gioca con numeri diversi cambia questa riga. Il
 * confine oltre il quale «ti conoscono in citta'» invece e' un'impostazione
 * (`repPubblica`), perche' quello e' il punto in cui un tavolo decide
 * quanto pesa la fama, e cambia da campagna a campagna.
 */
const LIVELLI_REP = [
  { da: 9, etichetta: "CPRX.RepLeggenda" },
  { da: 7, etichetta: "CPRX.RepRegione" },
  { da: 5, etichetta: "CPRX.RepCitta" },
  { da: 3, etichetta: "CPRX.RepQuartiere" },
  { da: 1, etichetta: "CPRX.RepGiro" },
  { da: -99, etichetta: "CPRX.RepNessuno" }
];

function livelloRep(valore) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return LIVELLI_REP[LIVELLI_REP.length - 1];
  return LIVELLI_REP.find(l => n >= l.da) ?? LIVELLI_REP[LIVELLI_REP.length - 1];
}

/** Sopra questa soglia il nome gira da solo: non serve conoscerti. */
function repPubblica(valore) {
  const soglia = Number(game.settings.get(MODULO, "repPubblica"));
  const n = Number(valore);
  return Number.isFinite(n) && Number.isFinite(soglia) && n >= soglia;
}

/**
 * Muove la reputazione passando dal sistema: `deltaLedgerProperty` scrive
 * il valore **e** la riga nel registro, con la frase gia' tradotta nella
 * lingua del tavolo. Farlo a mano vorrebbe dire scrivere due campi e
 * inventarsi la frase, cioe' rifare peggio una cosa che c'e'.
 */
async function muoviReputazione(attore, quanto, motivo) {
  const delta = Math.trunc(Number(quanto));
  if (!attore?.isOwner || !Number.isFinite(delta) || delta === 0) return false;

  if (typeof attore.deltaLedgerProperty !== "function") {
    console.warn("cprx-agent | il sistema non espone deltaLedgerProperty");
    return false;
  }

  try {
    await attore.deltaLedgerProperty("reputation", delta,
      motivo || game.i18n.localize("CPRX.RepSenzaMotivo"));
    return true;
  } catch (errore) {
    console.warn("cprx-agent | reputazione non scrivibile:", errore);
    return false;
  }
}

/* --- calendario e downtime -------------------------------------------- */

const ORA = 3600;
const GIORNO = 24 * ORA;
const SETTIMANA = 7 * GIORNO;

/**
 * Foundry conta il tempo in secondi da uno zero senza data: `worldTime` e'
 * un contatore, non un calendario. La data la fa questo blocco, mettendo
 * quello zero su un giorno vero — l'impostazione `dataZero`, di serie il
 * primo gennaio 2045, che e' l'anno in cui comincia Cyberpunk RED.
 *
 * I conti si fanno **in UTC**, e non e' pignoleria: con l'ora locale un
 * mondo giocato a cavallo del cambio dell'ora legale sposta la mezzanotte
 * di sessanta minuti, e i giorni cominciano a scivolare. `Date.UTC` piu' i
 * `getUTC*` tengono i giorni larghi esattamente 86400 secondi.
 *
 * Il resto — quanti giorni ha febbraio, i bisestili, che giorno della
 * settimana era — lo sa gia' `Date`. Non c'e' nessuna aritmetica di
 * calendario scritta a mano qui, ed e' voluto: e' il genere di codice che
 * sembra giusto per anni e poi sbaglia un anno su quattro.
 */
function dataZero() {
  const scritta = String(game.settings.get(MODULO, "dataZero") ?? "").trim();
  const pezzi = /^(\d{1,5})-(\d{1,2})-(\d{1,2})$/.exec(scritta);
  if (!pezzi) return Date.UTC(2045, 0, 1);
  return Date.UTC(Number(pezzi[1]), Number(pezzi[2]) - 1, Number(pezzi[3]));
}

/** La data del mondo, come oggetto `Date` da leggere con i `getUTC*`. */
function istante(secondi = null) {
  const t = secondi === null ? (game.time?.worldTime ?? 0) : secondi;
  return new Date(dataZero() + t * 1000);
}

/** `YYYY-MM-DD`: la chiave con cui un evento si aggancia a un giorno. */
function chiaveGiorno(data) {
  const m = String(data.getUTCMonth() + 1).padStart(2, "0");
  const g = String(data.getUTCDate()).padStart(2, "0");
  return `${data.getUTCFullYear()}-${m}-${g}`;
}

function daChiaveGiorno(chiave) {
  const pezzi = /^(\d{1,5})-(\d{1,2})-(\d{1,2})$/.exec(String(chiave ?? ""));
  if (!pezzi) return null;
  return new Date(Date.UTC(Number(pezzi[1]), Number(pezzi[2]) - 1, Number(pezzi[3])));
}

/**
 * L'identificativo della settimana: quante settimane sono passate dallo
 * zero dell'orologio. Serve al downtime, che si dichiara "a settimana" e ha
 * bisogno di una chiave stabile su cui appoggiarsi.
 *
 * **Non e' un numero da mostrare.** In un mondo dove qualcuno ha gia'
 * spostato `worldTime` — e capita, basta un modulo di calendario passato di
 * li' una volta — questo vale cinquemila, e «settimana 5492» non dice
 * niente a nessuno. Per l'utente c'e' `settimanaDellAnno()`.
 */
function settimanaDiGioco(secondi = null) {
  const t = secondi === null ? (game.time?.worldTime ?? 0) : secondi;
  return Math.floor(t / SETTIMANA) + 1;
}

/**
 * La settimana dell'anno, contata come ISO 8601: la settimana 1 e' quella
 * che contiene il primo giovedi' dell'anno. E' il numero che si mostra —
 * sta sempre fra 1 e 53, e non dipende da dove qualcuno ha lasciato
 * l'orologio del mondo.
 *
 * Si conta sul giovedi' della settimana proprio per questo: il giovedi' e'
 * l'unico giorno che cade sempre nell'anno a cui la settimana appartiene,
 * anche quando la settimana sta a cavallo di due anni.
 */
function settimanaDellAnno(data = null) {
  const d = data ?? istante();
  const g = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  // Al giovedi' della stessa settimana, con la settimana che parte lunedi'.
  g.setUTCDate(g.getUTCDate() - ((g.getUTCDay() + 6) % 7) + 3);

  const primoGiovedi = new Date(Date.UTC(g.getUTCFullYear(), 0, 4));
  primoGiovedi.setUTCDate(
    primoGiovedi.getUTCDate() - ((primoGiovedi.getUTCDay() + 6) % 7) + 3);

  return 1 + Math.round((g - primoGiovedi) / (7 * 86400000));
}

/**
 * Il numero da mostrare per una chiave di settimana gia' archiviata: si
 * torna al suo primo istante e si legge che settimana dell'anno era. Cosi'
 * lo storico del downtime non mostra chiavi a cinque cifre.
 */
function etichettaSettimana(chiave) {
  return settimanaDellAnno(istante((Number(chiave) - 1) * SETTIMANA));
}

function formattaData(data, opzioni = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  return data.toLocaleDateString(game.i18n.lang, { ...opzioni, timeZone: "UTC" });
}

/**
 * Le attivita' di downtime. Sono **etichette, non meccaniche**: il modulo
 * non tira niente e non tocca la scheda. Il giocatore dichiara cosa fa
 * nella settimana, il master legge, decide e scrive l'esito.
 *
 * E' deliberato. Automatizzare la cura, gli IP o la paga voleva dire
 * indovinare dove stanno sulla scheda, che e' la trappola gia' pagata con
 * gli effetti: quando il sistema rinomina un campo, l'automatismo smette di
 * funzionare senza dirlo. Qui non c'e' niente che possa rompersi in
 * silenzio, perche' non c'e' niente di automatico.
 */
const ATTIVITA = {
  riposo: { etichetta: "CPRX.DtRiposo", icona: "fa-solid fa-bed" },
  cura: { etichetta: "CPRX.DtCura", icona: "fa-solid fa-kit-medical" },
  allenamento: { etichetta: "CPRX.DtAllenamento", icona: "fa-solid fa-dumbbell" },
  lavoro: { etichetta: "CPRX.DtLavoro", icona: "fa-solid fa-hammer" },
  contatti: { etichetta: "CPRX.DtContatti", icona: "fa-solid fa-handshake" },
  officina: { etichetta: "CPRX.DtOfficina", icona: "fa-solid fa-screwdriver-wrench" },
  rete: { etichetta: "CPRX.DtRete", icona: "fa-solid fa-network-wired" },
  strada: { etichetta: "CPRX.DtStrada", icona: "fa-solid fa-masks-theater" },
  affari: { etichetta: "CPRX.DtAffari", icona: "fa-solid fa-ellipsis" }
};

/**
 * La griglia di un mese: sette colonne, la settimana che comincia di
 * lunedi' come in Europa, e i giorni che sporgono dal mese resi lo stesso —
 * spenti — perche' una griglia con dei buchi si legge peggio di una piena.
 *
 * `scarto` e' in mesi da adesso, non una data: sfogliare avanti e indietro
 * non deve sapere quanti giorni ha il mese in cui sei. `Date.UTC`
 * normalizza da solo, quindi mese 12 diventa gennaio dell'anno dopo e mese
 * -1 dicembre di quello prima, senza un `if` in vista.
 *
 * Sta fuori dalla finestra perche' e' una funzione pura, e una funzione
 * pura si puo' provare: `verifica-tempo.cjs` la esegue davvero, questa,
 * non una sua copia.
 */
function grigliaMese(scarto = 0, riferimento = null) {
  const oggi = riferimento ?? istante();
  const primo = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() + scarto, 1));

  // Il giorno zero del mese seguente e' l'ultimo di questo: e' cosi' che si
  // chiede a `Date` quanti giorni ha un mese senza saperlo.
  const giorniNelMese = new Date(Date.UTC(
    primo.getUTCFullYear(), primo.getUTCMonth() + 1, 0)).getUTCDate();

  // `getUTCDay()` mette la domenica a 0: qui la settimana comincia di
  // lunedi', quindi si ruota.
  const primaCasella = (primo.getUTCDay() + 6) % 7;
  const celle = [];

  const cella = (indice) => new Date(Date.UTC(
    primo.getUTCFullYear(), primo.getUTCMonth(), indice - primaCasella + 1));

  for (let i = 0; i < primaCasella; i += 1) {
    const data = cella(i);
    celle.push({ chiave: chiaveGiorno(data), numero: data.getUTCDate(), fuori: true });
  }

  for (let g = 1; g <= giorniNelMese; g += 1) {
    const data = new Date(Date.UTC(primo.getUTCFullYear(), primo.getUTCMonth(), g));
    celle.push({ chiave: chiaveGiorno(data), numero: g });
  }

  // La coda si riempie fino a chiudere l'ultima riga, cosi' la griglia
  // resta rettangolare invece di finire a scaletta.
  while (celle.length % 7 !== 0) {
    const data = cella(celle.length);
    celle.push({ chiave: chiaveGiorno(data), numero: data.getUTCDate(), fuori: true });
  }

  return { primo, giorniNelMese, primaCasella, celle };
}

/**
 * Il `worldTime` che corrisponde a una data e un'ora scritte a mano.
 * L'inverso di `istante()`: la data e' quella che si legge nel calendario,
 * il numero e' quello che Foundry tiene.
 *
 * Torna `null` se la data non sta in piedi, invece di ripiegare su
 * qualcosa: qui un ripiego silenzioso vorrebbe dire spostare la campagna a
 * un anno che nessuno ha chiesto.
 */
function tempoDaData(giorno, orario = "00:00") {
  const data = daChiaveGiorno(giorno);
  if (!data) return null;

  const pezzi = /^(\d{1,2}):(\d{2})$/.exec(String(orario ?? "").trim());
  const ore = pezzi ? Number(pezzi[1]) : 0;
  const minuti = pezzi ? Number(pezzi[2]) : 0;
  if (ore > 23 || minuti > 59) return null;

  return Math.round((data.getTime() - dataZero()) / 1000) + ore * ORA + minuti * 60;
}

/**
 * Quanti secondi mancano al primo del mese prossimo. Un mese **non e'** un
 * numero fisso di secondi: saltare "trenta giorni" fa scivolare la data di
 * qualche giorno all'anno, e dopo un po' il primo del mese non cade piu' il
 * primo del mese.
 */
function secondiAlMeseProssimo(riferimento = null) {
  const ora = riferimento ?? istante();
  const prossimo = Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth() + 1, 1);
  return Math.round((prossimo - ora.getTime()) / 1000);
}

/**
 * Le iniziali sopra la griglia. Sono chiavi di lingua e non
 * `toLocaleDateString`: una lettera sola va scelta a mano lingua per lingua
 * — in italiano M vale per martedi' e mercoledi', e vanno distinte.
 */
const GIORNI_INIZIALI = [
  "CPRX.GiornoLun", "CPRX.GiornoMar", "CPRX.GiornoMer",
  "CPRX.GiornoGio", "CPRX.GiornoVen", "CPRX.GiornoSab", "CPRX.GiornoDom"
];

/** Il calendario condiviso: lo compila il master, lo legge il tavolo. */
function calendarioVoci() {
  const dati = game.settings.get(MODULO, "calendario");
  return Array.isArray(dati?.voci) ? dati.voci : [];
}

async function scriviCalendario(voci) {
  return game.settings.set(MODULO, "calendario", { voci });
}

/** Le dichiarazioni di downtime di un personaggio, dalla piu' recente. */
function downtimeDi(attore) {
  const voci = attore?.getFlag(MODULO, "downtime");
  return Array.isArray(voci) ? [...voci].sort((a, b) => b.settimana - a.settimana) : [];
}

async function scriviDowntime(attore, voci) {
  return attore.setFlag(MODULO, "downtime", voci);
}

/**
 * Gli avvisi del calendario: «nuova settimana», «nuovo mese, canone
 * addebitato». Non passano dal filo — non sono corrispondenza, non hanno un
 * mittente e non si risponde — quindi hanno un flag loro, che le notifiche
 * della home leggono come quarta sorgente.
 */
const AVVISI_MASSIMI = 20;

async function segnaAvviso(attore, avviso) {
  const attuali = attore.getFlag(MODULO, "calendario")?.avvisi ?? [];
  const avvisi = [...(Array.isArray(attuali) ? attuali : []), {
    id: foundry.utils.randomID(),
    quando: Date.now(),
    ...avviso
  }].slice(-AVVISI_MASSIMI);

  return attore.setFlag(MODULO, "calendario", { avvisi });
}

function avvisiDi(attore) {
  const avvisi = attore?.getFlag(MODULO, "calendario")?.avvisi;
  return Array.isArray(avvisi) ? avvisi : [];
}

/**
 * Quante volte, andando da `prima` a `dopo`, si e' scavalcato il primo del
 * mese. Serve a sapere quanti canoni addebitare quando il master salta un
 * trimestre in un colpo solo.
 */
function mesiScavalcati(prima, dopo) {
  const a = istante(prima);
  const b = istante(dopo);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * Il tempo e' avanzato: si guarda cosa e' stato scavalcato e si tirano le
 * conseguenze. Gira su **un GM solo** — lo stesso eletto che fa il postino —
 * altrimenti con tre GM collegati l'affitto si pagherebbe tre volte.
 *
 * Solo in avanti: se il master riporta indietro l'orologio non succede
 * niente, e riavanzando il mese **riscatta**. Rimettere indietro il tempo e'
 * una correzione, e correggere non deve svuotare i portafogli.
 */
const MESI_MASSIMI_IN_UN_COLPO = 12;

/**
 * La marca che dice «questo non e' tempo che passa, e' la data che viene
 * messa a mano». Viaggia nelle opzioni di `game.time.advance()`, che
 * Foundry porta fino all'hook su tutti i client (`GameTime.onUpdateWorldTime`
 * gliele passa come terzo argomento).
 *
 * Serve perche' spostare la campagna dal 2075 al 2045 sono trent'anni di
 * scarto: senza la marca, l'hook conterebbe trecentosessanta primi del mese
 * e scalerebbe dodici canoni a gente che non ha ancora giocato un turno.
 * Impostare la data e' configurazione, non tempo che passa.
 */
const SALTO_MANUALE = "cprxSalto";

async function tempoAvanzato(nuovo, delta, opzioni = {}) {
  if (opzioni?.[SALTO_MANUALE]) return;
  if (!sonoIlPostino()) return;
  if (!(delta > 0)) return;

  const prima = nuovo - delta;
  const settimane = settimanaDiGioco(nuovo) - settimanaDiGioco(prima);
  const mesi = Math.min(mesiScavalcati(prima, nuovo), MESI_MASSIMI_IN_UN_COLPO);
  const automatico = game.settings.get(MODULO, "mesiAuto") !== false;

  for (let i = 0; i < mesi && automatico; i += 1) {
    const esito = await riscuotiMese({ causale: game.i18n.localize("CPRX.CasaCausale") });
    ui.notifications.info(game.i18n.format("CPRX.CasaRiscosso", esito));
  }

  if (settimane <= 0 && !(mesi > 0 && automatico)) return;

  const data = formattaData(istante(nuovo));
  for (const attore of elencoGiocatori()) {
    if (mesi > 0 && automatico) {
      await segnaAvviso(attore, {
        genere: "mese",
        titolo: game.i18n.localize("CPRX.AvvisoMese"),
        testo: game.i18n.format("CPRX.AvvisoMeseTesto", { data })
      });
    } else if (settimane > 0) {
      await segnaAvviso(attore, {
        genere: "settimana",
        titolo: game.i18n.localize("CPRX.AvvisoSettimana"),
        testo: game.i18n.format("CPRX.AvvisoSettimanaTesto", {
          numero: settimanaDellAnno(istante(nuovo)), data
        })
      });
    }
  }
}

/* --- effetti sulla scheda -------------------------------------------- */

/**
 * Gli effetti delle App diventano ActiveEffect veri: si vedono sul token e
 * nella lista effetti del personaggio, con la loro durata.
 *
 * I bonus si scrivono davvero sulla scheda, e i percorsi **non sono
 * indovinati**: `cyberpunk-red-core` espone le abilita' come
 * `bonuses.<abilita'>` negli ActiveEffect, e i nomi qui sotto sono presi
 * dal sistema stesso (`grep bonuses\.` sui suoi sorgenti). `mode: 2` e'
 * ADD nella scala di Foundry.
 *
 * L'effetto si costruisce **qui**, sempre: niente Item-modello da cui
 * copiare, niente compendio. Se un aggiornamento del sistema rinominasse
 * una chiave l'effetto smetterebbe di sommare senza dirlo, e la riparazione
 * e' cambiare le chiavi in questo file.
 */
const SOMMA = 2;

/**
 * `cyberpunk-red-core` pretende un flag suo accanto ai `changes`, e non e'
 * facoltativo: `CPRMod` legge
 *
 *   effect.flags[game.system.id].changes.cats?.[i]
 *
 * con l'optional chaining su `.cats`, **non** su `flags[...]`. Un effetto
 * con dei changes ma senza quel flag lancia un TypeError dentro
 * `getAllModifiers()`, che porta giu' l'intera lista degli effetti della
 * scheda: l'effetto non "appare sbagliato", sparisce tutto.
 *
 * Anche `situational` va riempito per **ogni** indice, perche' li' il
 * chaining si ferma prima di `.isSituational`.
 *
 * La forma e' quella degli effetti veri scritti a mano nel mondo:
 *   {"cats":{"0":"skill"},"situational":{"0":{"isSituational":false,"onByDefault":false}}}
 */
function flagCambiamentiCpr(cambiamenti, categoria = "skill") {
  const cats = {};
  const situational = {};

  cambiamenti.forEach((_, i) => {
    cats[i] = categoria;
    situational[i] = { isSituational: false, onByDefault: false };
  });

  return { [game.system.id]: { changes: { cats, situational } } };
}

const EFFETTI = {
  medscan: {
    icona: "icons/svg/regen.svg",
    etichetta: "CPRX.EffettoMedscan",
    revocabile: true,
    // I changes veri li mette il livello del consulto, non l'App.
    modifiche: () => []
  },
  ziggurat: {
    icona: "icons/svg/city.svg",
    etichetta: "CPRX.EffettoZiggurat",
    // La guida della citta' ce l'hai o non ce l'hai: non e' un buff a
    // tempo che qualcuno ti toglie, e' l'App che hai comprato.
    revocabile: false,
    modifiche: () => [
      { key: "bonuses.localExpert", mode: SOMMA, value: String(ZIGGURAT_BONUS), priority: null }
    ]
  },
  bigiaaa: {
    icona: "icons/svg/book.svg",
    etichetta: "CPRX.EffettoBigIaaa",
    // Come Ziggurat: e' l'App che hai comprato, non un buff a tempo.
    revocabile: false,
    // Scrive la **differenza**, non il totale: il +2 di serie ce l'ha gia'
    // chi ha un Agent in mano, e non lo mette questo modulo. Sommare 3
    // qui vorrebbe dire +5 al tavolo.
    modifiche: () => [
      {
        key: "bonuses.librarySearch",
        mode: SOMMA,
        value: String(IAAA_BONUS_GRANDE - IAAA_BONUS_BASE),
        priority: null
      }
    ]
  }
};

/** Marca gli effetti nostri, per ritrovarli senza confonderli con altri. */
function effettoNostro(attore, chiave) {
  return (attore?.effects ?? []).find(e => e.getFlag(MODULO, "origine") === chiave) ?? null;
}

/**
 * Accende un effetto sulla scheda. Serve possederla: quando il bersaglio
 * non e' mio, ci pensa il client eletto dallo stesso giro delle altre
 * conseguenze a distanza.
 */
async function accendiEffetto(attore, chiave, {
  descrizione = "", secondi = null, modifiche = null
} = {}) {
  const def = EFFETTI[chiave];
  if (!def || !attore?.isOwner) return false;

  await spegniEffetto(attore, chiave, { forza: true });

  const dati = {
    img: def.icona,
    name: `${game.i18n.localize(def.etichetta)}${descrizione ? ` — ${descrizione}` : ""}`,
    origin: attore.uuid,
    disabled: false,
    flags: { [MODULO]: { origine: chiave } }
  };

  // I modificatori: quelli passati da chi accende (il livello del consulto),
  // altrimenti quelli fissi dell'App.
  dati.changes = modifiche ?? def.modifiche?.() ?? [];

  // Senza il flag del sistema, un effetto con changes fa esplodere la
  // scheda invece di comparirci.
  if (dati.changes.length) {
    dati.flags = { ...dati.flags, ...flagCambiamentiCpr(dati.changes) };
  }

  // La durata si conta sull'orologio del mondo, come tutto il resto in
  // Foundry. Se al tavolo il tempo non avanza l'effetto resta acceso: per
  // quello c'e' il tasto nella console.
  if (secondi) dati.duration = { seconds: secondi, startTime: game.time?.worldTime ?? 0 };

  try {
    await attore.createEmbeddedDocuments("ActiveEffect", [dati]);
    return true;
  } catch (errore) {
    console.warn("cprx-agent | effetto non applicabile:", errore);
    return false;
  }
}

async function spegniEffetto(attore, chiave, { forza = false } = {}) {
  if (!forza && EFFETTI[chiave]?.revocabile === false) return false;
  const effetto = effettoNostro(attore, chiave);
  if (!effetto || !attore?.isOwner) return false;

  try {
    await effetto.delete();
    return true;
  } catch (errore) {
    console.warn("cprx-agent | effetto non cancellabile:", errore);
    return false;
  }
}

/** Conseguenza di un duello perso. La chiama solo il client eletto. */
async function bruciaAgent(attore) {
  const conseguenze = [];
  try {
    await attore.setFlag(MODULO, "agentDistrutto", true);
    await attore.setFlag(MODULO, "appInstallate", []);
    conseguenze.push(game.i18n.format("CPRX.EsitoAgentDistrutto", { nome: attore.name }));
  } catch (errore) {
    console.error("cprx-agent | Agent non marcabile come distrutto:", errore);
    return conseguenze;
  }

  if (!haAgentInterno(attore)) return conseguenze;

  const ferita = await applicaCommozione(attore);
  conseguenze.push(ferita
    ? game.i18n.format("CPRX.EsitoCommozione", { nome: attore.name, ferita })
    : game.i18n.format("CPRX.EsitoCommozioneAMano", { nome: attore.name }));
  return conseguenze;
}

/* --- Digital Gladiator: la scheda e l'arena --------------------------- */

/**
 * Il gladiatore e' un attore vero del mondo — un Solitario di Grado 4 fatto
 * col Pacchetto Completo: 62 punti STAT, 86 di Abilita', 2.550 E$ di
 * equipaggiamento, esplosivi esclusi. L'App non lo costruisce e non lo
 * valida: quelli sono conti da scheda, e la scheda del sistema li fa gia'.
 * Qui si tiene solo il collegamento.
 */
function gladiatoreDi(attore) {
  const id = attore?.getFlag(MODULO, "gladiatore");
  return id ? (game.actors.get(id) ?? null) : null;
}

/** Il curriculum del gladiatore: una riga per duello, vinto o perso. */
function arenaStorico(attore) {
  const dati = attore?.getFlag(MODULO, "arena");
  return Array.isArray(dati) ? dati : [];
}

function arenaBilancio(attore) {
  const voci = arenaStorico(attore);
  return {
    duelli: voci.length,
    vinti: voci.filter(v => v.vinto).length,
    persi: voci.filter(v => !v.vinto).length
  };
}

/**
 * Numeri che stanno sulla scheda ma il cui percorso il sistema decide in
 * codice: si prova un elenco di candidati e si ripiega. Stessa idea di
 * `trovaEddies()`, e stesso motivo — `template.json` non li dichiara.
 */
function trovaNumero(attore, percorsi, ripiego) {
  for (const percorso of percorsi) {
    const valore = Number(foundry.utils.getProperty(attore?.system ?? {}, percorso));
    if (Number.isFinite(valore) && valore > 0) return valore;
  }
  return ripiego;
}

const PERCORSI_FERITE = [
  "derivedStats.hp.max", "derivedStats.hp.value", "hp.max", "health.max"
];
const PERCORSI_ARMATURA = [
  "externalData.currentArmorBody.value", "armor.body.sp", "derivedStats.armor.body", "armor.sp"
];

function schedaArena(attore) {
  return {
    attore,
    nome: attore.name,
    ferite: trovaNumero(attore, PERCORSI_FERITE, 40),
    armatura: trovaNumero(attore, PERCORSI_ARMATURA, 11),
    ref: statistica(attore, "ref"),
    corpo: statistica(attore, "body") || 8
  };
}

/**
 * Un duello e' uno scontro all'ultimo sangue fra due Solitari, e non si puo'
 * interrompere. Qui gira per round: iniziativa, poi ognuno tira addosso
 * all'altro finche' uno resta a zero.
 *
 * ATTENZIONE: questo NON e' il combattimento di Cyberpunk RED. Le armi e le
 * abilita' vere stanno sulla scheda in posti che il sistema decide in
 * codice, e leggerle a tentativi sarebbe un modo elaborato di sbagliare.
 * Qui si tira sulle STAT — REF per colpire e schivare, un danno fisso
 * configurabile, l'armatura che assorbe — e il risultato e' una scazzottata
 * verosimile, non una simulazione. Chi vuole il combattimento vero fa
 * combattere i due gladiatori al tavolo e usa la modalita' arbitrata.
 */
const ARENA_ROUND_MASSIMI = 20;

async function risolviDuello(sfidante, sfidato, { danno = "2d6" } = {}) {
  const uno = schedaArena(sfidante);
  const due = schedaArena(sfidato);

  const iniziativa = [
    { g: uno, tiro: (await tiroCpr(uno.ref)).totale },
    { g: due, tiro: (await tiroCpr(due.ref)).totale }
  ].sort((a, b) => b.tiro - a.tiro);

  const vite = new Map([[uno.attore.id, uno.ferite], [due.attore.id, due.ferite]]);
  const righe = [];
  righe.push(game.i18n.format("CPRX.ArenaIniziativa", {
    primo: iniziativa[0].g.nome, secondo: iniziativa[1].g.nome
  }));

  let round = 0;
  let caduto = null;

  while (!caduto && round < ARENA_ROUND_MASSIMI) {
    round += 1;
    for (const { g } of iniziativa) {
      const bersaglio = g === uno ? due : uno;
      if (vite.get(g.attore.id) <= 0) continue;

      const colpo = await tiroCpr(g.ref);
      const scarto = await tiroCpr(bersaglio.ref);

      if (colpo.totale <= scarto.totale) {
        righe.push(game.i18n.format("CPRX.ArenaMancato", {
          round, chi: g.nome, altro: bersaglio.nome,
          colpo: colpo.totale, schivata: scarto.totale
        }));
        continue;
      }

      const tiro = await new Roll(danno).evaluate();
      const passa = Math.max(1, tiro.total - bersaglio.armatura);
      const restano = Math.max(0, vite.get(bersaglio.attore.id) - passa);
      vite.set(bersaglio.attore.id, restano);

      righe.push(game.i18n.format("CPRX.ArenaColpo", {
        round, chi: g.nome, altro: bersaglio.nome,
        danno: passa, restano
      }));

      if (restano <= 0) { caduto = bersaglio; break; }
    }
  }

  // Nessuno a terra entro il tetto: vince chi sta meglio. Il tetto c'e'
  // perche' due gladiatori corazzati e sfortunati girerebbero all'infinito.
  if (!caduto) {
    const a = vite.get(uno.attore.id);
    const b = vite.get(due.attore.id);
    caduto = a === b ? (Math.random() < 0.5 ? uno : due) : (a < b ? uno : due);
    righe.push(game.i18n.format("CPRX.ArenaTempoScaduto", { round }));
  }

  const perdente = caduto.attore;
  const vincitore = perdente === sfidante ? sfidato : sfidante;

  return {
    vincitore,
    perdente,
    round,
    resoconto: righe,
    riassunto: game.i18n.format("CPRX.EsitoDuelloArena", {
      vincitore: vincitore.name, perdente: perdente.name, round
    })
  };
}

/** Fa avanzare il tempo del mondo, ma solo se chi agisce e' un GM. */
async function avanzaTempo(secondi) {
  if (!game.user.isGM) return false;
  if (!game.settings.get(MODULO, "avanzaTempo")) return false;
  try {
    await game.time.advance(secondi);
    return true;
  } catch (errore) {
    console.warn("cprx-agent | tempo non avanzabile:", errore);
    return false;
  }
}

/* --- 4Tify ----------------------------------------------------------- */

const FORTIFY_SCANSIONE = 300;

function statoFortify(attore) {
  const stato = attore.getFlag(MODULO, "fortify");
  return stato?.bersaglio ? stato : null;
}

/* --- MedScan --------------------------------------------------------- */

/**
 * MedScan, dal manuale: 100 E$ per un'ora di specialista in linea, +1 alle
 * prove di Pronto Soccorso e Paramedico per Stabilizzare o fare un
 * Trattamento Rapido; 500 E$ per quattro ore, +1 a Chirurgia o Tecnologia
 * Medica — il tempo che serve a un trattamento, un'installazione, una
 * bioscultura o un intervento.
 *
 * `abilita` sono i nomi da cercare sulla scheda: il consulto vale per
 * quelle e per nessun'altra, ed e' quello che l'App deve dire in chiaro
 * invece di limitarsi a un timer.
 */
const MEDSCAN_LIVELLI = {
  pronto: {
    prezzo: 100, ore: 1, bonus: 1,
    etichetta: "CPRX.MedscanPronto",
    usi: "CPRX.MedscanUsiPronto",
    // Le chiavi vengono dal sistema, non da un'ipotesi: vedi EFFETTI.
    modifiche: [
      { key: "bonuses.firstAid", mode: 2, value: "1", priority: null },
      { key: "bonuses.paramedic", mode: 2, value: "1", priority: null }
    ]
  },
  chirurgia: {
    prezzo: 500, ore: 4, bonus: 1,
    etichetta: "CPRX.MedscanChirurgia",
    usi: "CPRX.MedscanUsiChirurgia",
    modifiche: [
      { key: "bonuses.surgery", mode: 2, value: "1", priority: null },
      { key: "bonuses.medicalTechSkill", mode: 2, value: "1", priority: null }
    ]
  }
};

function statoMedscan(attore) {
  const stato = attore.getFlag(MODULO, "medscan");
  if (!stato?.fino) return null;
  return { ...stato, scaduto: (game.time?.worldTime ?? 0) >= stato.fino };
}

/**
 * Un abbonato Trauma Team Executive usa l'App senza pagare. Il manuale
 * avverte che abusarne puo' costare l'abbonamento: quella e' una faccenda
 * da tavolo, non da codice — l'App si limita a non chiedere soldi.
 */
function abbonatoTrauma(attore) {
  if (attore?.getFlag(MODULO, "traumaExec")) return true;
  return (attore?.items ?? []).some(i =>
    /trauma team/i.test(i.name ?? "") && /exec/i.test(i.name ?? ""));
}

/* --- Ziggurat -------------------------------------------------------- */

const NOMI_ESPERTO_LOCALE = /local expert|esperto locale|conoscenza locale/i;
const ZIGGURAT_BONUS = 2;

function statoZiggurat(attore) {
  const stato = attore.getFlag(MODULO, "ziggurat");
  return stato?.citta ? stato : null;
}

/**
 * Il Database Urbano del manuale: "uno sportello unico per informazioni su
 * una citta', dai ristoranti ai concerti al sex working". Quindi non un
 * bonus e basta — un elenco vero, che il master compila dalla sua console e
 * chi ha l'App consulta.
 *
 * E' un'impostazione di mondo per la stessa ragione del casellario NCPD:
 * non appartiene a nessun personaggio, e vale per tutto il tavolo.
 */
const ZIGGURAT_CATEGORIE = {
  locali: "CPRX.ZigCatLocali",
  eventi: "CPRX.ZigCatEventi",
  servizi: "CPRX.ZigCatServizi",
  persone: "CPRX.ZigCatPersone",
  zone: "CPRX.ZigCatZone"
};

function zigguratDb() {
  const dati = game.settings.get(MODULO, "zigguratDb");
  return Array.isArray(dati?.voci) ? dati.voci : [];
}

async function scriviZigguratDb(voci) {
  return game.settings.set(MODULO, "zigguratDb", { voci });
}

/* ------------------------------------------------------------------ */
/* Le App del DLC «Tutto sugli Agent»                                   */
/*                                                                      */
/* Le regole vengono dal manuale e sono tutte qui in cima, dove si       */
/* leggono insieme. Quello che il manuale non dice — quanto vale un      */
/* punteggio a Roach Race — non e' stato inventato: si tira e basta.     */
/* ------------------------------------------------------------------ */

/**
 * Il bonus che un Agent da' alle Prove di Archivistica: +2 di serie, +3 con
 * Big IAAA installata. L'effetto scrive la **differenza**, perche' il +2 di
 * base ce l'ha gia' chi ha un Agent in mano e non lo mette questo modulo.
 */
const IAAA_BONUS_BASE = 2;
const IAAA_BONUS_GRANDE = 3;

/**
 * Come si chiama Archivistica sulla scheda. Il confronto e' sul nome perche'
 * i compendi passano da babele — in inglese e' «Library Search», in italiano
 * «Archivistica», e le due parole non si somigliano nemmeno. La stessa
 * ragione per cui `NOMI_ESPERTO_LOCALE` esiste.
 */
const NOMI_ARCHIVISTICA = /library search|archivistica|bibliotheks|recherche|biblioteca/i;

/** Quanto ci mette WatchBox a mappare la stanza, e quanto e' grande. */
const WATCHBOX_MAPPATURA = 300;
const WATCHBOX_LATO = 20;
const WATCHBOX_VD_FURTIVITA = 13;

/** Un lavoretto di HusTool: mezz'ora, dieci eurodollari. */
const HUSTOOL_DURATA = 1800;
const HUSTOOL_PAGA = 10;

/** Il ciclo preparatorio di Brainwasher: un'ora al giorno per una settimana. */
const BRAINWASHER_GIORNI = 7;

/** L'orologio del mondo, con lo zero di ripiego. */
function oraMondo() { return game.time?.worldTime ?? 0; }

function statoBigIaaa(attore) {
  return !!attore.getFlag(MODULO, "bigiaaa")?.acceso;
}

/** Il bonus ad Archivistica che l'Agent sta dando adesso. */
function bonusArchivistica(attore) {
  return statoBigIaaa(attore) ? IAAA_BONUS_GRANDE : IAAA_BONUS_BASE;
}

function statoWatchbox(attore) {
  const stato = attore.getFlag(MODULO, "watchbox");
  return stato?.quando ? stato : null;
}

function statoBrainwasher(attore) {
  const stato = attore.getFlag(MODULO, "brainwasher");
  return {
    sessioni: Number(stato?.sessioni) || 0,
    ultima: Number(stato?.ultima) || null,
    esito: stato?.esito ?? null
  };
}

/**
 * Una sessione di Brainwasher al giorno, e il giorno e' quello del mondo:
 * senza questo controllo si preme il tasto sette volte di fila e il ciclo
 * di una settimana si chiude in tre secondi.
 */
function brainwasherOggiFatta(attore) {
  const { ultima } = statoBrainwasher(attore);
  if (ultima === null) return false;
  return Math.floor(oraMondo() / GIORNO) === Math.floor(ultima / GIORNO);
}

function statoRoach(attore) {
  const stato = attore.getFlag(MODULO, "roachrace");
  return {
    record: Number(stato?.record) || 0,
    partite: Number(stato?.partite) || 0,
    ultima: Number(stato?.ultima) || 0
  };
}

function statoElflines(attore) {
  const stato = attore.getFlag(MODULO, "elflines");
  return stato?.nome ? stato : null;
}

/** Le sei STAT dell'elfo. Sono etichette: il modulo non ci tira niente. */
const ELFLINES_STAT = ["forza", "destrezza", "magia", "oro", "raid", "pvp"];

/**
 * Garden: il Data Pool locale. E' l'unico archivio condiviso su cui scrivono
 * **anche i giocatori**, e per questo i post non ci finiscono dritti — un
 * giocatore non puo' scrivere in un'impostazione di mondo. Passano dalla
 * stessa strada della posta: una busta, e il postino la deposita qui.
 */
const GARDEN_MASSIMO = 120;

/* --- Netwatch Sentinel ----------------------------------------------- */

/**
 * I VD per hackerare un Agent, dal DLC. Cambiano con la qualita' del
 * dispositivo, e cambiano ancora se l'hacker ce l'ha in mano invece che a
 * venti metri: l'accesso diretto non ha bisogno del Breacher.
 */
const QUALITA_AGENT = {
  bassa: { etichetta: "CPRX.QualitaBassa", vdRemoto: 17, vdDiretto: 15 },
  standard: { etichetta: "CPRX.QualitaStandard", vdRemoto: 21, vdDiretto: 17 },
  alta: { etichetta: "CPRX.QualitaAlta", vdRemoto: 24, vdDiretto: 21 }
};

/** Il riavvio del manuale: cinque minuti, e ogni comando installato salta. */
const SENTINEL_RIAVVIO = 300;

/** Come si chiama Elettronica e Sicurezza sulla scheda, in ogni lingua. */
const NOMI_ELETTRONICA = /electronics|security tech|elettronica|sicurezza|elektronik/i;

function statoSentinel(attore) {
  const stato = attore.getFlag(MODULO, "sentinel") ?? {};
  return {
    qualita: QUALITA_AGENT[stato.qualita] ? stato.qualita : "standard",
    riavvio: Number(stato.riavvio) || null,
    registro: Array.isArray(stato.registro) ? stato.registro : []
  };
}

/* --- Ziggurat Patch Pro ---------------------------------------------- */

/** Le quattro linguette dello studio. */
const PATCHPRO_SCHEDE = ["bozze", "pubblicate", "reazioni", "analisi"];

function bozzePatch(attore) {
  const dati = attore.getFlag(MODULO, "patchpro")?.bozze;
  return Array.isArray(dati) ? dati : [];
}

function gardenPatch() {
  const dati = game.settings.get(MODULO, "gardenPatch");
  return Array.isArray(dati?.voci) ? dati.voci : [];
}

async function scriviGardenPatch(voci) {
  return game.settings.set(MODULO, "gardenPatch",
    { voci: voci.slice(-GARDEN_MASSIMO) });
}

/* ------------------------------------------------------------------ */
/* Catalogo della Vetrina                                               */
/* Tutti i compendi di oggetti in un elenco solo. L'indicizzazione e'    */
/* lenta, quindi si fa una volta per sessione: api.svuotaCatalogo() la   */
/* rifa'.                                                                */
/* ------------------------------------------------------------------ */

const TIPI_ESCLUSI = new Set(["skill", "role", "criticalInjury", "critical-injury"]);

const ORDINE_TIPI = [
  "gear", "cyberware", "weapon", "ammo", "armor", "clothing",
  "cyberdeck", "program", "vehicle", "drug", "itemUpgrade"
];

/**
 * Possibili assi di sottocategoria. Non so quale usi il sistema per ogni
 * tipo, quindi si indicizzano tutti e si sceglie a posteriori quello che
 * produce piu' gruppi distinti dentro la categoria aperta.
 */
const CAMPI_SOTTOCATEGORIA = [
  "system.type", "system.category", "system.subtype",
  "system.slotType", "system.weaponType", "system.class", "system.gearType"
];

/**
 * Per i tipi che conosciamo l'asse giusto e' scritto qui, e non si tira a
 * indovinare. Serviva: un pugno di cyberware sono anche armi e portano un
 * `weaponType`, che da solo produce piu' valori distinti di `system.type` —
 * e l'euristica finiva per dividere il Cyberware in "Lanciagranate" e
 * "Corpo a corpo pesante".
 */
const CAMPI_PREFERITI = {
  weapon: "system.weaponType",
  cyberware: "system.type",
  program: "system.class",
  armor: "system.type",
  gear: "system.category",
  clothing: "system.type",
  vehicle: "system.category"
};

/**
 * L'asse su cui dividere una categoria. Si guarda prima la mappa, poi si
 * ripiega sul campo che **copre piu' articoli** — non su quello con piu'
 * valori distinti: un campo che vale per dieci pezzi su trecento puo'
 * avere dieci valori diversi e vincere lo stesso, ed e' esattamente come
 * le armi finivano dentro il cyberware.
 */
function assePerCategoria(categoria, articoli) {
  const copre = (campo) => articoli.filter(a => a.sotto?.[campo]).length;
  const distinti = (campo) => new Set(articoli.map(a => a.sotto?.[campo]).filter(Boolean)).size;

  const preferito = CAMPI_PREFERITI[categoria];
  if (preferito && distinti(preferito) > 1 && copre(preferito) >= articoli.length * 0.5) {
    return preferito;
  }

  let scelto = null;
  let miglioreCopertura = 0;
  let migliorGruppi = 0;

  for (const campo of CAMPI_SOTTOCATEGORIA) {
    const c = copre(campo);
    const g = distinti(campo);
    // Un asse che divide in un gruppo solo non divide niente, e uno che
    // lascia fuori piu' di meta' della categoria confonde e basta.
    if (g <= 1 || c < articoli.length * 0.5) continue;
    if (c > miglioreCopertura || (c === miglioreCopertura && g > migliorGruppi)) {
      miglioreCopertura = c;
      migliorGruppi = g;
      scelto = campo;
    }
  }
  return scelto;
}

const PERCORSI_PREZZO = ["system.price.market", "system.price.value", "system.price", "system.cost"];

function prezzoDi(voce) {
  for (const percorso of PERCORSI_PREZZO) {
    const v = Number(foundry.utils.getProperty(voce, percorso));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

let CATALOGO = null;
let CATALOGO_IN_CORSO = null;

async function costruisciCatalogo() {
  const filtro = (game.settings.get(MODULO, "compendiNegozio") ?? "")
    .split(",").map(x => x.trim()).filter(Boolean);

  const pacchetti = game.packs.filter(p =>
    p.documentName === "Item" && (filtro.length === 0 || filtro.includes(p.metadata.id)));

  const articoli = [];

  for (const pacchetto of pacchetti) {
    let indice;
    try {
      indice = await pacchetto.getIndex({
        fields: ["system.price", "system.cost", "type", ...CAMPI_SOTTOCATEGORIA]
      });
    } catch (errore) {
      console.warn(`cprx-agent | compendio non leggibile: ${pacchetto.metadata.id}`, errore);
      continue;
    }

    for (const voce of indice.contents) {
      const tipo = voce.type ?? "altro";
      if (TIPI_ESCLUSI.has(tipo)) continue;

      const sotto = {};
      for (const campo of CAMPI_SOTTOCATEGORIA) {
        const v = foundry.utils.getProperty(voce, campo);
        if (typeof v === "string" && v.trim()) sotto[campo] = v.trim();
      }

      articoli.push({
        uuid: `Compendium.${pacchetto.metadata.id}.${voce._id}`,
        nome: voce.name,
        immagine: voce.img,
        tipo,
        fonte: pacchetto.metadata.label ?? pacchetto.metadata.id,
        prezzo: prezzoDi(voce),
        disponibilita: foundry.utils.getProperty(voce, "system.price.category") ?? "",
        sotto
      });
    }
  }

  return articoli;
}

async function catalogo() {
  if (CATALOGO) return CATALOGO;
  if (!CATALOGO_IN_CORSO) {
    ui.notifications.info(game.i18n.localize("CPRX.IndicizzoCataloghi"));
    CATALOGO_IN_CORSO = costruisciCatalogo().then(a => {
      CATALOGO = a;
      CATALOGO_IN_CORSO = null;
      return a;
    });
  }
  return CATALOGO_IN_CORSO;
}

function svuotaCatalogo() {
  CATALOGO = null;
  CATALOGO_IN_CORSO = null;
}

function etichettaTipo(tipo) {
  const chiave = `CPRX.Tipo.${tipo}`;
  const tradotta = game.i18n.localize(chiave);
  return tradotta === chiave ? tipo : tradotta;
}

/** Rende leggibile un valore come "cyberEye" o "medium_pistol". */
function leggibile(grezzo) {
  return String(grezzo)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Accesso ai dati sull'attore                                          */
/* ------------------------------------------------------------------ */

function leggiVoci(attore, app) {
  const dati = attore.getFlag(MODULO, app);
  return Array.isArray(dati) ? dati : [];
}

async function scriviVoci(attore, app, voci) {
  return attore.setFlag(MODULO, app, voci);
}

/**
 * Le tre App gratuite della Ziggurat sono di serie: ci sono su ogni Agent,
 * non si comprano e non si disinstallano. Non sono un elenco a parte —
 * stanno in `APP_ACQUISTABILI` come le altre, con `diSerie: true` — perche'
 * un'App definita in due posti e' un'App che prima o poi diverge.
 *
 * Il posto dove la regola vale davvero e' qui: possedute e installate le
 * riportano sempre, quindi la griglia della home, il dock e lo Store le
 * vedono senza sapere niente di tutto questo.
 */
const APP_DI_SERIE = Object.entries(APP_ACQUISTABILI)
  .filter(([, def]) => def.diSerie)
  .map(([chiave]) => chiave);

function appPossedute(attore) {
  const d = attore.getFlag(MODULO, "appPossedute");
  return [...new Set([...APP_DI_SERIE, ...(Array.isArray(d) ? d : [])])];
}

function appInstallate(attore) {
  const d = attore.getFlag(MODULO, "appInstallate");
  return [...new Set([...APP_DI_SERIE, ...(Array.isArray(d) ? d : [])])];
}

/* ------------------------------------------------------------------ */
/* La finestra                                                          */
/* ------------------------------------------------------------------ */

class Agent extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(attore, opzioni = {}) {
    super(opzioni);
    this.attore = attore;
    this.stato = { app: null, modifica: null };
    this._scorrimento = 0;
    // La pagina della home sta sull'istanza, non in `stato`: entrare in
    // un'App e tornare indietro deve riportarti dov'eri.
    this._pagina = 0;
    // A che punto sei della prima accensione. Anche questo e' dove sei
    // adesso, non un dato del personaggio: quello che scegli si salva subito.
    this._setupPasso = 0;
  }

  /**
   * **La finestra non ha cornice.** Il telefono e' disegnato dentro — scocca,
   * tacca, tasti laterali — e due cornici una dentro l'altra erano il motivo
   * per cui il corpo del telefono non era mai stato portato dal mockup.
   *
   * Il prezzo e' che trascinamento e chiusura non ce li da' piu' Foundry: il
   * manico e' la targhetta (`data-manico`, `#agganciaTrascinamento()`) e la
   * chiusura e' il suo tasto, che usa l'azione `close` di ApplicationV2 —
   * quella funziona anche senza cornice.
   *
   * Niente `resizable`: la maniglia sta sulla cornice, e comunque un telefono
   * ha la sua misura.
   */
  static DEFAULT_OPTIONS = {
    classes: ["cprx", "cprx-agent", "cprx-agent-telefono"],
    tag: "div",
    window: {
      frame: false,
      positioned: true,
      title: "CPRX.TitoloAgent",
      icon: "fa-solid fa-mobile-screen-button"
    },
    position: { width: 400, height: 720 },
    actions: {
      apriApp: Agent.#onApriApp,
      home: Agent.#onHome,
      pagina: Agent.#onPagina,
      nuovo: Agent.#onNuovo,
      modifica: Agent.#onModifica,
      elimina: Agent.#onElimina,
      salva: Agent.#onSalva,
      annulla: Agent.#onAnnulla,
      scegliTema: Agent.#onScegliTema,
      salvaPreferenze: Agent.#onSalvaPreferenze,
      // Prima accensione
      setupAvanti: Agent.#onSetupAvanti,
      setupIndietro: Agent.#onSetupIndietro,
      ripristina: Agent.#onRipristina,
      // Corp Link
      corpScheda: Agent.#onCorpScheda,
      commuta: Agent.#onCommuta,
      sblocca: Agent.#onSblocca,
      blocca: Agent.#onBlocca,
      bancaInvia: Agent.#onBancaInvia,
      casaScegli: Agent.#onCasaScegli,
      casaPaga: Agent.#onCasaPaga,
      casaMiglioria: Agent.#onCasaMiglioria,
      // Calendario e downtime
      calMese: Agent.#onCalMese,
      calGiorno: Agent.#onCalGiorno,
      dtApri: Agent.#onDtApri,
      dtSalva: Agent.#onDtSalva,
      dtAnnulla: Agent.#onDtAnnulla,
      dtRitira: Agent.#onDtRitira,
      // Vetrina
      scegliCategoria: Agent.#onScegliCategoria,
      scegliSotto: Agent.#onScegliSotto,
      cerca: Agent.#onCerca,
      abbordabili: Agent.#onAbbordabili,
      compra: Agent.#onCompra,
      // App Store
      compraApp: Agent.#onCompraApp,
      installaApp: Agent.#onInstallaApp,
      disinstallaApp: Agent.#onDisinstallaApp,
      // Rete
      apriConversazione: Agent.#onApriConversazione,
      inviaSms: Agent.#onInviaSms,
      cifra: Agent.#onCifra,
      cancellaCifra: Agent.#onCancellaCifra,
      chiama: Agent.#onChiama,
      gruppoChiama: Agent.#onGruppoChiama,
      rispondiChiamata: Agent.#onRispondiChiamata,
      chiudiChiamata: Agent.#onChiudiChiamata,
      chiamataAggiungi: Agent.#onChiamataAggiungi,
      chiamataInvita: Agent.#onChiamataInvita,
      chiamataSfondo: Agent.#onChiamataSfondo,
      chiamataApri: Agent.#onChiamataApri,
      salvaContatto: Agent.#onSalvaContatto,
      cancellaChat: Agent.#onCancellaChat,
      rigeneraNumero: Agent.#onRigeneraNumero,
      // Phone
      telefonoScheda: Agent.#onTelefonoScheda,
      filtroMsg: Agent.#onFiltroMsg,
      compositore: Agent.#onCompositore,
      filtroGig: Agent.#onFiltroGig,
      filtroBanca: Agent.#onFiltroBanca,
      fasciaStore: Agent.#onFasciaStore,
      bancaPannello: Agent.#onBancaPannello,
      bancaRichiedi: Agent.#onBancaRichiedi,
      sfondo: Agent.#onSfondo,
      apriContatto: Agent.#onApriContatto,
      chiudiContatto: Agent.#onChiudiContatto,
      contattoPreferito: Agent.#onPreferito,
      // Gruppi
      gruppoNuovo: Agent.#onGruppoNuovo,
      gruppoCrea: Agent.#onGruppoCrea,
      gruppoAnnulla: Agent.#onGruppoAnnulla,
      gruppoEsci: Agent.#onGruppoEsci,
      // Agent distrutto
      riparaAgent: Agent.#onRiparaAgent,
      // Digital Gladiator
      sfida: Agent.#onSfida,
      accettaSfida: Agent.#onAccettaSfida,
      rifiutaSfida: Agent.#onRifiutaSfida,
      gladiatoreScegli: Agent.#onGladiatoreScegli,
      gladiatoreApri: Agent.#onGladiatoreApri,
      // 4Tify
      fortifyScandisci: Agent.#onFortifyScandisci,
      fortifyUsa: Agent.#onFortifyUsa,
      fortifyScarta: Agent.#onFortifyScarta,
      // NCPD
      schedaApri: Agent.#onSchedaApri,
      schedaAnnulla: Agent.#onSchedaAnnulla,
      // MedScan
      medscanRichiedi: Agent.#onMedscanRichiedi,
      // Ziggurat
      zigguratSalva: Agent.#onZigguratSalva,
      zigguratConsulta: Agent.#onZigguratConsulta,
      zigguratCategoria: Agent.#onZigguratCategoria,
      zigguratCerca: Agent.#onZigguratCerca,
      // Le App del DLC «Tutto sugli Agent»
      alexCerca: Agent.#onAlexCerca,
      alexTira: Agent.#onAlexTira,
      zpostLinguetta: Agent.#onZpostLinguetta,
      zpostApri: Agent.#onZpostApri,
      zpostChiudi: Agent.#onZpostChiudi,
      zpostRispondi: Agent.#onZpostRispondi,
      zpostInvia: Agent.#onZpostInvia,
      gardenPubblica: Agent.#onGardenPubblica,
      gardenCuore: Agent.#onGardenCuore,
      bangImporto: Agent.#onBangImporto,
      bangDestinatario: Agent.#onBangDestinatario,
      bangInvia: Agent.#onBangInvia,
      husLavoretto: Agent.#onHustoolLavoretto,
      roachGioca: Agent.#onRoachGioca,
      watchAvvia: Agent.#onWatchboxAvvia,
      watchSpegni: Agent.#onWatchboxSpegni,
      bwSessione: Agent.#onBrainwasherSessione,
      bwChiudi: Agent.#onBrainwasherChiudi,
      elfModifica: Agent.#onElfModifica,
      elfAnnulla: Agent.#onElfAnnulla,
      elfSalva: Agent.#onElfSalva,
      iaaaCommuta: Agent.#onIaaaCommuta,
      sentQualita: Agent.#onSentQualita,
      sentScansiona: Agent.#onSentScansiona,
      sentRiavvia: Agent.#onSentRiavvia,
      patchScheda: Agent.#onPatchScheda,
      patchBozza: Agent.#onPatchBozza,
      patchElimina: Agent.#onPatchElimina,
      patchPubblica: Agent.#onPatchPubblica
    }
  };

  static PARTS = { schermo: { template: `modules/${MODULO}/templates/agent.hbs` } };

  static istanze = new Map();

  static apri(attore) {
    if (!attore) {
      ui.notifications.warn(game.i18n.localize("CPRX.NessunAttore"));
      return null;
    }

    // Ultima guardia: i tasti spariscono da soli, ma da macro o dal menu
    // contestuale si arriva comunque qui.
    if (!puoAvereAgent(attore)) {
      ui.notifications.warn(game.i18n.format("CPRX.SenzaAgent", { nome: attore.name }));
      return null;
    }
    let finestra = Agent.istanze.get(attore.id);
    if (!finestra) {
      finestra = new Agent(attore, { id: `cprx-agent-${attore.id}` });
      Agent.istanze.set(attore.id, finestra);
    }
    finestra.render(true);

    // Un Agent senza numero non e' raggiungibile: glielo si da' qui, alla
    // prima apertura, invece di scrivere su tutte le schede del mondo.
    if (attore.isOwner && !numeroDi(attore)) {
      assegnaNumero(attore).then(() => finestra.render());
    }
    return finestra;
  }

  get title() {
    return `${game.i18n.localize("CPRX.TitoloAgent")} — ${this.attore?.name ?? ""}`;
  }

  get puoScrivere() {
    return this.attore?.isOwner === true;
  }

  /** Come l'Agent chiama il proprietario nel messaggio di bentornato. */
  get appellativo() {
    const chi = identita(this.attore);
    return salutoCon(this.attore) === "nome" ? chi.nome : chi.handle;
  }

  /* ---------------------------------------------------------------- */
  /* Contesto                                                          */
  /* ---------------------------------------------------------------- */

  async _prepareContext(options) {
    const base = {
      nomeAttore: this.attore?.name ?? "",
      immagine: this.attore?.img ?? "",
      puoScrivere: this.puoScrivere,
      numeroMio: numeroDi(this.attore),
      eGm: game.user.isGM,
      scanlines: game.settings.get(MODULO, "scanlines") !== false,
      // Serve alla spia nella barra di stato, che sta fuori da ogni vista:
      // va in `base`, altrimenti l'interruttore risulta sempre spento.
      gps: !!this.attore?.getFlag(MODULO, "gps"),
      // Marca la scocca con l'App aperta: e' l'aggancio da cui ognuna
      // prende la propria tinta.
      appCorrente: this.stato.app ?? "home",
      bentornato: game.i18n.format("CPRX.Bentornato", { nome: this.appellativo }),
      // Sulla targhetta, dove la cornice di Foundry avrebbe messo il titolo.
      nomeAttore: this.attore?.name ?? "",
      // Lo sfondo si vede sulla home **e** sul vetro di blocco, che sono due
      // viste diverse: come la barra di stato, sta nel contesto comune.
      sfondo: percorsoSfondo(sfondoDi(this.attore)),
      ...this.#contestoDock()
    };

    // Un Agent bruciato non fa altro: la schermata di guasto copre tutto.
    if (agentDistrutto(this.attore)) return { ...base, ...this.#contestoDistrutto() };

    // Un telefono che squilla ha la precedenza su qualunque cosa tu stia
    // facendo, vetro di blocco compreso: si risponde senza sbloccare.
    //
    // A meno che la chiamata non sia stata mandata in secondo piano: allora
    // resta aperta, ma il telefono torna usabile e di lei resta la striscia
    // in cima. Il permesso vale **solo** per una chiamata gia' risposta —
    // uno squillo in arrivo prende sempre lo schermo.
    const chiamata = chiamataCorrente(this.attore);
    const inSfondo = !!chiamata
      && this._chiamataSfondo === chiamata.idChiamata
      && chiamata.connesso;

    if (chiamata && !inSfondo) return { ...base, ...this.#contestoChiamata(chiamata) };
    if (inSfondo) Object.assign(base, this.#contestoBarraChiamata(chiamata));
    // La chiamata e' finita: la striscia non deve sopravviverle.
    if (!chiamata && this._chiamataSfondo) this._chiamataSfondo = null;

    // Un Agent mai configurato non ha niente da mostrare: prima si accende.
    // Sta **dopo** la chiamata e prima del vetro di blocco — un telefono che
    // squilla si risponde comunque, ma un telefono nuovo non ha un vetro di
    // blocco da alzare finche' non sa di chi e'.
    //
    // Il vincolo e' `puoScrivere`: chi non possiede la scheda non puo'
    // rispondere alle domande, e gli si mostra il telefono com'e'.
    if (!setupFatto(this.attore) && this.puoScrivere) {
      return { ...base, ...this.#contestoSetup() };
    }

    // Il vetro di blocco copre tutto il resto finche' non arriva l'impronta.
    if (!this._sbloccato) return { ...base, ...this.#contestoBlocco() };

    switch (this.stato.app) {
      case null:
      case undefined:
        return { ...base, ...this.#contestoHome() };
      case "impostazioni":
        return { ...base, ...this.#contestoImpostazioni() };
      case "negozio":
        return { ...base, ...(await this.#contestoNegozio()) };
      case "appstore":
        return { ...base, ...this.#contestoAppStore() };
      case "messaggi":
        if (this.stato.nuovoGruppo) return { ...base, ...this.#contestoNuovoGruppo() };
        return this.stato.conversazione
          ? { ...base, ...this.#contestoConversazione(this.stato.conversazione) }
          : { ...base, ...this.#contestoMessaggi() };
      case "telefono":
        return { ...base, ...this.#contestoTelefono() };
      case "banca":
        return { ...base, ...this.#contestoBanca() };
      case "casa":
        return { ...base, ...this.#contestoCasa() };
      case "calendario":
        return { ...base, ...this.#contestoCalendario() };
    }

    // App acquistata e installata.
    if (APP_ACQUISTABILI[this.stato.app]) {
      const vista = APP_ACQUISTABILI[this.stato.app].vista;
      const costruttori = {
        gladiator: () => this.#contestoGladiator(),
        fortify: () => this.#contestoFortify(),
        ncpd: () => this.#contestoNcpd(),
        medscan: () => this.#contestoMedscan(),
        ziggurat: () => this.#contestoZiggurat(),
        reputazione: () => this.#contestoReputazione(),
        alex: () => this.#contestoAlex(),
        zpost: () => this.#contestoZpost(),
        garden: () => this.#contestoGarden(),
        bangme: () => this.#contestoBangme(),
        hustool: () => this.#contestoHustool(),
        roachrace: () => this.#contestoRoach(),
        watchbox: () => this.#contestoWatchbox(),
        brainwasher: () => this.#contestoBrainwasher(),
        elflines: () => this.#contestoElflines(),
        bigiaaa: () => this.#contestoBigIaaa(),
        sentinel: () => this.#contestoSentinel(),
        patchpro: () => this.#contestoPatchpro(),
        corp: () => this.#contestoCorp()
      };
      if (costruttori[vista]) {
        return { ...base, ...this.#intestazioneApp(this.stato.app), ...costruttori[vista]() };
      }
      return { ...base, ...this.#contestoAppInstallata(this.stato.app) };
    }

    const def = APP[this.stato.app];
    if (!def) return { ...base, ...this.#contestoHome() };

    const voci = leggiVoci(this.attore, this.stato.app);
    if (this.stato.modifica) return { ...base, ...this.#contestoModulo(def, voci) };
    // I lavori hanno una schermata loro: committente, avanzamento e paga
    // sono tre cose che l'elenco generico appiattirebbe in una riga sola.
    if (this.stato.app === "lavori") return { ...base, ...this.#contestoLavori(def, voci) };
    return { ...base, ...this.#contestoElenco(def, voci) };
  }

  /**
   * Il dock: quattro tessere fisse sotto lo schermo. E' l'ultimo pezzo del
   * mockup che mancava, e su un telefono e' la cosa che si usa di piu'.
   *
   * Sta nel contesto comune perche' si rende fuori da ogni vista: la stessa
   * regola della barra di stato.
   */
  #contestoDock() {
    const app = this.stato.app;
    const scheda = this.stato.telefonoScheda;

    return {
      // Il dock e' la scrivania del telefono: sul vetro di blocco e dentro
      // una chiamata non c'e', perche' li' non c'e' niente da aprire.
      dock: [
        {
          app: "telefono", icona: APP.telefono.icona,
          etichetta: game.i18n.localize("CPRX.AppTelefono"),
          attiva: app === "telefono" && scheda !== "contatti",
          conteggio: chiamatePerse(this.attore)
        },
        {
          app: "messaggi", icona: APP.messaggi.icona,
          etichetta: game.i18n.localize("CPRX.AppMessaggi"),
          attiva: app === "messaggi",
          conteggio: messaggiNonLetti(this.attore)
        },
        {
          // La rubrica nel dock non ci sta: sta dentro Phone, a un tocco di
          // distanza. Qui ci va la Banca, che invece si apre di continuo.
          app: "banca", icona: APP.banca.icona,
          etichetta: game.i18n.localize("CPRX.AppBanca"),
          attiva: app === "banca"
        },
        {
          app: "lavori", icona: APP.lavori.icona,
          etichetta: game.i18n.localize("CPRX.AppLavori"),
          attiva: app === "lavori"
        }
      ]
    };
  }

  #contestoHome() {
    const lavori = leggiVoci(this.attore, "lavori");
    const attivi = lavori.filter(l => l.stato === "proposto" || l.stato === "corso");

    const installate = appInstallate(this.attore)
      .filter(chiave => APP_ACQUISTABILI[chiave])
      .map(chiave => ({
        chiave,
        icona: APP_ACQUISTABILI[chiave].icona,
        // Corp Link porta il nome della Corporazione: sulla griglia di un
        // dipendente Arasaka l'icona dice «Arasaka». Il nome del prodotto
        // resta in vetrina, che e' l'unico posto dove lo compri.
        etichetta: nomeAppPer(this.attore, chiave)
      }));

    const pagina = Math.min(PAGINE_HOME - 1, Math.max(0, this._pagina ?? 0));
    const ora = (quando) => new Date(quando)
      .toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" });

    return {
      vistaHome: true,
      // Lo sfondo si vede qui e sul vetro di blocco, e in nessun altro posto.
      sfondoVisibile: !!percorsoSfondo(sfondoDi(this.attore)),

      /* --- scorrimento delle tre pagine --- */
      pagina,
      paginaQuadro: pagina === 0,
      paginaApp: pagina === 1,
      paginaSistema: pagina === 2,
      pista: `translateX(-${pagina * (100 / PAGINE_HOME)}%)`,
      pagine: Array.from({ length: PAGINE_HOME }, (_, i) => ({ indice: i, attiva: i === pagina })),

      /* --- pagina 0: quadro e scheda del dispositivo --- */
      dataLunga: new Date().toLocaleDateString(game.i18n.lang,
        { weekday: "short", day: "2-digit", month: "short" }).toUpperCase(),
      handle: this.appellativo,
      nomeSotto: salutoCon(this.attore) === "nome"
        ? identita(this.attore).handle
        : identita(this.attore).nome,
      ...this.#contestoDispositivo(attivi.length),
      ...this.#contestoNotifiche(ora),
      nonLetti: messaggiNonLetti(this.attore),

      /* --- pagina 1: applicazioni --- */
      // Un'App con `dentro` non ha una casella sua: ci si arriva da un'altra.
      app: Object.entries(APP).filter(([, def]) => !def.dentro).map(([chiave, def]) => ({
        chiave,
        icona: def.icona,
        etichetta: game.i18n.localize(def.etichetta),
        conteggio: chiave === "messaggi"
          ? messaggiNonLetti(this.attore)
          : (chiave === "telefono"
              ? chiamatePerse(this.attore)
              : (def.speciale ? 0 : leggiVoci(this.attore, chiave).length))
      })),
      installate,
      quanteApp: Object.keys(APP).filter(c => !APP[c].dentro).length + installate.length,

      /* --- pagina 2: rete e sistema --- */
      ...this.#contestoSistema(ora)
    };
  }

  /**
   * Le tre cifre sotto l'identita', nel quadro della home: quante persone
   * hai in rubrica, quanti lavori hai aperti, quanto vale il tuo nome.
   *
   * Prima qui c'era la scheda del dispositivo — modello, numero, seriale.
   * Sono dati che non cambiano mai e che si leggono comunque nella pagina
   * di sistema: nel quadro rubavano righe alle notifiche, che sono la cosa
   * che si guarda davvero. La reputazione non e' una copia: la legge dal
   * ledger del sistema, come StreetWire.
   */
  #modelloAgent() {
    return haAgentInterno(this.attore) ? "KIROSHI · IN-LINE" : "AGENT · POCKET";
  }

  #contestoDispositivo(quantiLavori) {
    const rep = trovaReputazione(this.attore);

    return {
      modelloAgent: this.#modelloAgent(),
      conteggi: [
        {
          valore: leggiVoci(this.attore, "contatti").length,
          etichetta: game.i18n.localize("CPRX.AppContatti")
        },
        {
          valore: quantiLavori,
          etichetta: game.i18n.localize("CPRX.RiepilogoAttivi")
        },
        {
          valore: rep.valore === null ? "—" : rep.valore,
          etichetta: game.i18n.localize("CPRX.StreetCred")
        }
      ]
    };
  }

  /**
   * Le notifiche: cosa e' successo sull'Agent, non cosa c'e' scritto dentro.
   * Tre sorgenti — il filo (messaggi, chiamate, sfide), il registro della
   * banca, e le voci messe dal master su contatti, lavori e note.
   *
   * Un numero coperto resta coperto anche qui: la notifica passa da
   * `#coperto()` come tutto il resto.
   */
  #contestoNotifiche(ora) {
    const mio = this.attore.id;
    const letti = this.attore.getFlag(MODULO, "letti") ?? {};
    const avvisi = [];

    for (const v of traffico(this.attore)) {
      const uscente = v.daAttore === mio;
      if (uscente) continue;

      const numero = v.da;
      // Un messaggio di gruppo non si apre col numero di chi l'ha scritto:
      // la chiave del filo e' quella del gruppo, e il titolo e' il suo nome.
      const chiave = v.idGruppo ? chiaveGruppo(v.idGruppo) : numero;
      const coperto = !v.idGruppo && this.#coperto(numero, !!v.anonimo);
      const chi = coperto
        ? etichettaCoperta()
        : (nomePerNumero(this.attore, numero) || v.daNome || numero || "—");

      if (v.tipo === TIPO.SMS) {
        avvisi.push({
          genere: v.idGruppo ? "gruppo" : "sms",
          icona: v.idGruppo ? "fa-solid fa-users" : "fa-solid fa-comment-sms",
          titolo: v.idGruppo
            ? (v.nomeGruppo || nomeGruppoPredefinito(membriDi(v)))
            : chi,
          testo: v.idGruppo
            ? `${chi}: ${(v.testo ?? "").slice(0, 60)}`
            : (v.testo ?? "").slice(0, 70),
          quando: v.quando, app: "messaggi", numero: chiave,
          nuovo: v.quando > (letti[chiave] ?? 0)
        });
      } else if (v.tipo === TIPO.CHIAMATA && v.stato === "squilla") {
        // Persa se nella catena non c'e' mai stata una risposta.
        const catena = traffico(this.attore).filter(x => x.idChiamata === v.idChiamata);
        const risposta = catena.some(x => x.stato === "risposta");
        avvisi.push({
          genere: risposta ? "chiamata" : "persa",
          icona: risposta ? "fa-solid fa-phone" : "fa-solid fa-phone-slash",
          titolo: chi,
          testo: game.i18n.localize(risposta ? "CPRX.AvvisoChiamataFatta" : "CPRX.AvvisoChiamataPersa"),
          quando: v.quando,
          // Una chiamata si apre nel telefono, sotto «recenti»: nei messaggi
          // non c'e' piu' niente da vedere.
          app: "telefono", scheda: "recenti",
          nuovo: !risposta && v.quando > (Number(this.attore.getFlag(MODULO, "chiamateViste")) || 0)
        });
      } else if (v.tipo === TIPO.SFIDA && v.stato === "invito") {
        avvisi.push({
          genere: "sfida", icona: APP_ACQUISTABILI.gladiator.icona,
          titolo: chi, testo: game.i18n.localize("CPRX.AvvisoSfidaBreve"),
          quando: v.quando, app: "gladiator"
        });
      }
    }

    for (const m of movimenti(this.attore)) {
      avvisi.push({
        genere: m.importo > 0 ? "entrata" : "uscita",
        icona: APP.banca.icona,
        titolo: game.i18n.format(m.importo > 0 ? "CPRX.AvvisoAccredito" : "CPRX.AvvisoAddebito",
          { quanto: Math.abs(m.importo) }),
        testo: m.causale || m.controparte || game.i18n.localize("CPRX.BancaSenzaCausale"),
        quando: m.quando, app: "banca"
      });
    }

    // Il calendario: settimane e mesi che passano. Non sono corrispondenza
    // e non hanno un mittente, per questo hanno un flag loro.
    // Il genere e' sempre `master`: l'addebito del canone la sua riga rossa
    // ce l'ha gia' dal registro della banca, e ripeterla qui la
    // raddoppierebbe.
    for (const a of avvisiDi(this.attore)) {
      avvisi.push({
        genere: "master",
        icona: APP.calendario.icona,
        titolo: a.titolo, testo: a.testo,
        quando: a.quando, app: "calendario"
      });
    }

    // Quello che il master ha messo sulla scheda: un incarico, un contatto.
    for (const [chiave, def] of Object.entries(APP)) {
      if (def.speciale) continue;
      for (const v of leggiVoci(this.attore, chiave)) {
        if (!v.daMaster || !v.creato) continue;
        avvisi.push({
          genere: "master", icona: def.icona,
          titolo: def.titolo(v),
          testo: game.i18n.localize(def.etichetta),
          quando: v.creato, app: chiave
        });
      }
    }

    // Una notifica con un numero apre quel filo, non l'elenco: toccarla
    // deve portarti dove e' successa la cosa.
    const elenco = avvisi
      .sort((a, b) => b.quando - a.quando)
      .slice(0, 8)
      .map(a => ({
        ...a,
        ora: ora(a.quando),
        azione: a.numero ? "apriConversazione" : "apriApp"
      }));

    return { notifiche: elenco, haNotifiche: elenco.length > 0 };
  }

  /**
   * La pagina di sistema. Il mockup qui mostrava segnale, batteria e tre
   * interruttori inventati: al loro posto stanno le uniche cose che l'Agent
   * sa davvero di se stesso — il numero, quanto e' pieno l'archivio, se il
   * dispositivo e' impiantato — e il registro e' il filo vero.
   */
  #contestoSistema(ora) {
    const voci = filo(this.attore);
    const limite = limiteFilo();

    const registro = traffico(this.attore)
      .slice(-4)
      .reverse()
      .map(v => ({
        ora: ora(v.quando),
        allarme: v.tipo === TIPO.CHIAMATA && ["persa", "rifiuto"].includes(v.stato),
        testo: this.#rigaRegistro(v)
      }));

    return {
      numeroSistema: numeroDi(this.attore) || "—",
      agentInterno: haAgentInterno(this.attore),
      archivio: voci.length,
      archivioLimite: limite,
      archivioPercento: Math.min(100, Math.round((voci.length / limite) * 100)),
      registro,
      haRegistro: registro.length > 0,

      /* La scheda del dispositivo sta qui, non piu' nel quadro: sono dati
         che non cambiano mai, e questa e' la pagina dove si vanno a
         cercare. */
      dispositivo: [
        { etichetta: game.i18n.localize("CPRX.Dispositivo"), valore: this.#modelloAgent() },
        { etichetta: game.i18n.localize("CPRX.NumeroSerie"), valore: serialeDi(this.attore) }
      ]
    };
  }

  /** Una riga di registro: cosa e' successo, non con chi. */
  #rigaRegistro(voce) {
    const chiave = {
      [TIPO.SMS]: "CPRX.RegistroSms",
      [TIPO.CHIAMATA]: "CPRX.RegistroChiamata",
      [TIPO.SFIDA]: "CPRX.RegistroSfida"
    }[voce.tipo] ?? "CPRX.RegistroTraffico";

    const uscente = voce.daAttore === this.attore.id;
    return game.i18n.format(chiave, {
      verso: game.i18n.localize(uscente ? "CPRX.RegistroUscita" : "CPRX.RegistroEntrata")
    });
  }

  /* ---------------------------------------------------------------- */
  /* Rete: messaggi, chiamate, guasto                                  */
  /* ---------------------------------------------------------------- */

  /**
   * La prima accensione. Cinque passi, uno per schermata, e alla fine il
   * telefono e' tuo: come ti chiami, che faccia ha, dove abiti, com'e' fatto
   * il dispositivo.
   *
   * **Non chiede niente di nuovo.** Ogni passo e' un pezzo di una schermata
   * che gia' esiste — Impostazioni e Casa — chiesto una volta invece che
   * lasciato da cercare. Per questo i tasti dei temi e degli sfondi sono
   * quelli veri (`scegliTema`, `sfondo`): scrivono subito, e il setup li
   * mostra e basta.
   *
   * Il passo sta su `this._setupPasso`, sull'istanza come `_pagina`: e' dove
   * sei arrivato adesso, non un dato del personaggio. Quello che si salva a
   * ogni passo, invece, va sulla scheda: chi chiude la finestra a meta' non
   * deve ricominciare da capo, e ritrova il setup dove l'aveva lasciato.
   */
  #contestoSetup() {
    const passo = SETUP_PASSI[this._setupPasso] ?? SETUP_PASSI[0];
    const indice = SETUP_PASSI.indexOf(passo);
    const chi = identita(this.attore);
    const stato = statoCasa(this.attore);
    const temaAttuale = game.settings.get(MODULO, "tema");

    return {
      vistaSetup: true,
      appCorrente: "setup",
      // Come il vetro di blocco: il setup copre tutto, dock compreso.
      dock: null,
      sfondoVisibile: passo === "aspetto" && !!percorsoSfondo(sfondoDi(this.attore)),

      setupPasso: passo,
      setupAvvio: passo === "avvio",
      setupIdentita: passo === "identita",
      setupAspetto: passo === "aspetto",
      setupCasa: passo === "casa",
      setupDispositivo: passo === "dispositivo",
      setupUltimo: indice === SETUP_PASSI.length - 1,
      setupPrimo: indice === 0,
      setupNumero: indice + 1,
      setupTotale: SETUP_PASSI.length,
      setupPunti: SETUP_PASSI.map((chiave, i) => ({ chiave, fatto: i <= indice })),

      /* --- avvio: cos'e' questo aggeggio --- */
      modello: this.#modelloAgent(),
      seriale: serialeDi(this.attore),
      numero: numeroDi(this.attore),
      nomeAttore: this.attore?.name ?? "",

      /* --- identita' --- */
      handle: this.attore.getFlag(MODULO, "handle") ?? "",
      nomeVero: this.attore.getFlag(MODULO, "nomeVero") ?? "",
      salutoHandle: salutoCon(this.attore) === "handle",
      // L'anteprima del saluto: e' la frase che vedra' all'accensione, e
      // vederla mentre scegli e' l'unico modo per capire cosa stai scegliendo.
      salutoAnteprima: game.i18n.format("CPRX.Bentornato", { nome: this.appellativo }),

      /* --- aspetto --- */
      temi: Object.entries(TEMI).map(([chiave, etichetta]) => ({
        chiave,
        etichetta: game.i18n.localize(etichetta),
        attivo: chiave === temaAttuale
      })),
      sfondi: [
        {
          chiave: "",
          etichetta: game.i18n.localize("CPRX.SfondoNessuno"),
          url: "",
          scelto: sfondoDi(this.attore) === ""
        },
        ...SFONDI.map(s => ({
          chiave: s.chiave,
          etichetta: s.etichetta,
          url: percorsoSfondo(s.chiave),
          scelto: s.chiave === sfondoDi(this.attore)
        }))
      ],

      /* --- casa --- */
      corporativo: stato.corporativo,
      alloggi: Object.entries(alloggi()).map(([chiave, def]) => ({
        chiave,
        etichetta: etichettaCasa(def),
        canone: def.canone,
        scelto: chiave === stato.alloggio
      })),
      vitti: Object.entries(vitti()).map(([chiave, def]) => ({
        chiave,
        etichetta: etichettaCasa(def),
        costo: def.costo,
        scelto: chiave === stato.vitto
      })),
      totale: stato.totale,

      /* --- dispositivo --- */
      agentInterno: !!this.attore.getFlag(MODULO, "agentInterno"),
      gps: !!this.attore.getFlag(MODULO, "gps")
    };
  }

  /**
   * La schermata di blocco: ora, data, chi sei, e l'impronta in basso.
   * Non e' una password — l'Agent e' gia' protetto dai permessi di Foundry.
   * E' il gesto: apri la finestra e il telefono e' spento come lo avevi
   * lasciato.
   */
  #contestoBlocco() {
    const chi = identita(this.attore);
    return {
      vistaBlocco: true,
      appCorrente: "blocco",
      // Il vetro di blocco copre tutto: dock compreso.
      dock: null,
      // Lo sfondo e' la prima cosa che si vede aprendo il telefono.
      sfondoVisibile: !!percorsoSfondo(sfondoDi(this.attore)),
      dataLunga: new Date().toLocaleDateString(game.i18n.lang,
        { weekday: "long", day: "2-digit", month: "long" }),
      nomeBlocco: salutoCon(this.attore) === "nome" ? chi.nome : chi.handle,
      nonLetti: messaggiNonLetti(this.attore),
      numeroMio: numeroDi(this.attore)
    };
  }

  #contestoDistrutto() {
    return {
      vistaDistrutto: true,
      appCorrente: "guasto",
      dock: null,
      prezzoAgent: game.settings.get(MODULO, "prezzoAgent"),
      eddies: trovaEddies(this.attore).valore,
      puoRiparare: game.user.isGM
        || (this.puoScrivere && (trovaEddies(this.attore).valore ?? 0) >= game.settings.get(MODULO, "prezzoAgent"))
    };
  }

  /** mm:ss da un istante di partenza. */
  static #durataTesto(da) {
    const secondi = da ? Math.max(0, Math.floor((Date.now() - da) / 1000)) : 0;
    return `${String(Math.floor(secondi / 60)).padStart(2, "0")}:${String(secondi % 60).padStart(2, "0")}`;
  }

  #contestoChiamata(chiamata) {
    const durata = chiamata.rispostaQuando
      ? Math.floor((Date.now() - chiamata.rispostaQuando) / 1000)
      : 0;

    const inCorso = chiamata.connesso;
    const daRispondere = chiamata.inArrivo;

    // Le tre etichette si decidono qui: nel template diventerebbero tre
    // {{#if}} annidati per una parola.
    const etichettaStato = inCorso ? "CPRX.ChiamataConnessa"
      : (daRispondere ? "CPRX.ChiamataInArrivo" : "CPRX.ChiamataInUscita");
    const etichettaChiudi = inCorso ? "CPRX.Riaggancia"
      : (daRispondere ? "CPRX.Rifiuta" : "CPRX.Annulla");

    return {
      vistaChiamata: true,
      // Dentro una chiamata il dock non serve: si riaggancia, o si manda in
      // secondo piano e il dock torna con tutto il resto.
      dock: null,
      // Una chiamata e' il telefono, da qualunque App ti abbia sorpreso.
      appCorrente: "telefono",
      etichettaApp: game.i18n.localize("CPRX.AppTelefono"),
      iconaApp: APP.telefono.icona,
      chiamata: {
        ...chiamata,
        nome: chiamata.nome || chiamata.numero,
        inCorso,
        daRispondere,
        // Le iniziali al posto della faccia: qui non ci sono immagini, e un
        // cerchio vuoto sarebbe peggio di due lettere.
        iniziali: iniziali(chiamata.nome || chiamata.numero),
        etichettaStato: game.i18n.localize(etichettaStato),
        etichettaChiudi: game.i18n.localize(etichettaChiudi),
        durataTesto: `${String(Math.floor(durata / 60)).padStart(2, "0")}:${String(durata % 60).padStart(2, "0")}`
      },
      // Si aggiunge gente solo a chiamata aperta: invitare qualcuno a uno
      // squillo che non hai ancora risposto non vuol dire niente.
      puoAggiungere: inCorso && this.puoScrivere,
      ...(this.stato.chiamataAggiungi && inCorso ? this.#contestoInvito(chiamata) : {})
    };
  }

  /** Chi si puo' tirare dentro a una chiamata in corso. */
  #contestoInvito(chiamata) {
    const mio = numeroDi(this.attore);
    const dentro = new Set([...chiamata.membri, mio]);

    const candidati = leggiVoci(this.attore, "contatti")
      .filter(v => v.numero)
      .map(v => ({ numero: normalizzaNumero(v.numero), nome: v.nome || v.numero }))
      .filter(v => v.numero && !dentro.has(v.numero) && !this.#coperto(v.numero)
        && !nascondoCon(this.attore, v.numero));

    return {
      invito: true,
      invitabili: candidati,
      haInvitabili: candidati.length > 0
    };
  }

  /**
   * La striscia della chiamata in secondo piano. Sta in `base` perche' si
   * rende fuori da ogni vista, come la barra di stato.
   */
  #contestoBarraChiamata(chiamata) {
    return {
      chiamataBarra: {
        nome: chiamata.nome || chiamata.numero,
        gruppo: chiamata.gruppo,
        quanti: chiamata.partecipanti.filter(p => p.inLinea).length + 1,
        durataTesto: Agent.#durataTesto(chiamata.rispostaQuando)
      }
    };
  }

  #contestoMessaggi() {
    // Solo SMS: lo storico delle chiamate sta in Phone, sotto «recenti».
    const soloNuovi = this.stato.filtroMsg === "nuovi";
    const cerca = (this.stato.ricerca ?? "").trim().toLowerCase();

    const elenco = conversazioniSms(this.attore)
      .filter(c => !soloNuovi || c.nonLetti)
      // Si cerca nel nome del filo, non nel numero: un numero coperto non
      // si scrive, e cercarlo lo farebbe emergere da chi resta in elenco.
      .filter(c => !cerca || (c.nome ?? "").toLowerCase().includes(cerca));

    return {
      vistaMessaggi: true,
      etichettaApp: game.i18n.localize("CPRX.AppMessaggi"),
      iconaApp: APP.messaggi.icona,
      vuoto: elenco.length === 0,
      // Il campo per il numero nuovo si apre col tasto in fondo, e sta
      // sull'istanza come `_pagina`: entrare in un filo e tornare indietro
      // non deve lasciarlo aperto.
      compositore: !!this._compositore,
      ricerca: this.stato.ricerca ?? "",
      filtriMsg: [
        { chiave: "tutti", etichetta: game.i18n.localize("CPRX.FiltroTutte"), attiva: !soloNuovi },
        { chiave: "nuovi", etichetta: game.i18n.localize("CPRX.FiltroNonLette"), attiva: soloNuovi }
      ],
      conversazioni: elenco.map(c => {
        const ultima = c.voci[c.voci.length - 1];
        const testo = (ultima.testo ?? "").slice(0, 60);
        return {
          // `numero` resta il nome del campo che il template usa per
          // instradare: per un gruppo ci va la sua chiave.
          numero: c.chiave,
          gruppo: !!c.gruppo,
          nome: c.nome,
          iniziale: iniziali(c.nome),
          // Le iniziali di un numero sono due cifre a caso: chi non e' in
          // rubrica prende la sagoma, non «50».
          senzaNome: !c.gruppo && !/\p{L}/u.test(c.nome ?? ""),
          nonLetti: c.nonLetti,
          // In un gruppo l'anteprima dice anche chi ha parlato, altrimenti
          // sei nel filo di sei persone e non sai chi ti ha scritto.
          anteprima: c.gruppo && !ultima.uscente
            ? `${this.#nomeDaNumero(ultima.da, ultima.daNome)}: ${testo}`
            : testo,
          uscente: ultima.uscente,
          // L'ora dell'ultima riga sta a destra del nome, come su un
          // telefono: oggi l'orario, prima di oggi la data corta.
          quando: etichettaQuando(ultima.quando)
        };
      })
    };
  }

  /** Come si chiama, per me, il numero che ha scritto questa riga. */
  #nomeDaNumero(numero, ripiego = "") {
    return nomePerNumero(this.attore, numero) || ripiego || numero || "—";
  }

  #contestoConversazione(chiave) {
    if (eChiaveGruppo(chiave)) return this.#contestoGruppo(chiave);

    const numero = chiave;
    const conversazione = conversazioni(this.attore).find(c => c.chiave === numero);
    // Il numero libero del master risponde anche se non e' un attore.
    const attore = attorePerNumero(numero)
      ?? (numero === normalizzaNumero(identitaMaster().numero) ? { name: identitaMaster().nome } : null);
    const coperto = !!conversazione?.coperto;

    return {
      vistaConversazione: true,
      etichettaApp: conversazione?.nome ?? (nomePerNumero(this.attore, numero) || numero),
      iconaApp: APP.messaggi.icona,
      numeroAltro: numero,
      chiaveFilo: numero,
      coperto,
      raggiungibile: !!attore,
      inRubrica: leggiVoci(this.attore, "contatti")
        .some(v => v.numero && normalizzaNumero(v.numero) === numero),
      vuoto: !conversazione,
      voci: (conversazione?.voci ?? []).map(v => ({
        uscente: v.uscente,
        chiamata: v.tipo === TIPO.CHIAMATA,
        immagine: v.tipo === TIPO.SMS ? (v.immagine ?? "") : "",
        testo: v.tipo === TIPO.CHIAMATA ? this.#testoChiamata(v, numero, coperto) : v.testo,
        ora: new Date(v.quando).toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" })
      }))
    };
  }

  /**
   * Il filo di un gruppo. Niente tasto chiama e niente salva-contatto: si
   * chiama una persona, non sei persone, e in rubrica ci va un numero, non
   * un elenco. Ogni bolla porta il nome di chi ha parlato — senza, un filo
   * a sei voci e' illeggibile.
   */
  #contestoGruppo(chiave) {
    const conversazione = conversazioni(this.attore).find(c => c.chiave === chiave);
    const mio = numeroDi(this.attore);
    const membri = conversazione?.membri ?? [];

    return {
      vistaConversazione: true,
      gruppo: true,
      etichettaApp: conversazione?.nome ?? game.i18n.localize("CPRX.GruppoTitolo"),
      iconaApp: "fa-solid fa-users",
      chiaveFilo: chiave,
      coperto: false,
      raggiungibile: membri.some(n => n !== mio && !!attorePerNumero(n)),
      vuoto: !conversazione,
      membri: membri.map(n => ({
        numero: n,
        io: n === mio,
        nome: n === mio ? game.i18n.localize("CPRX.GruppoIo") : this.#nomeDaNumero(n)
      })),
      membriTesto: membri
        .map(n => (n === mio ? game.i18n.localize("CPRX.GruppoIo") : this.#nomeDaNumero(n)))
        .join(", "),
      quantiMembri: membri.length,
      voci: (conversazione?.voci ?? []).map(v => ({
        uscente: v.uscente,
        chiamata: false,
        mittente: v.uscente ? "" : this.#nomeDaNumero(v.da, v.daNome),
        immagine: v.immagine ?? "",
        testo: v.testo,
        ora: new Date(v.quando).toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" })
      }))
    };
  }

  /**
   * Il modulo per fare un gruppo. I candidati sono la rubrica: un gruppo si
   * fa con gente che hai in rubrica, e un numero coperto in rubrica non ci
   * puo' stare — quindi il problema di mostrarlo qui non si pone.
   *
   * Chi nasconde il proprio numero verso qualcuno non lo puo' mettere nel
   * gruppo: dentro, il numero si vede. Meglio dirlo prima che scoprirlo
   * dopo averlo mandato.
   */
  #contestoNuovoGruppo() {
    const mio = numeroDi(this.attore);
    const candidati = leggiVoci(this.attore, "contatti")
      .filter(v => v.numero && normalizzaNumero(v.numero) !== mio)
      .map(v => ({
        numero: normalizzaNumero(v.numero),
        nome: v.nome || normalizzaNumero(v.numero),
        nascosto: !!v.nascosto
      }))
      .filter(v => !this.#coperto(v.numero));

    return {
      vistaNuovoGruppo: true,
      etichettaApp: game.i18n.localize("CPRX.GruppoNuovo"),
      iconaApp: "fa-solid fa-users",
      candidati: candidati.filter(v => !v.nascosto),
      haCandidati: candidati.some(v => !v.nascosto),
      // Verso questi il numero lo nascondo: nel gruppo non ci possono stare.
      esclusi: candidati.filter(v => v.nascosto).map(v => v.nome),
      haEsclusi: candidati.some(v => v.nascosto)
    };
  }

  /**
   * La riga di una chiamata dentro il filo. I capi non si leggono dalla voce
   * accorpata — quella porta il mittente dell'ultimo evento, che spesso sono
   * io — ma dal numero del filo: cosi' con la copertura accesa non ci finisce
   * ne' il nome ne' il numero dell'altro.
   */
  #testoChiamata(voce, numero, coperto) {
    const chiavi = {
      squilla: "CPRX.CartaChiamataSquilla",
      risposta: "CPRX.CartaChiamataRisposta",
      rifiuto: "CPRX.CartaChiamataRifiuto",
      chiusa: "CPRX.CartaChiamataChiusa",
      persa: "CPRX.CartaChiamataPersa"
    };

    const io = this.attore.name || numeroDi(this.attore);
    const altro = coperto
      ? etichettaCoperta()
      : (nomePerNumero(this.attore, numero) || numero);

    return game.i18n.format(chiavi[voce.stato] ?? chiavi.squilla, {
      da: voce.uscente ? io : altro,
      a: voce.uscente ? altro : io,
      durata: voce.durata ?? "—"
    });
  }

  /**
   * La Banca. Il saldo si legge dalla scheda, sempre: qui non c'e' un
   * secondo saldo da tenere allineato. Quello che la Banca possiede e' il
   * registro dei movimenti.
   */
  /**
   * La Banca: una carta di credito in cima, il flusso della settimana, e i
   * movimenti raggruppati per giorno.
   *
   * I numeri sono **tutti veri** e vengono dal registro: il flusso dei sette
   * giorni, i totali di trenta, i totali di giornata. Non c'e' niente di
   * riempitivo — se il registro e' vuoto, il grafico e' piatto e lo dice.
   */
  #contestoBanca() {
    const eddies = trovaEddies(this.attore);
    const tutti = [...movimenti(this.attore)].sort((a, b) => b.quando - a.quando);

    const filtro = ["entrate", "uscite"].includes(this.stato.filtroBanca)
      ? this.stato.filtroBanca
      : "tutti";

    const giorno = 86400000;
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);

    // Sette colonne, dalla piu' vecchia. Entrate sopra e uscite sotto sulla
    // stessa colonna, come nel progetto: la scala e' il giorno piu' grosso,
    // altrimenti un solo movimento riempie il grafico.
    const settimana = Array.from({ length: 7 }, (_, i) => {
      const inizio = oggi.getTime() - (6 - i) * giorno;
      const delGiorno = tutti.filter(v => v.quando >= inizio && v.quando < inizio + giorno);
      return {
        etichetta: new Date(inizio)
          .toLocaleDateString(game.i18n.lang, { weekday: "short" }).toUpperCase(),
        dentro: delGiorno.filter(v => v.importo > 0).reduce((s, v) => s + v.importo, 0),
        fuori: delGiorno.filter(v => v.importo < 0).reduce((s, v) => s - v.importo, 0)
      };
    });
    const piu = Math.max(1, ...settimana.map(g => Math.max(g.dentro, g.fuori)));

    const daMese = tutti.filter(v => v.quando >= oggi.getTime() - 30 * giorno);
    const entrateMese = daMese.filter(v => v.importo > 0).reduce((s, v) => s + v.importo, 0);
    const usciteMese = daMese.filter(v => v.importo < 0).reduce((s, v) => s - v.importo, 0);

    // Raggruppati per giorno, col totale della giornata in testa: e' come
    // si legge un estratto conto, non come si legge una lista.
    const gruppi = [];
    for (const v of tutti.slice(0, 60)) {
      if (filtro === "entrate" && v.importo <= 0) continue;
      if (filtro === "uscite" && v.importo >= 0) continue;

      const chiave = new Date(v.quando).toLocaleDateString(game.i18n.lang,
        { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();
      let gruppo = gruppi.find(g => g.giorno === chiave);
      if (!gruppo) {
        gruppo = { giorno: chiave, saldo: 0, righe: [] };
        gruppi.push(gruppo);
      }
      gruppo.saldo += v.importo;
      gruppo.righe.push({
        entrata: v.importo > 0,
        importo: `${v.importo > 0 ? "+" : "−"}${Math.abs(v.importo)}`,
        segno: v.importo > 0 ? "fa-solid fa-arrow-down" : "fa-solid fa-arrow-up",
        causale: v.causale || game.i18n.localize("CPRX.BancaSenzaCausale"),
        controparte: v.controparte || "",
        ora: new Date(v.quando).toLocaleTimeString(game.i18n.lang,
          { hour: "2-digit", minute: "2-digit" })
      });
    }
    for (const g of gruppi) {
      g.saldoTesto = `${g.saldo > 0 ? "+" : g.saldo < 0 ? "−" : ""}${Math.abs(g.saldo)}`;
      g.positivo = g.saldo >= 0;
    }

    return {
      vistaBanca: true,
      etichettaApp: game.i18n.localize("CPRX.AppBanca"),
      iconaApp: APP.banca.icona,
      eddies: eddies.valore === null ? "—" : eddies.valore,
      eddiesNoti: eddies.valore !== null,
      eddiesOrigine: eddies.origine ?? game.i18n.localize("CPRX.EddiesNonTrovati"),
      intestatario: identita(this.attore).handle,
      numeroMio: numeroDi(this.attore),
      // Il numero della carta non e' un dato: e' cifratura di facciata,
      // ricavata dall'identificativo dell'attore come il seriale. Stabile,
      // e uguale a ogni apertura.
      numeroCarta: numeroCarta(this.attore),
      scadenzaCarta: scadenzaCarta(this.attore),
      bersaglio: this.stato.bersaglio ?? "",

      // Il pannello del bonifico si apre da un tasto: la Banca si apre per
      // guardare il saldo, non per mandare soldi.
      bancaModulo: this.stato.bancaModulo ?? "",
      bancaInvio: this.stato.bancaModulo === "invia",
      bancaRichiesta: this.stato.bancaModulo === "richiedi",
      bancaCarta: this.stato.bancaModulo === "carta",
      seriale: serialeDi(this.attore),

      settimana: settimana.map(g => ({
        etichetta: g.etichetta,
        dentro: Math.round((g.dentro / piu) * 100),
        fuori: Math.round((g.fuori / piu) * 100)
      })),
      nettoSettimana: settimana.reduce((s, g) => s + g.dentro - g.fuori, 0),
      entrateMese,
      usciteMese,

      filtriBanca: [
        { chiave: "tutti", etichetta: game.i18n.localize("CPRX.FiltroTutti"), attiva: filtro === "tutti" },
        { chiave: "entrate", etichetta: game.i18n.localize("CPRX.FiltroEntrate"), attiva: filtro === "entrate" },
        { chiave: "uscite", etichetta: game.i18n.localize("CPRX.FiltroUscite"), attiva: filtro === "uscite" }
      ],
      vuoto: gruppi.length === 0,
      giorni: gruppi
    };
  }

  /**
   * House: dove vivi, quanto ti costa starci, e com'e' messo il Quartier
   * Generale.
   *
   * Il canone scatta col calendario (`mesiAuto`), lo riscuote il master dalla
   * console, e da qui lo si puo' pagare a mano: con l'automatismo spento e'
   * l'unico modo, e con l'automatismo acceso serve a saldare un arretrato.
   *
   * Lo storico dei pagamenti **non e' archiviato qui**: sono le righe della
   * banca con la causale del canone. Un secondo registro sarebbe una seconda
   * verita', ed e' la stessa ragione per cui la Banca non tiene un saldo suo.
   */
  #contestoCasa() {
    const stato = statoCasa(this.attore);
    const eddies = trovaEddies(this.attore);

    // Lo storico non e' un secondo registro: sono le righe della banca che
    // portano la causale del canone. Tenerne una copia qui darebbe due
    // verita' destinate a divergere — la stessa ragione per cui la Banca non
    // tiene un saldo suo.
    const causale = game.i18n.localize("CPRX.CasaCausale");
    const storico = movimenti(this.attore)
      .filter(m => m.causale === causale)
      .slice()
      .sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0))
      .slice(0, 6)
      .map(m => ({
        quando: etichettaQuando(m.quando),
        importo: m.importo,
        controparte: m.controparte ?? ""
      }));

    return {
      vistaCasa: true,
      etichettaApp: game.i18n.localize("CPRX.AppCasa"),
      iconaApp: APP.casa.icona,
      ...stato,

      /* --- le migliorie del Quartier Generale --- */
      migliorieVoci: Object.entries(MIGLIORIE_QG).map(([chiave, def]) => ({
        chiave,
        nome: game.i18n.localize(`CPRX.Qg_${chiave}`),
        nota: game.i18n.localize(`CPRX.Qg_${chiave}_Nota`),
        costo: def.costo,
        attiva: stato.migliorie.includes(chiave),
        // Una che non hai e non ti puoi permettere resta in elenco, spenta:
        // l'elenco dice cosa si puo' costruire, non cosa hai gia' pagato.
        alPrezzo: !stato.migliorie.includes(chiave) && stato.pmqg < def.costo
      })),
      haSconto: stato.sconto > 0,

      /* --- lo storico, che viene dalla banca --- */
      storico,
      haStorico: storico.length > 0,

      // Il mese si paga anche a mano: con l'automatismo spento e' l'unico
      // modo, e con l'automatismo acceso serve a saldare un arretrato.
      puoPagare: this.puoScrivere && !stato.corporativo && stato.totale > 0
        && (eddies.valore ?? 0) >= stato.totale,
      // Il canone puo' non scattare da solo: se il tavolo ha spento
      // l'automatismo va detto qui, altrimenti uno guarda il totale e si
      // aspetta di vederselo sparire dal conto il primo del mese.
      mesiAuto: game.settings.get(MODULO, "mesiAuto") !== false,
      etichettaAlloggio: etichettaCasa(alloggi()[stato.alloggio]),
      etichettaVitto: etichettaCasa(vitti()[stato.vitto]),
      alloggi: Object.entries(alloggi()).map(([chiave, def]) => ({
        chiave,
        etichetta: etichettaCasa(def),
        canone: def.canone,
        scelto: chiave === stato.alloggio
      })),
      vitti: Object.entries(vitti()).map(([chiave, def]) => ({
        chiave,
        etichetta: etichettaCasa(def),
        costo: def.costo,
        scelto: chiave === stato.vitto
      })),
      eddies: eddies.valore,
      eddiesNoti: eddies.valore !== null,
      scoperto: eddies.valore !== null && stato.totale > eddies.valore,
      haArretrati: stato.arretrati > 0,
      ultimoTesto: stato.ultimoPagamento
        ? new Date(stato.ultimoPagamento).toLocaleDateString(game.i18n.lang,
            { day: "2-digit", month: "2-digit", year: "numeric" })
        : game.i18n.localize("CPRX.CasaMaiPagato")
    };
  }

  /**
   * Corp Link: il portale dipendenti. Il badge, cosa ti fa aprire, cosa
   * l'azienda ti manda a dire e cosa ti passa.
   *
   * **Qui dentro non si scrive niente.** Non c'e' un tasto: la Corporazione
   * e il livello del badge li assegna il master dalla console, e avvisi,
   * accessi e incarichi stanno nell'archivio aziendale, che e'
   * un'impostazione di mondo. E' la stessa regola dell'NCPD — da un telefono
   * non ti dai un badge di Arasaka, come non ti metti nel casellario della
   * polizia.
   *
   * L'unica linguetta che non legge l'archivio e' quella dei benefit: quelli
   * si ricavano da dove stanno gia' — casa corporativa, abbonamento Trauma
   * Team, livello del badge — e una lista scritta a mano sarebbe stata una
   * seconda verita'.
   */
  #contestoCorp() {
    const corp = statoCorp(this.attore);
    const scheda = this.stato.corpScheda ?? "bacheca";

    // Senza badge non c'e' niente da mostrare, e non c'e' niente da fare:
    // il tasto per scegliere non esiste piu' nemmeno per il master, che la
    // Corporazione la assegna dalla console.
    if (!corp.scelta) {
      return { vistaCorp: true, corpSenzaBadge: true, eGm: game.user.isGM };
    }

    const schede = [
      { chiave: "bacheca", etichetta: game.i18n.localize("CPRX.CorpBacheca") },
      { chiave: "accessi", etichetta: game.i18n.localize("CPRX.CorpAccessi") },
      { chiave: "incarichi", etichetta: game.i18n.localize("CPRX.CorpIncarichi") },
      { chiave: "benefit", etichetta: game.i18n.localize("CPRX.CorpBenefit") }
    ].map(s => ({ ...s, attiva: s.chiave === scheda }));

    const mio = corp.chiave || "*";

    /* --- bacheca --- */
    const avvisi = corpArchivio(mio, "avviso").map(v => ({
      id: v.id,
      titolo: v.titolo || "—",
      testo: v.testo ?? "",
      tag: v.tag ?? "",
      quando: etichettaQuando(v.quando)
    }));

    /* --- accessi: le aree le scrive il master, il confronto lo fa il badge.
       Finche' non ne ha scritta nessuna valgono le cinque di serie: un'App
       che si apre vuota non dice cos'e'. --}} */
    const scritti = corpArchivio(mio, "accesso");
    const aree = scritti.length ? scritti.map(v => ({
      chiave: v.id,
      nome: v.titolo || "—",
      nota: v.testo ?? "",
      livello: Math.max(1, Math.min(LIVELLO_CORP_MASSIMO, Number(v.livello) || 1))
    })) : AREE_CORP.map(a => ({
      chiave: a.chiave,
      nome: game.i18n.localize(`CPRX.CorpArea_${a.chiave}`),
      nota: game.i18n.localize(`CPRX.CorpArea_${a.chiave}_Nota`),
      livello: a.livello
    }));

    const accessi = aree
      .slice()
      .sort((a, b) => a.livello - b.livello)
      .map(a => ({
        ...a,
        // Un badge sospeso non apre piu' niente: e' il senso di sospenderlo.
        aperto: corp.attivo && corp.livello >= a.livello
      }));

    /* --- incarichi: li mette il master, come gli avvisi --- */
    const incarichi = corpArchivio(mio, "incarico").map(v => ({
      id: v.id,
      titolo: v.titolo || "—",
      testo: v.testo ?? "",
      tag: v.tag ?? "",
      importo: Number(v.importo) || 0
    }));

    /* --- benefit: si leggono da dove stanno gia' --- */
    const casa = statoCasa(this.attore);
    const benefit = [
      {
        chiave: "alloggio",
        nome: game.i18n.localize("CPRX.CorpBenefitAlloggio"),
        nota: etichettaCasa(alloggi()[casa.alloggio]),
        attivo: casa.corporativo
      },
      {
        chiave: "medica",
        nome: game.i18n.localize("CPRX.CorpBenefitMedica"),
        nota: game.i18n.localize("CPRX.CorpBenefitMedicaNota"),
        attivo: abbonatoTrauma(this.attore)
      },
      {
        chiave: "mensa",
        nome: game.i18n.localize("CPRX.CorpBenefitMensa"),
        nota: game.i18n.localize("CPRX.CorpBenefitMensaNota"),
        attivo: corp.attivo && corp.livello >= 2
      },
      {
        chiave: "buonuscita",
        nome: game.i18n.localize("CPRX.CorpBenefitBuonuscita"),
        nota: game.i18n.localize("CPRX.CorpBenefitBuonuscitaNota"),
        attivo: corp.attivo && corp.livello >= 4
      }
    ];

    return {
      vistaCorp: true,
      corpSetup: false,
      corp,
      // L'App si chiama come la Corporazione: sul telefono di un dipendente
      // Arasaka l'icona dice «Arasaka», non «Corp Link». Il nome del
      // prodotto resta in vetrina, dove sei tu a comprarlo.
      etichettaApp: corp.nome,
      corpSchede: schede,
      corpScheda: scheda,
      corpBachecaAperta: scheda === "bacheca",
      corpAccessiAperta: scheda === "accessi",
      corpIncarichiAperta: scheda === "incarichi",
      corpBenefitAperta: scheda === "benefit",
      avvisi,
      haAvvisi: avvisi.length > 0,
      accessi,
      incarichi,
      haIncarichi: incarichi.length > 0,
      benefit,
      corpStato: game.i18n.localize(corp.attivo ? "CPRX.CorpValido" : "CPRX.CorpSospeso"),
      corpHaScheda: !!corp.qg
    };
  }

  /**
   * StreetWire: il tuo nome sulla strada. Numero, livello, e il registro di
   * come ci sei arrivato.
   *
   * **Non tiene niente.** Il valore e' `system.reputation.value` e il
   * registro e' `system.reputation.transactions`: tutti e due del sistema,
   * tutti e due visibili anche sulla scheda. L'App e' una lente, non un
   * archivio — se il master cambia la REP dalla scheda, qui si vede
   * subito, e viceversa.
   *
   * Il registro si legge **dal fondo**: l'ultima cosa che si dice di te e'
   * quella che conta.
   */
  #contestoReputazione() {
    const { valore, registro } = trovaReputazione(this.attore);
    const noto = valore === null ? null : livelloRep(valore);

    return {
      vistaReputazione: true,
      repNota: valore !== null,
      repValore: valore,
      repLivello: noto ? game.i18n.localize(noto.etichetta) : "",
      // Quanto lontano arriva il nome: sopra la soglia gira da solo.
      repPubblica: repPubblica(valore),
      repPortata: game.i18n.localize(
        repPubblica(valore) ? "CPRX.RepPortataAperta" : "CPRX.RepPortataChiusa"),

      // La scala intera, per far vedere dove sei e quanto manca al gradino
      // dopo. Si legge dal basso, come una tacca di segnale.
      repScala: [...LIVELLI_REP].reverse().map(l => ({
        etichetta: game.i18n.localize(l.etichetta),
        da: l.da > -99 ? l.da : 0,
        qui: noto === l
      })),

      // Ogni transazione del sistema e' `[frase, motivo]`. La frase e' gia'
      // tradotta da lui: non si tocca, si mostra.
      repRegistro: [...registro].reverse().slice(0, 20).map(v => ({
        testo: Array.isArray(v) ? (v[0] ?? "") : String(v ?? ""),
        motivo: Array.isArray(v) ? (v[1] ?? "") : ""
      })),
      repHaRegistro: registro.length > 0
    };
  }

  /* ---------------------------------------------------------------- */
  /* Le App del DLC «Tutto sugli Agent»                                */
  /* ---------------------------------------------------------------- */

  /**
   * Ask Alex Anything: «permette di cercare ed esaminare informazioni sulla
   * CitiNet locale». La CitiNet locale, qui, e' il **Database Urbano** —
   * l'archivio che il master compila dalla console. Alex non inventa un
   * secondo archivio: cerca in quello, ed e' il motivo per cui e' gratis e
   * utile solo a un tavolo che il database lo riempie.
   *
   * Il riassunto e' il conto delle fonti, non un testo generato: quello che
   * l'App sa dire e' quante voci ha trovato e in quali categorie.
   */
  #contestoAlex() {
    const cerca = (this.stato.ricerca ?? "").trim().toLowerCase();
    const db = zigguratDb();

    const trovate = !cerca ? [] : db.filter(v =>
      [v.nome, v.testo, v.zona, v.citta].filter(Boolean).join(" ").toLowerCase().includes(cerca));

    // Le categorie che hanno prodotto qualcosa: e' tutto quello che si puo'
    // dire onestamente sulla «confidenza» di una ricerca.
    const fonti = [...new Set(trovate.map(v => v.categoria).filter(Boolean))]
      .map(c => game.i18n.localize(ZIGGURAT_CATEGORIE[c] ?? c));

    return {
      vistaAlex: true,
      ricerca: this.stato.ricerca ?? "",
      alexBonus: bonusArchivistica(this.attore),
      alexGrande: statoBigIaaa(this.attore),
      alexHaDb: db.length > 0,
      alexCercato: !!cerca,
      alexQuante: trovate.length,
      alexFonti: fonti.join(" · "),
      alexRisultati: trovate.slice(0, 30).map(v => ({
        nome: v.nome ?? "—",
        testo: v.testo ?? "",
        riga: [
          game.i18n.localize(ZIGGURAT_CATEGORIE[v.categoria] ?? v.categoria ?? ""),
          v.zona, v.citta
        ].filter(Boolean).join(" · ")
      })),
      alexTroppi: trovate.length > 30
    };
  }

  /**
   * ZPost: la posta. E' corrispondenza come gli SMS — stesso filo, stesso
   * ufficio postale — ma con un oggetto e un testo lungo, e per questo non
   * si mescola ai messaggi: `TIPO.EMAIL` la tiene separata in tutte e due
   * le direzioni.
   */
  #contestoZpost() {
    // `traffico()` torna le voci grezze: `uscente` lo calcola chi le usa —
    // `conversazioni()` per gli SMS, questa funzione per la posta.
    const voci = traffico(this.attore)
      .filter(v => v.tipo === TIPO.EMAIL)
      .map(v => ({ ...v, uscente: v.daAttore === this.attore.id }));
    const aperta = this.stato.email
      ? voci.find(v => v.idVoce === this.stato.email) ?? null
      : null;

    const quando = (t) => new Date(t).toLocaleString(game.i18n.lang,
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    if (aperta) {
      const coperto = this.#coperto(aperta.da, aperta.anonimo);
      return {
        vistaZpost: true,
        zpostAperta: {
          idVoce: aperta.idVoce,
          oggetto: aperta.oggetto || game.i18n.localize("CPRX.ZpostSenzaOggetto"),
          testo: aperta.testo ?? "",
          mittente: aperta.uscente
            ? game.i18n.localize("CPRX.ZpostIo")
            : (coperto ? etichettaCoperta() : this.#nomeDaNumero(aperta.da, aperta.daNome)),
          // Di un numero coperto non si risponde scrivendo la cifra: il
          // tasto passa da `data-numero`, come ovunque.
          numero: aperta.uscente ? aperta.a : aperta.da,
          coperto,
          uscente: !!aperta.uscente,
          quando: quando(aperta.quando)
        }
      };
    }

    const scritte = this.stato.zpostScritte === true;
    const elenco = voci
      .filter(v => (scritte ? v.uscente : !v.uscente))
      .slice()
      .reverse()
      .map(v => {
        const coperto = this.#coperto(v.da, v.anonimo);
        const chi = v.uscente
          ? this.#nomeDaNumero(v.a, v.aNome)
          : (coperto ? etichettaCoperta() : this.#nomeDaNumero(v.da, v.daNome));
        return {
          idVoce: v.idVoce,
          chi,
          iniziale: iniziali(chi),
          oggetto: v.oggetto || game.i18n.localize("CPRX.ZpostSenzaOggetto"),
          anteprima: (v.testo ?? "").slice(0, 80),
          quando: quando(v.quando)
        };
      });

    return {
      vistaZpost: true,
      zpostScritte: scritte,
      zpostLinguette: [
        { chiave: "ricevute", etichetta: game.i18n.localize("CPRX.ZpostRicevute"), attiva: !scritte },
        { chiave: "inviate", etichetta: game.i18n.localize("CPRX.ZpostInviate"), attiva: scritte }
      ],
      zpostVuoto: elenco.length === 0,
      zpostElenco: elenco,
      composto: this.stato.composto ?? ""
    };
  }

  /**
   * Garden: il Data Pool locale. E' l'unico archivio condiviso su cui
   * scrivono anche i giocatori, quindi i post viaggiano come buste e li
   * deposita il postino — la stessa strada dei messaggi, per lo stesso
   * motivo (sulle impostazioni di mondo scrive solo un GM).
   */
  #contestoGarden() {
    const mio = numeroDi(this.attore);
    const quando = (t) => new Date(t).toLocaleString(game.i18n.lang,
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const voci = [...gardenPatch()].reverse().slice(0, 40).map(v => ({
      id: v.id,
      autore: v.autore || "—",
      iniziale: iniziali(v.autore || "—"),
      testo: v.testo ?? "",
      quando: quando(v.quando),
      cuori: Array.isArray(v.cuori) ? v.cuori.length : 0,
      // Un cuore per numero: il conto sta nell'elenco di chi l'ha messo,
      // non in un contatore che chiunque puo' far salire premendo due volte.
      mio: Array.isArray(v.cuori) && !!mio && v.cuori.includes(mio)
    }));

    return {
      vistaGarden: true,
      gardenVuoto: voci.length === 0,
      gardenVoci: voci,
      gardenPuoScrivere: this.puoScrivere && !!mio
    };
  }

  /**
   * BangMe!: «trasferire denaro tra due Agent con l'app installata». I soldi
   * sono quelli della scheda e la strada e' quella della Banca — `accredita()`
   * da una parte, la busta con `accredito` dall'altra. Qui cambia solo il
   * gesto: importi pronti e i destinatari presi dalla rubrica.
   */
  #contestoBangme() {
    const eddies = trovaEddies(this.attore);
    const coperti = numeriCoperti(this.attore);
    const scelto = normalizzaNumero(this.stato.bersaglio ?? "");
    const importo = Number(this.stato.importo) || 0;

    const destinatari = leggiVoci(this.attore, "contatti")
      .filter(v => v.numero)
      .map(v => {
        const numero = normalizzaNumero(v.numero);
        const coperto = coperti.has(numero);
        return {
          numero,
          coperto,
          nome: coperto ? etichettaCoperta() : (v.nome || numero),
          iniziale: iniziali(coperto ? etichettaCoperta() : (v.nome || numero)),
          sotto: coperto ? "" : numero,
          scelto: numero === scelto
        };
      });

    return {
      vistaBangme: true,
      eddies: eddies.valore,
      eddiesNoti: eddies.valore !== null,
      bangImporto: importo,
      bangImporti: [50, 200, 1000, 5000].map(v => ({
        valore: v,
        etichetta: v >= 1000 ? `${v / 1000}K` : String(v),
        scelto: importo === v
      })),
      bangDestinatari: destinatari,
      bangVuoto: destinatari.length === 0,
      bersaglio: this.stato.bersaglio ?? "",
      // Il tasto dice cosa sta per fare: senza destinatario o senza importo
      // non c'e' niente da mandare, e si vede prima di premerlo.
      bangPronto: !!scelto && importo > 0,
      bangEtichetta: !scelto
        ? game.i18n.localize("CPRX.BangSceglQualcuno")
        : (importo > 0
            ? game.i18n.format("CPRX.BangInvia", { quanto: importo })
            : game.i18n.localize("CPRX.BangMettiImporto"))
    };
  }

  /**
   * HusTool: «schiaccia VOGLIO IL CASH e trova qualcosa». Mezz'ora, dieci
   * eurodollari, e un 1d10 che decide se e' andata storta (1), bene (2-9) o
   * bene ma con dei guai (10).
   *
   * Lo storico sta nel flag: senza, il tasto sarebbe un accredito e basta e
   * non resterebbe traccia di quante ore hai passato a portare divani.
   */
  #contestoHustool() {
    const voci = leggiVoci(this.attore, "hustool");
    const quando = (t) => new Date(t).toLocaleString(game.i18n.lang,
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    return {
      vistaHustool: true,
      husPaga: HUSTOOL_PAGA,
      husMinuti: HUSTOOL_DURATA / 60,
      husVuoto: voci.length === 0,
      husStorico: [...voci].reverse().slice(0, 12).map(v => ({
        titolo: game.i18n.localize(v.esito === "male"
          ? "CPRX.HusAndataMale"
          : (v.esito === "guai" ? "CPRX.HusConGuai" : "CPRX.HusAndataBene")),
        quando: quando(v.quando),
        // Un lavoretto andato male non paga «+0»: paga zero.
        pagaTesto: v.paga > 0 ? `+${v.paga}` : "0",
        male: v.esito === "male",
        guai: v.esito === "guai"
      })),
      husTotale: voci.reduce((somma, v) => somma + (Number(v.paga) || 0), 0)
    };
  }

  /**
   * Roach Race: un platform, e un platform non ci sta dentro un Agent di
   * Foundry. Quello che ci sta e' il punteggio — si tira, si tiene il
   * record, e il tavolo si confronta. Il manuale non da' numeri, quindi non
   * ne sono stati inventati: e' un tiro e basta.
   */
  #contestoRoach() {
    const stato = statoRoach(this.attore);

    // La classifica del tavolo: chi ha l'App e ha giocato almeno una volta.
    const classifica = game.actors
      .filter(a => appInstallate(a).includes("roachrace"))
      .map(a => ({ nome: a.name, record: statoRoach(a).record, io: a.id === this.attore.id }))
      .filter(r => r.record > 0)
      .sort((a, b) => b.record - a.record)
      .slice(0, 8);

    return {
      vistaRoach: true,
      roachRecord: stato.record,
      roachPartite: stato.partite,
      roachUltima: stato.ultima,
      roachGiocato: stato.partite > 0,
      roachClassifica: classifica,
      roachHaClassifica: classifica.length > 0
    };
  }

  /**
   * WatchBox: cinque minuti per mappare la stanza, poi l'Agent resta li' e
   * suona se qualcuno entra. Due limiti del manuale che valgono davvero:
   * non funziona con un Agent Interno, e si elude con Furtivita' VD 13.
   */
  #contestoWatchbox() {
    const stato = statoWatchbox(this.attore);
    const interno = haAgentInterno(this.attore);

    return {
      vistaWatchbox: true,
      watchInterno: interno,
      watchLato: WATCHBOX_LATO,
      watchVd: WATCHBOX_VD_FURTIVITA,
      watchMinuti: WATCHBOX_MAPPATURA / 60,
      watchStanza: this.stato.bersaglio ?? "",
      watchAttivo: !!stato,
      watch: stato ? {
        stanza: stato.stanza,
        quando: new Date(stato.quando).toLocaleString(game.i18n.lang,
          { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      } : null
    };
  }

  /**
   * Brainwasher: un'ora al giorno per una settimana prima di cominciare la
   * terapia, poi 1d10 — pari, la terapia dura un giorno di meno; dispari,
   * uno di piu'. Il conto e' di giorni **di mondo**: due sessioni nello
   * stesso giorno non contano due volte.
   */
  #contestoBrainwasher() {
    const stato = statoBrainwasher(this.attore);
    const fatte = Math.min(BRAINWASHER_GIORNI, stato.sessioni);
    const oggiFatta = brainwasherOggiFatta(this.attore);

    return {
      vistaBrainwasher: true,
      bwGiorni: BRAINWASHER_GIORNI,
      bwFatte: fatte,
      bwPercento: Math.round((fatte / BRAINWASHER_GIORNI) * 100),
      bwCompleto: fatte >= BRAINWASHER_GIORNI,
      bwOggiFatta: oggiFatta,
      bwEsito: stato.esito,
      bwPrima: stato.esito === "prima",
      bwSessioni: Array.from({ length: BRAINWASHER_GIORNI }, (_, i) => ({
        numero: i + 1,
        fatta: i < fatte,
        oggi: i === fatte && !oggiFatta
      }))
    };
  }

  /**
   * Elflines Elftracker: la scheda dell'account. Le STAT dell'elfo le scrive
   * il giocatore e il modulo non ci tira niente sopra — e' un tracker, non
   * un secondo personaggio.
   */
  #contestoElflines() {
    const stato = statoElflines(this.attore);
    const dati = stato ?? {};

    // `elf` c'e' sempre, anche senza account: senza, il modulo di
    // collegamento non avrebbe i campi delle STAT — sono resi da un
    // `{{#each elf.stat}}` — e si salverebbe un elfo senza numeri.
    return {
      vistaElflines: true,
      elfCollegato: !!stato,
      elf: {
        nome: dati.nome ?? "",
        livello: dati.livello ?? "",
        gilda: dati.gilda ?? "",
        server: dati.server ?? "",
        stat: ELFLINES_STAT.map(chiave => ({
          chiave,
          etichetta: game.i18n.localize(`CPRX.Elf${chiave.charAt(0).toUpperCase()}${chiave.slice(1)}`),
          // Due valori per la stessa cosa: `valore` e' quello che si legge
          // nel quadretto — un campo vuoto diventa un trattino — e `campo`
          // e' quello che va nel modulo, dove un trattino sarebbe da
          // cancellare a mano prima di scrivere il numero.
          valore: dati[chiave] || "—",
          campo: dati[chiave] ?? ""
        }))
      },
      elfModulo: this.stato.modifica === "elflines"
    };
  }

  /**
   * Netwatch Sentinel. Nel manuale non c'e' un'App che difende un Agent —
   * c'e' il giro per **hackerarlo**: Breacher a venti metri con linea di
   * vista, prova di Elettronica e Sicurezza contro un VD che dipende dalla
   * qualita' del dispositivo, e il proprietario che puo' accorgersene
   * tirando lui, o riavviare e buttare fuori tutti.
   *
   * Sentinel e' quella pagina vista dall'altra parte. I numeri sono quelli
   * del manuale; la controscansione e' una prova vera; i nodi non sono
   * inventati — sono le cose dell'Agent che parlano davvero verso fuori.
   */
  #contestoSentinel() {
    const stato = statoSentinel(this.attore);
    const def = QUALITA_AGENT[stato.qualita];
    const interno = haAgentInterno(this.attore);
    const installate = appInstallate(this.attore);

    const nodo = (nome, meta, sicuro) => ({
      nome,
      meta,
      sicuro,
      stato: game.i18n.localize(sicuro ? "CPRX.NodoSicuro" : "CPRX.NodoEsposto")
    });

    const nodi = [
      // Un Agent Interno non si hackera col Breacher: lo dice il manuale.
      interno
        ? nodo(game.i18n.localize("CPRX.NodoAgent"), game.i18n.localize("CPRX.NodoInterno"), true)
        : nodo(game.i18n.localize("CPRX.NodoAgent"),
            game.i18n.format("CPRX.NodoVd", { vd: def.vdRemoto }), false)
    ];

    if (this.attore.getFlag(MODULO, "gps")) {
      nodi.push(nodo(game.i18n.localize("CPRX.TracciamentoGps"),
        game.i18n.localize("CPRX.NodoGps"), false));
    }
    // Big IAAA trasmette in continuazione, e non si puo' spegnere: e' un
    // nodo esposto per definizione, non per una scelta di questo modulo.
    if (statoBigIaaa(this.attore)) {
      nodi.push(nodo(APP_ACQUISTABILI.bigiaaa.nome,
        game.i18n.localize("CPRX.NodoTelemetria"), false));
    }
    if (installate.includes("watchbox") && statoWatchbox(this.attore)) {
      nodi.push(nodo(APP_ACQUISTABILI.watchbox.nome,
        game.i18n.localize("CPRX.NodoWatchbox"), false));
    }

    const quando = (t) => new Date(t).toLocaleString(game.i18n.lang,
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    return {
      vistaSentinel: true,
      sentQualita: stato.qualita,
      sentQualitaNome: game.i18n.localize(def.etichetta),
      sentVdRemoto: def.vdRemoto,
      sentVdDiretto: def.vdDiretto,
      sentQualitaScelte: Object.entries(QUALITA_AGENT).map(([chiave, q]) => ({
        chiave,
        etichetta: game.i18n.localize(q.etichetta),
        scelta: chiave === stato.qualita
      })),
      sentNodi: nodi,
      // Il perimetro e' pulito se non c'e' niente di esposto. Non e' un
      // punteggio: e' il conto delle righe rosse qui sopra.
      sentPulito: nodi.every(n => n.sicuro),
      sentEsposti: nodi.filter(n => !n.sicuro).length,
      sentRiavvio: stato.riavvio ? quando(stato.riavvio) : "",
      sentMinuti: SENTINEL_RIAVVIO / 60,
      sentRegistro: [...stato.registro].reverse().slice(0, 8).map(v => ({
        quando: quando(v.quando),
        testo: game.i18n.format("CPRX.SentTiroRiga", { totale: v.totale }),
        buono: v.totale >= def.vdRemoto
      })),
      sentHaRegistro: stato.registro.length > 0
    };
  }

  /**
   * Ziggurat Patch Pro: lo studio dietro la Patch. Non tiene un secondo
   * archivio — bozze a parte, tutto quello che mostra lo legge da Garden.
   * Gli iscritti del prototipo non ci sono: al loro posto ci sono i post e
   * i cuori veri, che sono numeri che al tavolo esistono.
   */
  #contestoPatchpro() {
    const scheda = PATCHPRO_SCHEDE.includes(this.stato.patchScheda)
      ? this.stato.patchScheda
      : "bozze";

    const mio = numeroDi(this.attore);
    const miei = gardenPatch().filter(v => v.numero === mio);
    const bozze = bozzePatch(this.attore);

    const quando = (t) => new Date(t).toLocaleString(game.i18n.lang,
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const cuoriDi = (v) => (Array.isArray(v.cuori) ? v.cuori.length : 0);
    const cuoriTotali = miei.reduce((somma, v) => somma + cuoriDi(v), 0);

    // Sette giorni di pubblicazioni, dal piu' vecchio al piu' recente. La
    // colonna piu' alta fa da scala: senza, con due post la prima riempie
    // il grafico e sembra un record.
    const giorno = 86400000;
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const settimana = Array.from({ length: 7 }, (_, i) => {
      const inizio = oggi.getTime() - (6 - i) * giorno;
      return {
        etichetta: new Date(inizio)
          .toLocaleDateString(game.i18n.lang, { weekday: "short" }).toUpperCase(),
        quanti: miei.filter(v => v.quando >= inizio && v.quando < inizio + giorno).length
      };
    });
    const massimo = Math.max(1, ...settimana.map(g => g.quanti));

    const elenchi = {
      bozze: bozze.map(v => ({
        id: v.id,
        titolo: (v.testo ?? "").slice(0, 40) || "—",
        testo: v.testo ?? "",
        meta: quando(v.creato),
        bozza: true
      })),
      pubblicate: [...miei].reverse().map(v => ({
        id: v.id,
        titolo: (v.testo ?? "").slice(0, 40),
        testo: v.testo ?? "",
        meta: `${quando(v.quando)} · ${game.i18n.format("CPRX.PatchCuori", { quanti: cuoriDi(v) })}`
      })),
      reazioni: [...miei]
        .filter(v => cuoriDi(v) > 0)
        .sort((a, b) => cuoriDi(b) - cuoriDi(a))
        .map(v => ({
          id: v.id,
          titolo: game.i18n.format("CPRX.PatchCuori", { quanti: cuoriDi(v) }),
          testo: (v.testo ?? "").slice(0, 90),
          // I numeri di chi ha messo il cuore non si scrivono: su una
          // bacheca pubblica il gesto e' pubblico, il recapito no.
          meta: quando(v.quando)
        })),
      analisi: []
    };

    if (miei.length) {
      const migliore = [...miei].sort((a, b) => cuoriDi(b) - cuoriDi(a))[0];
      elenchi.analisi = [
        {
          titolo: game.i18n.localize("CPRX.PatchMedia"),
          testo: game.i18n.format("CPRX.PatchMediaTesto", {
            media: (cuoriTotali / miei.length).toFixed(1), quanti: miei.length
          })
        },
        {
          titolo: game.i18n.localize("CPRX.PatchMigliore"),
          testo: (migliore.testo ?? "").slice(0, 90),
          meta: game.i18n.format("CPRX.PatchCuori", { quanti: cuoriDi(migliore) })
        }
      ];
    }

    return {
      vistaPatchpro: true,
      patchScheda: scheda,
      patchSchede: PATCHPRO_SCHEDE.map(chiave => ({
        chiave,
        etichetta: game.i18n.localize(`CPRX.Patch${chiave.charAt(0).toUpperCase()}${chiave.slice(1)}`),
        attiva: chiave === scheda
      })),
      patchPost: miei.length,
      patchCuori: cuoriTotali,
      patchBozze: bozze.length,
      patchSettimana: settimana.map(g => ({
        ...g,
        altezza: Math.round((g.quanti / massimo) * 100)
      })),
      patchElenco: elenchi[scheda],
      patchVuoto: elenchi[scheda].length === 0,
      patchInBozze: scheda === "bozze",
      patchPuoScrivere: this.puoScrivere && !!mio
    };
  }

  /**
   * Big IAAA: da +2 a +3 alle Prove di Archivistica, e i dati di utilizzo
   * alla Ziggurat. La seconda meta' non e' una battuta: e' scritta nel
   * manuale, sta nella schermata, e non si puo' spegnere.
   */
  #contestoBigIaaa() {
    const acceso = statoBigIaaa(this.attore);

    return {
      vistaBigIaaa: true,
      iaaaAcceso: acceso,
      iaaaBonus: acceso ? IAAA_BONUS_GRANDE : IAAA_BONUS_BASE,
      iaaaBase: IAAA_BONUS_BASE,
      iaaaGrande: IAAA_BONUS_GRANDE
    };
  }

  /**
   * Il calendario: che giorno e' nel mondo, cosa c'e' in programma, e cosa
   * fai della settimana.
   *
   * La griglia del mese e' una griglia vera — sette colonne, la settimana
   * che comincia di lunedi' come in Europa — e i giorni che sporgono dal
   * mese sono resi lo stesso, spenti, perche' una griglia con dei buchi si
   * legge peggio di una piena.
   *
   * Il giorno scelto sta in `stato.giorno`, il mese sfogliato in
   * `stato.mese` (uno scarto in mesi da oggi, non una data). La griglia la
   * costruisce `grigliaMese()`: qui si aggiunge solo quello che il
   * calendario non sa da solo — qual e' oggi, qual e' aperto, dove c'e'
   * qualcosa in programma.
   */
  #contestoCalendario() {
    const oggi = istante();
    const chiaveOggi = chiaveGiorno(oggi);
    const scarto = Number(this.stato.mese) || 0;
    const scelto = this.stato.giorno ?? chiaveOggi;

    const conEventi = new Set(calendarioVoci().map(v => v.giorno));
    const { primo, celle } = grigliaMese(scarto, oggi);

    for (const c of celle) {
      if (c.fuori) continue;
      c.oggi = c.chiave === chiaveOggi;
      c.scelto = c.chiave === scelto;
      c.punto = conEventi.has(c.chiave);
    }

    const dataScelta = daChiaveGiorno(scelto);
    const eventi = calendarioVoci()
      .filter(v => v.giorno === scelto)
      .map(v => ({ id: v.id, titolo: v.titolo || "—", testo: v.testo ?? "" }));

    // Il prossimo che arriva, da oggi in avanti: un calendario che non dice
    // cosa sta per succedere non serve a niente.
    const prossimi = calendarioVoci()
      .filter(v => v.giorno >= chiaveOggi)
      .sort((a, b) => a.giorno.localeCompare(b.giorno))
      .slice(0, 4)
      .map(v => ({
        id: v.id,
        titolo: v.titolo || "—",
        quando: formattaData(daChiaveGiorno(v.giorno) ?? oggi,
          { day: "numeric", month: "short" }),
        oggi: v.giorno === chiaveOggi
      }));

    // Le scadenze: quello che ti verra' addebitato, e quando. Non e' un
    // elenco archiviato — si ricava da dove i numeri stanno gia': il canone
    // dalla Casa, l'abbonamento dall'App che ce l'ha. Chi aggiunge una spesa
    // ricorrente la aggiunga qui, non in un secondo registro.
    const casa = statoCasa(this.attore);
    // Il primo del mese che viene. Passa da `istante()` e non da una data
    // costruita a mano: la data del mondo e' il contatore piu' `dataZero`,
    // e un `new Date(worldTime * 1000)` finirebbe nel 1970.
    const primoProssimo = istante(oraMondo() + secondiAlMeseProssimo(oggi));
    const scadenze = [];

    if (casa.totale > 0) {
      scadenze.push({
        chiave: "casa",
        titolo: game.i18n.localize("CPRX.CasaCausale"),
        nota: etichettaCasa(alloggi()[casa.alloggio]),
        quando: formattaData(primoProssimo, { day: "numeric", month: "short" }),
        importo: -casa.totale
      });
    }

    if (appPossedute(this.attore).includes("brainwasher")) {
      scadenze.push({
        chiave: "brainwasher",
        titolo: APP_ACQUISTABILI.brainwasher.nome,
        nota: game.i18n.localize("CPRX.CalMensile"),
        quando: formattaData(primoProssimo, { day: "numeric", month: "short" }),
        importo: -APP_ACQUISTABILI.brainwasher.prezzo
      });
    }

    return {
      vistaCalendario: true,
      etichettaApp: game.i18n.localize("CPRX.AppCalendario"),
      iconaApp: APP.calendario.icona,
      scadenze,
      haScadenze: scadenze.length > 0,

      /* --- oggi --- */
      oggiLungo: formattaData(oggi),
      oggiOra: istante().toLocaleTimeString(game.i18n.lang,
        { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
      settimanaNumero: settimanaDellAnno(),

      /* --- la griglia --- */
      intestazioneMese: formattaData(primo, { month: "long", year: "numeric" }).toUpperCase(),
      iniziali: GIORNI_INIZIALI.map(k => game.i18n.localize(k)),
      celle,
      seguente: scarto + 1,
      precedente: scarto - 1,
      tornaOggi: scarto !== 0,

      /* --- il giorno aperto --- */
      giornoScelto: scelto,
      giornoLungo: formattaData(dataScelta ?? oggi, { weekday: "long", day: "numeric", month: "long" }),
      eventi,
      haEventi: eventi.length > 0,
      prossimi,
      haProssimi: prossimi.length > 0,

      /* --- il downtime della settimana --- */
      ...this.#contestoDowntime()
    };
  }

  /**
   * La settimana corrente: cosa hai dichiarato di fare, e cosa ne ha detto
   * il master. Una dichiarazione per settimana — il downtime e' la
   * settimana, non un elenco di cose da fare dentro la settimana — e
   * finche' il master non la chiude resta modificabile.
   */
  #contestoDowntime() {
    const settimana = settimanaDiGioco();
    const voci = downtimeDi(this.attore);
    const questa = voci.find(v => v.settimana === settimana) ?? null;
    const chiuso = questa?.stato === "chiuso";

    const attivita = Object.entries(ATTIVITA).map(([chiave, def]) => ({
      chiave,
      etichetta: game.i18n.localize(def.etichetta),
      icona: def.icona,
      scelta: chiave === (questa?.attivita ?? "riposo")
    }));

    return {
      // Il numero mostrato e' quello dell'anno; `settimana` resta la chiave.
      dtSettimana: settimanaDellAnno(),
      dtModulo: this.stato.dichiara === true && !chiuso,
      dtAttivita: attivita,
      dtVoce: questa ? {
        etichetta: game.i18n.localize(ATTIVITA[questa.attivita]?.etichetta ?? "CPRX.DtAffari"),
        icona: ATTIVITA[questa.attivita]?.icona ?? ATTIVITA.affari.icona,
        nota: questa.nota ?? "",
        chiuso,
        esito: questa.esito ?? ""
      } : null,
      // Chiusa dal master non si tocca piu': l'esito e' scritto.
      dtModificabile: !chiuso,
      // Le settimane passate, per ricordarsi cosa si e' fatto.
      dtStorico: voci
        .filter(v => v.settimana !== settimana)
        .slice(0, 6)
        .map(v => ({
          settimana: etichettaSettimana(v.settimana),
          etichetta: game.i18n.localize(ATTIVITA[v.attivita]?.etichetta ?? "CPRX.DtAffari"),
          icona: ATTIVITA[v.attivita]?.icona ?? ATTIVITA.affari.icona,
          esito: v.esito ?? "",
          chiuso: v.stato === "chiuso"
        })),
      dtHaStorico: voci.some(v => v.settimana !== settimana)
    };
  }

  /**
   * Phone: una sola App, quattro linguette in basso — preferiti, recenti,
   * contatti, tastierino. Su un telefono la rubrica non e' un'applicazione
   * a parte, ed era l'unica ragione per cui qui ce n'erano due.
   *
   * La linguetta sta in `stato.telefonoScheda`, di serie il tastierino:
   * aprire il telefono vuol dire poter comporre un numero.
   *
   * Sopra le quattro linguette ce n'e' una quinta che non e' una linguetta:
   * la **scheda di un contatto**, in `stato.contattoNumero`. Prende tutto
   * lo schermo e nasconde le liste, come su un telefono vero — la barra
   * delle linguette resta, e toccarne una chiude la scheda.
   */
  #contestoTelefono() {
    const scheda = ["preferiti", "recenti", "contatti"].includes(this.stato.telefonoScheda)
      ? this.stato.telefonoScheda
      : "tastierino";

    const apertoContatto = !!this.stato.contattoNumero;

    const base = {
      vistaTelefono: true,
      etichettaApp: game.i18n.localize("CPRX.AppTelefono"),
      iconaApp: APP.telefono.icona,
      telefonoScheda: scheda,
      schedaContatto: apertoContatto,
      schedaTastierino: !apertoContatto && scheda === "tastierino",
      schedaRecenti: !apertoContatto && scheda === "recenti",
      schedaContatti: !apertoContatto && scheda === "contatti",
      schedaPreferiti: !apertoContatto && scheda === "preferiti",
      telefonoSchede: [
        { chiave: "preferiti", icona: "fa-solid fa-star", etichetta: game.i18n.localize("CPRX.TelefonoPreferiti"), attiva: !apertoContatto && scheda === "preferiti" },
        { chiave: "recenti", icona: "fa-solid fa-clock-rotate-left", etichetta: game.i18n.localize("CPRX.Recenti"), attiva: !apertoContatto && scheda === "recenti", conteggio: chiamatePerse(this.attore) },
        { chiave: "contatti", icona: APP.contatti.icona, etichetta: game.i18n.localize("CPRX.AppContatti"), attiva: !apertoContatto && scheda === "contatti" },
        { chiave: "tastierino", icona: "fa-solid fa-grip", etichetta: game.i18n.localize("CPRX.TelefonoTastierino"), attiva: !apertoContatto && scheda === "tastierino" }
      ]
    };

    if (apertoContatto) return { ...base, ...this.#contestoContatto() };
    if (scheda === "recenti") return { ...base, ...this.#contestoRecenti() };
    if (scheda === "contatti" || scheda === "preferiti") {
      return { ...base, ...this.#contestoRubrica(scheda === "preferiti") };
    }

    const composto = this.stato.composto ?? "";

    return {
      ...base,
      composto,
      // La riga sotto il display dice a che punto sei: e' la sola cosa che
      // il telefono sa di un numero mentre lo stai ancora scrivendo.
      numeroInfo: game.i18n.localize(composto
        ? (attorePerNumero(normalizzaNumero(composto))
            ? "CPRX.NumeroRaggiungibile"
            : "CPRX.NumeroInComposizione")
        : "CPRX.ComponiNumero"),
      // Le lettere sotto le cifre: su un tastierino ci sono, e senza si vede
      // subito che non e' un telefono.
      tasti: [
        { cifra: "1", lettere: "" }, { cifra: "2", lettere: "ABC" }, { cifra: "3", lettere: "DEF" },
        { cifra: "4", lettere: "GHI" }, { cifra: "5", lettere: "JKL" }, { cifra: "6", lettere: "MNO" },
        { cifra: "7", lettere: "PQRS" }, { cifra: "8", lettere: "TUV" }, { cifra: "9", lettere: "WXYZ" },
        { cifra: "*", lettere: "" }, { cifra: "0", lettere: "+" }, { cifra: "#", lettere: "" }
      ]
    };
  }

  /** Lo storico: una riga per telefonata, con l'esito e l'ora. */
  #contestoRecenti() {
    const ora = (quando) => new Date(quando)
      .toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" });
    const giorno = (quando) => new Date(quando)
      .toLocaleDateString(game.i18n.lang, { day: "2-digit", month: "2-digit" });

    const righe = chiamateRecenti(this.attore).map(r => {
      const coperto = this.#coperto(r.numero, r.anonimo);
      return {
        idChiamata: r.idChiamata,
        numero: r.numero,
        coperto,
        gruppo: r.gruppo,
        nome: r.gruppo
          ? (r.nomeGruppo || nomeGruppoPredefinito(r.membri))
          : (coperto ? etichettaCoperta() : (nomePerNumero(this.attore, r.numero) || r.nome || r.numero)),
        // Coperto vuol dire coperto anche qui: nei recenti il numero non si
        // scrive, e il tasto richiama lo stesso perche' passa da `data-numero`.
        // In un gruppo il numero non ce n'e' uno solo, quindi non se ne
        // scrive nessuno.
        etichettaNumero: (coperto || r.gruppo) ? "" : r.numero,
        esito: r.esito,
        persa: r.esito === "persa",
        icona: r.esito === "persa" ? "fa-solid fa-phone-slash"
          : (r.esito === "fatta" ? "fa-solid fa-phone-arrow-up-right" : "fa-solid fa-phone"),
        quando: `${giorno(r.quando)} · ${ora(r.quando)}`
      };
    });

    return { recenti: righe, haRecenti: righe.length > 0 };
  }

  /**
   * La rubrica dentro Phone: chiama, scrivi, apri la scheda. Con
   * `soloPreferiti` e' la stessa lista filtrata — una linguetta in meno da
   * mantenere, e i preferiti sono contatti, non un'altra cosa.
   */
  #contestoRubrica(soloPreferiti = false) {
    const coperti = numeriCoperti(this.attore);
    const cerca = soloPreferiti ? "" : (this.stato.ricerca ?? "").trim().toLowerCase();

    const rubrica = leggiVoci(this.attore, "contatti")
      .filter(v => !soloPreferiti || v.preferito)
      // La ricerca non guarda il numero: un numero coperto non si scrive,
      // e cercarlo lo farebbe emergere da quale riga resta in elenco.
      .filter(v => !cerca || [v.nome, v.ruolo, v.handle]
        .filter(Boolean).join(" ").toLowerCase().includes(cerca))
      .map(v => {
        const numero = v.numero ? normalizzaNumero(v.numero) : "";
        const coperto = !!numero && coperti.has(numero);
        return {
          id: v.id,
          numero,
          coperto,
          preferito: !!v.preferito,
          chiamabile: !!numero,
          iniziale: iniziali(coperto ? etichettaCoperta() : (v.nome || numero || "—")),
          nome: coperto ? etichettaCoperta() : (v.nome || numero || "—"),
          sotto: coperto ? "" : [numero, v.ruolo, v.handle].filter(Boolean).join(" · ")
        };
      });

    return {
      rubrica,
      haRubrica: rubrica.length > 0,
      mostraRubrica: true,
      soloPreferiti,
      ricerca: cerca ? (this.stato.ricerca ?? "") : "",
      // Due elenchi vuoti diversi: «non hai contatti» e «non ne hai messo
      // nessuno fra i preferiti» non sono lo stesso problema.
      vuotoRubrica: game.i18n.localize(
        soloPreferiti ? "CPRX.NessunPreferito" : "CPRX.NessunContatto")
    };
  }

  /**
   * La scheda di un contatto. Si apre da un numero, non da un identificativo
   * di rubrica: cosi' funziona anche per chi in rubrica non c'e' — e per
   * quello che c'e' si trova la voce e si prendono ruolo, handle e note.
   *
   * La copertura vale qui come ovunque: di un numero coperto non si scrive
   * la cifra, non si offre di salvarlo in rubrica e non si apre in modifica.
   */
  #contestoContatto() {
    const numero = normalizzaNumero(this.stato.contattoNumero ?? "");
    const voce = leggiVoci(this.attore, "contatti")
      .find(v => v.numero && normalizzaNumero(v.numero) === numero) ?? null;

    const coperto = this.#coperto(numero, false);
    const nome = coperto
      ? etichettaCoperta()
      : (voce?.nome || nomePerNumero(this.attore, numero) || numero);

    const ora = (quando) => new Date(quando)
      .toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" });
    const giorno = (quando) => new Date(quando)
      .toLocaleDateString(game.i18n.lang, { day: "2-digit", month: "2-digit" });

    const storico = chiamateRecenti(this.attore)
      .filter(r => !r.gruppo && r.numero === numero)
      .slice(0, 6)
      .map(r => ({
        esito: r.esito,
        persa: r.esito === "persa",
        icona: r.esito === "persa" ? "fa-solid fa-phone-slash"
          : (r.esito === "fatta" ? "fa-solid fa-phone-arrow-up-right" : "fa-solid fa-phone"),
        etichetta: game.i18n.localize(ESITO_CHIAMATA[r.esito] ?? ESITO_CHIAMATA.fatta),
        quando: `${giorno(r.quando)} · ${ora(r.quando)}`
      }));

    const righe = [];
    if (!coperto) righe.push({ etichetta: game.i18n.localize("CPRX.CampoNumero"), valore: numero });
    if (voce?.ruolo) righe.push({ etichetta: game.i18n.localize("CPRX.CampoRuolo"), valore: voce.ruolo });
    if (voce?.handle) righe.push({ etichetta: game.i18n.localize("CPRX.CampoHandle"), valore: voce.handle });

    return {
      contatto: {
        numero,
        coperto,
        nome,
        iniziale: iniziali(nome),
        sotto: voce?.ruolo || "",
        note: coperto ? "" : (voce?.note || ""),
        id: voce?.id ?? "",
        inRubrica: !!voce,
        preferito: !!voce?.preferito,
        righe,
        storico,
        haStorico: storico.length > 0
      }
    };
  }

  /* ---------------------------------------------------------------- */
  /* App acquistabili con una funzione                                 */
  /* ---------------------------------------------------------------- */

  #intestazioneApp(chiave) {
    const def = APP_ACQUISTABILI[chiave];
    return {
      etichettaApp: def.nome,
      iconaApp: def.icona,
      produttore: def.produttore,
      descrizione: game.i18n.localize(def.descrizione),
      chiaveApp: chiave
    };
  }

  #contestoGladiator() {
    const sfida = sfidaAperta(this.attore);
    const glad = gladiatoreDi(this.attore);
    const bilancio = arenaBilancio(this.attore);

    // Candidati a gladiatore: gli attori che possiedo, meno me stesso — il
    // gladiatore e' una scheda a parte, non il personaggio che lo pilota.
    const candidati = game.actors
      .filter(a => a.isOwner && a.id !== this.attore.id)
      .map(a => ({ id: a.id, nome: a.name, scelto: a.id === glad?.id }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      vistaGladiator: true,
      composto: this.stato.composto ?? "",
      posta: this.stato.posta ?? "",
      agentInterno: haAgentInterno(this.attore),

      /* --- la scheda del gladiatore --- */
      gladiatore: glad ? {
        id: glad.id,
        nome: glad.name,
        immagine: glad.img,
        ...schedaArena(glad),
        attore: undefined
      } : null,
      candidati,
      haCandidati: candidati.length > 0,

      /* --- classifica --- */
      bilancio,
      haStorico: bilancio.duelli > 0,
      storico: [...arenaStorico(this.attore)].reverse().slice(0, 6).map(v => ({
        ...v,
        etichettaModo: game.i18n.localize(
          v.modo === "amichevole" ? "CPRX.ArenaAmichevole" : "CPRX.ArenaClassificata"),
        quando: new Date(v.quando).toLocaleDateString(game.i18n.lang,
          { day: "2-digit", month: "2-digit" })
      })),

      sfida: sfida ? {
        ...sfida,
        nome: this.#nomeAltro(sfida, sfida.inArrivo),
        amichevole: sfida.modo === "amichevole",
        etichettaModo: game.i18n.localize(
          sfida.modo === "amichevole" ? "CPRX.ArenaAmichevole" : "CPRX.ArenaClassificata")
      } : null
    };
  }

  /**
   * Un numero e' coperto se lo e' il suo filo, o se la voce che lo porta
   * arriva anonima. Un solo posto da chiamare, cosi' nessuna vista si
   * dimentica un pezzo.
   */
  #coperto(numero, anonimo = false) {
    if (vedoInChiaro()) return false;
    if (anonimo) return true;
    const cercato = normalizzaNumero(numero);
    return !!cercato && numeriCoperti(this.attore).has(cercato);
  }

  /** Il nome dell'altro capo di una voce, coperto se ha nascosto il numero. */
  #nomeAltro(voce, inArrivo) {
    const numero = inArrivo ? voce.da : voce.a;
    if (this.#coperto(numero, inArrivo && !!voce.anonimo)) return etichettaCoperta();
    return nomePerNumero(this.attore, numero) || (inArrivo ? voce.daNome : voce.aNome) || numero;
  }

  #contestoFortify() {
    const stato = statoFortify(this.attore);
    return {
      vistaFortify: true,
      bersaglio: this.stato.bersaglio ?? "",
      marcatura: stato ? {
        bersaglio: stato.bersaglio,
        quando: new Date(stato.quando).toLocaleTimeString(game.i18n.lang,
          { hour: "2-digit", minute: "2-digit" })
      } : null
    };
  }

  /**
   * NCPD: l'elenco degli schedati e nient'altro. Lo compila il master dalla
   * sua console, lo consulta chi ha l'App. Niente ricerche, niente foto: se
   * una faccia non e' in elenco, non e' schedata.
   *
   * Qui dentro non si scrive, e non c'e' un ramo per il GM: un Agent e' il
   * telefono di un personaggio, e da un telefono non si mette gente nel
   * casellario della polizia.
   */
  #contestoNcpd() {
    const voci = schedario();
    const aperta = this.stato.scheda
      ? voci.find(v => v.id === this.stato.scheda) ?? null
      : null;

    return {
      vistaNcpd: true,
      vuoto: voci.length === 0,
      voci: voci.map(v => ({
        id: v.id,
        nome: v.nome,
        riga: [v.alias, v.taglia ? `${v.taglia} eb` : ""].filter(Boolean).join(" · ")
      })),
      scheda: aperta ? {
        id: aperta.id ?? "",
        nome: aperta.nome ?? "",
        alias: aperta.alias ?? "",
        taglia: aperta.taglia ?? "",
        mandati: aperta.mandati ?? "",
        precedenti: aperta.precedenti ?? ""
      } : null
    };
  }

  #contestoMedscan() {
    const stato = statoMedscan(this.attore);
    const eddies = trovaEddies(this.attore);
    const abbonato = abbonatoTrauma(this.attore);
    const def = stato ? MEDSCAN_LIVELLI[stato.livello] : null;

    return {
      vistaMedscan: true,
      composto: this.stato.composto ?? "",
      eddies: eddies.valore,
      eddiesNoti: eddies.valore !== null,
      abbonato,
      livelli: Object.entries(MEDSCAN_LIVELLI).map(([chiave, l]) => ({
        chiave,
        etichetta: game.i18n.localize(l.etichetta),
        usi: game.i18n.localize(l.usi),
        prezzo: abbonato ? 0 : l.prezzo,
        bonus: l.bonus,
        ore: l.ore,
        // L'abbonato non paga: il prezzo non puo' fermarlo.
        troppoCaro: !abbonato && eddies.valore !== null && l.prezzo > eddies.valore
      })),
      consulto: stato && !stato.scaduto ? {
        etichetta: game.i18n.localize(def?.etichetta ?? "CPRX.MedscanPronto"),
        usi: game.i18n.localize(def?.usi ?? "CPRX.MedscanUsiPronto"),
        bonus: def?.bonus ?? 1,
        per: stato.per ?? "",
        restano: Math.max(0, Math.round((stato.fino - (game.time?.worldTime ?? 0)) / 60))
      } : null
    };
  }

  #contestoZiggurat() {
    const stato = statoZiggurat(this.attore);
    const citta = stato?.citta ?? "";
    const filtro = (this.stato.categoria ?? "").trim();
    const cerca = (this.stato.ricerca ?? "").trim().toLowerCase();

    // Lo sportello mostra la citta' impostata; se non ne hai impostata
    // nessuna, mostra tutto — meglio troppo che niente.
    const tutte = zigguratDb().filter(v => !citta || !v.citta || v.citta === citta);

    const voci = tutte
      .filter(v => !filtro || v.categoria === filtro)
      .filter(v => !cerca || `${v.nome} ${v.zona} ${v.testo}`.toLowerCase().includes(cerca))
      .map(v => ({
        id: v.id,
        nome: v.nome || "—",
        categoria: game.i18n.localize(ZIGGURAT_CATEGORIE[v.categoria] ?? "CPRX.ZigCatServizi"),
        zona: v.zona ?? "",
        testo: v.testo ?? "",
        aperta: v.id === this.stato.scheda
      }));

    return {
      vistaZiggurat: true,
      citta,
      bonus: ZIGGURAT_BONUS,
      attiva: !!stato,
      ricerca: this.stato.ricerca ?? "",
      categorie: Object.entries(ZIGGURAT_CATEGORIE).map(([chiave, etichetta]) => ({
        chiave,
        etichetta: game.i18n.localize(etichetta),
        attiva: chiave === filtro,
        conteggio: tutte.filter(v => v.categoria === chiave).length
      })),
      filtroAttivo: !!filtro,
      voci,
      vuoto: voci.length === 0,
      dbVuoto: tutte.length === 0
    };
  }

  #contestoElenco(def, voci) {
    // Un contatto che tiene il numero coperto non mostra niente: ne' nome,
    // ne' recapito, ne' numero. Resta la riga, e resta il collegamento.
    const coperti = def.contattabile ? numeriCoperti(this.attore) : new Set();
    const cerca = (this.stato.ricerca ?? "").trim().toLowerCase();

    const righe = voci.map(v => {
      // I contatti con un numero si chiamano e si messaggiano dall'elenco.
      const numero = def.contattabile?.(v) ? normalizzaNumero(v.numero) : null;
      const coperto = !!numero && coperti.has(numero);

      return {
        id: v.id,
        titolo: coperto ? etichettaCoperta() : def.titolo(v),
        sottotitolo: coperto ? "" : def.sottotitolo(v),
        // Il corpo per intero, non la scia: una nota si legge dall'elenco,
        // e tre righe dicono molto piu' di sessanta caratteri.
        corpo: coperto ? "" : (v.testo ?? ""),
        quando: v.creato
          ? new Date(v.creato).toLocaleDateString(game.i18n.lang,
              { day: "2-digit", month: "short" }).toUpperCase()
          : "",
        stato: v.stato ?? null,
        daMaster: !!v.daMaster,
        numero,
        coperto
      };
    })
      // La ricerca gira su quello che si vede gia': una riga coperta porta
      // `???` e una stringa vuota, quindi non c'e' niente da far emergere.
      .filter(r => !cerca || `${r.titolo} ${r.sottotitolo}`.toLowerCase().includes(cerca));

    return {
      vistaLista: true,
      etichettaApp: game.i18n.localize(def.etichetta),
      iconaApp: def.icona,
      // Il tasto in fondo dice cosa aggiunge, non «nuova voce»: in Note e'
      // una nota, in rubrica un contatto.
      etichettaNuovo: game.i18n.localize(def.nuovo ?? "CPRX.NuovaVoce"),
      ricerca: this.stato.ricerca ?? "",
      vuoto: righe.length === 0,
      voci: righe
    };
  }

  /**
   * Gli Incarichi. Una scheda per lavoro invece di una riga: committente,
   * descrizione, avanzamento e paga stanno tutti sul lavoro, e in un elenco
   * a righe l'unica cosa che si leggeva era il titolo.
   *
   * L'avanzamento non e' un campo — nessuno lo terrebbe aggiornato: viene
   * dallo stato, che e' l'unica cosa che al tavolo si cambia davvero.
   */
  #contestoLavori(def, voci) {
    const AVANZAMENTO = { proposto: 5, corso: 55, concluso: 100, fallito: 100 };
    const chiusi = this.stato.filtroGig === "chiusi";

    const righe = voci
      .filter(v => {
        const finito = v.stato === "concluso" || v.stato === "fallito";
        return chiusi ? finito : !finito;
      })
      .map(v => ({
        id: v.id,
        titolo: def.titolo(v),
        committente: v.committente ?? "",
        iniziale: iniziali(v.committente || def.titolo(v)),
        dettagli: v.dettagli ?? "",
        ricompensa: v.ricompensa ? `${v.ricompensa} eb` : "",
        stato: v.stato ?? "proposto",
        etichettaStato: game.i18n.localize(
          `CPRX.Stato${(v.stato ?? "proposto").charAt(0).toUpperCase()}${(v.stato ?? "proposto").slice(1)}`),
        avanzamento: AVANZAMENTO[v.stato] ?? 5,
        daMaster: !!v.daMaster
      }));

    return {
      vistaLavori: true,
      etichettaApp: game.i18n.localize(def.etichetta),
      iconaApp: def.icona,
      vuoto: righe.length === 0,
      lavori: righe,
      filtriGig: [
        { chiave: "aperti", etichetta: game.i18n.localize("CPRX.GigAttivi"), attiva: !chiusi },
        { chiave: "chiusi", etichetta: game.i18n.localize("CPRX.GigCompletati"), attiva: chiusi }
      ]
    };
  }

  #contestoModulo(def, voci) {
    const esistente = this.stato.modifica === "nuovo"
      ? {}
      : voci.find(v => v.id === this.stato.modifica) ?? {};

    return {
      vistaForm: true,
      etichettaApp: game.i18n.localize(def.etichetta),
      nuovo: this.stato.modifica === "nuovo",
      campi: def.campi.map(c => ({
        chiave: c.chiave,
        etichetta: game.i18n.localize(c.etichetta),
        richiesto: !!c.richiesto,
        valore: esistente[c.chiave] ?? c.predefinito ?? "",
        eTesto: c.tipo === "text",
        eNumero: c.tipo === "number",
        eArea: c.tipo === "textarea",
        eSelect: c.tipo === "select",
        eCheck: c.tipo === "check",
        acceso: c.tipo === "check" && !!esistente[c.chiave],
        opzioni: (c.opzioni ?? []).map(o => ({
          valore: o.valore,
          etichetta: game.i18n.localize(o.etichetta),
          selezionato: (esistente[c.chiave] ?? c.predefinito) === o.valore
        }))
      }))
    };
  }

  /** App Store: si compra una volta, poi si installa e disinstalla a piacere. */
  #contestoAppStore() {
    const eddies = trovaEddies(this.attore);
    const possedute = appPossedute(this.attore);
    const installate = appInstallate(this.attore);

    const fascia = ["gratis", "pagamento"].includes(this.stato.fascia)
      ? this.stato.fascia
      : "tutte";
    const cerca = (this.stato.ricerca ?? "").trim().toLowerCase();

    const catalogo = Object.entries(APP_ACQUISTABILI)
      .filter(([, def]) => fascia === "tutte"
        || (fascia === "gratis" ? def.prezzo === 0 : def.prezzo > 0))
      .filter(([, def]) => !cerca
        || `${def.nome} ${def.produttore}`.toLowerCase().includes(cerca))
      .map(([chiave, def]) => ({
        chiave,
        nome: def.nome,
        produttore: def.produttore,
        icona: def.icona,
        prezzo: def.prezzo,
        gratuita: def.prezzo === 0,
        disponibilita: game.i18n.localize(def.disponibilita),
        descrizione: game.i18n.localize(def.descrizione),
        posseduta: possedute.includes(chiave),
        installata: installate.includes(chiave),
        // Un'App di serie sta in catalogo — e' li' che si legge cosa fa —
        // ma non ha tasti: non c'e' niente da comprare e niente da togliere.
        diSerie: !!def.diSerie,
        // Un'App che la mette il master resta in catalogo per la stessa
        // ragione, ma i tasti li vede solo lui.
        soloMaster: !!def.soloMaster && !game.user.isGM,
        troppoCara: eddies.valore !== null && def.prezzo > eddies.valore
      }));

    return {
      vistaAppStore: true,
      etichettaApp: game.i18n.localize("CPRX.AppStore"),
      iconaApp: APP.appstore.icona,
      eddies: eddies.valore,
      eddiesNoti: eddies.valore !== null,
      ricerca: this.stato.ricerca ?? "",
      fasce: [
        { chiave: "tutte", etichetta: game.i18n.localize("CPRX.FiltroTutte"), attiva: fascia === "tutte" },
        { chiave: "gratis", etichetta: game.i18n.localize("CPRX.StoreGratuite"), attiva: fascia === "gratis" },
        { chiave: "pagamento", etichetta: game.i18n.localize("CPRX.StoreAPagamento"), attiva: fascia === "pagamento" }
      ],
      vuoto: catalogo.length === 0,
      catalogo
    };
  }

  #contestoAppInstallata(chiave) {
    const def = APP_ACQUISTABILI[chiave];
    return {
      vistaInstallata: true,
      etichettaApp: def.nome,
      iconaApp: def.icona,
      produttore: def.produttore,
      descrizione: game.i18n.localize(def.descrizione),
      chiaveApp: chiave
    };
  }

  /**
   * Vetrina. Due schermate, non una sola piena di filtri: finche' non hai
   * scelto vedi il banco delle categorie, appena scegli vedi la merce con
   * una briciola in cima per tornare indietro. La ricerca sta sempre in
   * alto e funziona anche senza aver scelto niente — prima bisognava
   * aprire un menu a scomparsa per fare qualunque cosa.
   */
  async #contestoNegozio() {
    const eddies = trovaEddies(this.attore);
    const tutti = await catalogo();
    const cerca = (this.stato.ricerca ?? "").trim().toLowerCase();
    const categoria = this.stato.categoria ?? null;

    const conteggi = new Map();
    for (const a of tutti) conteggi.set(a.tipo, (conteggi.get(a.tipo) ?? 0) + 1);

    const categorie = [...conteggi.keys()].sort((a, b) => {
      const ia = ORDINE_TIPI.indexOf(a), ib = ORDINE_TIPI.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }).map(tipo => ({
      tipo,
      etichetta: etichettaTipo(tipo),
      conteggio: conteggi.get(tipo),
      attiva: categoria === tipo
    }));

    let articoli = categoria
      ? tutti.filter(a => a.tipo === categoria)
      : (cerca ? tutti : []);

    // Sottocategorie: si sceglie l'asse che divide meglio la categoria aperta.
    let sottocategorie = [];
    let campoSotto = null;

    if (categoria) {
      campoSotto = assePerCategoria(categoria, articoli);

      if (campoSotto) {
        const gruppi = new Map();
        for (const a of articoli) {
          const v = a.sotto?.[campoSotto];
          if (v) gruppi.set(v, (gruppi.get(v) ?? 0) + 1);
        }
        sottocategorie = [...gruppi.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([valore, conteggio]) => ({
            valore,
            etichetta: leggibile(valore),
            conteggio,
            attiva: this.stato.sotto === valore
          }));
      }
    }

    if (campoSotto && this.stato.sotto) {
      articoli = articoli.filter(a => a.sotto?.[campoSotto] === this.stato.sotto);
    }

    if (cerca) articoli = articoli.filter(a => a.nome.toLowerCase().includes(cerca));
    if (this.stato.soloAbbordabili && eddies.valore !== null) {
      articoli = articoli.filter(a => a.prezzo !== null && a.prezzo <= eddies.valore);
    }

    articoli = articoli.slice().sort((a, b) => (a.prezzo ?? Infinity) - (b.prezzo ?? Infinity));

    const totale = articoli.length;
    const limite = 80;

    return {
      vistaNegozio: true,
      etichettaApp: game.i18n.localize("CPRX.AppNegozio"),
      iconaApp: APP.negozio.icona,
      categorie,
      sottocategorie,
      haSotto: sottocategorie.length > 0,
      categoriaAperta: categoria ? etichettaTipo(categoria) : null,
      // Due schermate: il banco delle categorie, oppure la merce.
      alBanco: !categoria && !cerca,
      sottoAperta: this.stato.sotto ? leggibile(this.stato.sotto) : null,
      ricerca: this.stato.ricerca ?? "",
      soloAbbordabili: !!this.stato.soloAbbordabili,
      eddies: eddies.valore,
      eddiesNoti: eddies.valore !== null,
      quantiMostrati: Math.min(totale, limite),
      totale,
      articoli: articoli.slice(0, limite).map(a => ({
        ...a,
        etichettaTipo: etichettaTipo(a.tipo),
        prezzoTesto: a.prezzo === null ? "—" : `${a.prezzo} eb`,
        troppoCaro: eddies.valore !== null && a.prezzo !== null && a.prezzo > eddies.valore,
        acquistabile: a.prezzo !== null
      })),
      troncato: totale > limite,
      vuoto: totale === 0 && (!!categoria || !!cerca)
    };
  }

  #contestoImpostazioni() {
    const temaAttuale = game.settings.get(MODULO, "tema");
    return {
      vistaImpostazioni: true,
      temi: Object.entries(TEMI).map(([chiave, etichetta]) => ({
        chiave,
        etichetta: game.i18n.localize(etichetta),
        attivo: chiave === temaAttuale
      })),
      accento: game.settings.get(MODULO, "accento") ?? "",
      handle: this.attore.getFlag(MODULO, "handle") ?? "",
      nomeVero: this.attore.getFlag(MODULO, "nomeVero") ?? "",
      // Due caselle e un interruttore: l'Agent ti chiama con l'una o con
      // l'altra. Non c'e' piu' un terzo nome da inventare.
      salutoHandle: salutoCon(this.attore) === "handle",
      numero: numeroDi(this.attore),
      // La scheda d'identita' in cima: chi sei e su che linea, come sul
      // telefono vero. Non e' un dato nuovo — e' quello che gia' si legge
      // sparso fra il quadro e la pagina di sistema, messo dove si va a
      // cercarlo.
      iniziale: iniziali(this.appellativo),
      identitaNome: this.appellativo,
      identitaRiga: `${this.#modelloAgent()} · ${numeroDi(this.attore)}`,
      agentInterno: !!this.attore.getFlag(MODULO, "agentInterno"),
      gps: !!this.attore.getFlag(MODULO, "gps"),

      // Lo sfondo. La prima tessera e' «nessuno»: senza, l'unico modo di
      // tornare al fondo del tema sarebbe non averne mai scelto uno.
      sfondoScelto: sfondoDi(this.attore),
      sfondoNome: SFONDI.find(s => s.chiave === sfondoDi(this.attore))?.etichetta
        ?? game.i18n.localize("CPRX.SfondoNessuno"),
      sfondi: [
        {
          chiave: "",
          etichetta: game.i18n.localize("CPRX.SfondoNessuno"),
          url: "",
          scelto: sfondoDi(this.attore) === ""
        },
        ...SFONDI.map(s => ({
          chiave: s.chiave,
          etichetta: s.etichetta,
          url: percorsoSfondo(s.chiave),
          scelto: s.chiave === sfondoDi(this.attore)
        }))
      ]
    };
  }

  /* ---------------------------------------------------------------- */
  /* Presentazione                                                     */
  /* ---------------------------------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#applicaTema();

    if (!this._avviato) {
      this._avviato = true;
      this.element.classList.add("in-avvio");
      window.setTimeout(() => this.element?.classList.remove("in-avvio"), 800);
    }

    this.#avviaOrologio();
    this.#agganciaTrascinamento();

    // Scorrimento conservato: dopo un acquisto la lista deve restare dov'era.
    // Sulla home scorre la pagina attiva, non il contenitore che le tiene
    // affiancate — quello si muove in orizzontale e non scorre mai.
    const schermo = this.element.querySelector(".agent-pagina.attiva")
      ?? this.element.querySelector(".agent-schermo");
    if (schermo) {
      schermo.scrollTop = this._scorrimento ?? 0;
      schermo.addEventListener("scroll", () => { this._scorrimento = schermo.scrollTop; });
    }

    // Le frecce cambiano pagina solo mentre la home e' aperta: dentro un'App
    // non devono fare niente, nemmeno un ridisegno a vuoto.
    if (context.vistaHome) this.#agganciaScorrimentoPagine();
    else this.#staccaTasti();

    const ricerca = this.element.querySelector('[name="ricerca"]');
    if (ricerca) {
      ricerca.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter") return;
        evento.preventDefault();
        this.stato.ricerca = ricerca.value;
        this._scorrimento = 0;
        this.render();
      });
    }

    // Filo dei messaggi: Invio manda, Maiusc+Invio va a capo, e il filo si
    // apre gia' in fondo, sull'ultimo messaggio arrivato.
    const testo = this.element.querySelector('[name="testo"]');
    if (testo && context.vistaConversazione) {
      testo.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter" || evento.shiftKey) return;
        evento.preventDefault();
        Agent.#onInviaSms.call(this);
      });
      if (schermo) {
        schermo.scrollTop = schermo.scrollHeight;
        this._scorrimento = schermo.scrollTop;
      }
    }

    // Il cronometro serve anche alla striscia del secondo piano: li' la
    // chiamata e' aperta per definizione, quindi `inCorso` e' vero.
    this.#avviaCronometro(
      context.vistaChiamata ? context.chiamata
        : (context.chiamataBarra ? { inCorso: true, rispostaQuando: chiamataCorrente(this.attore)?.rispostaQuando, scadeFra: 0 } : null));
  }

  _onClose(options) {
    this.#fermaOrologio();
    this.#fermaCronometro();
    this.#staccaTasti();
    this.#staccaTrascinamento();
    this._avviato = false;
    // Chiudere la finestra e' mettere via il telefono: si riblocca.
    this._sbloccato = false;
    super._onClose?.(options);
  }

  /**
   * Senza cornice, il manico lo fa la targhetta. Il movimento si scrive con
   * `setPosition()`, che funziona anche a finestra senza cornice, e gli
   * ascoltatori stanno su `window` — quindi vanno staccati, altrimenti
   * restano appesi come quelli delle frecce (trappola 19).
   *
   * Il tasto di chiusura sta dentro la targhetta e non deve trascinare: un
   * `closest("button")` lo esclude.
   */
  #agganciaTrascinamento() {
    this.#staccaTrascinamento();

    const manico = this.element?.querySelector("[data-manico]");
    if (!manico) return;

    const parti = (evento) => {
      if (evento.button !== 0 || evento.target.closest("button")) return;
      evento.preventDefault();
      this.bringToFront();

      const inizio = {
        x: evento.clientX,
        y: evento.clientY,
        left: this.position.left,
        top: this.position.top
      };

      const muovi = (e) => this.setPosition({
        left: inizio.left + (e.clientX - inizio.x),
        top: inizio.top + (e.clientY - inizio.y)
      });

      const molla = () => {
        window.removeEventListener("pointermove", muovi);
        window.removeEventListener("pointerup", molla);
      };

      window.addEventListener("pointermove", muovi);
      window.addEventListener("pointerup", molla);
    };

    // Cliccare in un punto qualunque del telefono lo porta davanti: senza
    // cornice non lo fa piu' Foundry.
    const davanti = () => this.bringToFront();

    manico.addEventListener("pointerdown", parti);
    this.element.addEventListener("pointerdown", davanti);

    this._staccaTrascinamento = () => {
      manico.removeEventListener("pointerdown", parti);
      this.element?.removeEventListener("pointerdown", davanti);
    };
  }

  #staccaTrascinamento() {
    this._staccaTrascinamento?.();
    this._staccaTrascinamento = null;
  }

  /**
   * La home scorre di lato: frecce da tastiera e trascinamento.
   *
   * Durante il trascinamento la trasformazione si scrive direttamente sul
   * nodo, senza ridisegnare: un render per movimento del dito rileggerebbe
   * tutto il filo, e comunque perderebbe il gesto a meta'. Il ridisegno
   * arriva una volta sola, quando si lascia.
   */
  #agganciaScorrimentoPagine() {
    const pista = this.element.querySelector("[data-pista]");
    if (!pista) return;

    const passo = 100 / PAGINE_HOME;
    const posa = (px) => {
      pista.style.transition = px === null ? "" : "none";
      pista.style.transform = px === null
        ? `translateX(-${this._pagina * passo}%)`
        : `translateX(calc(-${this._pagina * passo}% + ${px}px))`;
    };

    let x0 = 0, y0 = 0, asse = null, dx = 0, preso = false;

    pista.addEventListener("pointerdown", (e) => {
      // Solo il tasto sinistro, e mai partendo da un comando: il tocco su
      // un'icona deve restare un clic.
      if (e.button !== 0 || e.target.closest("button, input, textarea, select, a")) return;
      x0 = e.clientX; y0 = e.clientY; asse = null; dx = 0; preso = true;
      try { pista.setPointerCapture(e.pointerId); } catch (errore) { /* senza cattura va uguale */ }
    });

    pista.addEventListener("pointermove", (e) => {
      if (!preso) return;
      const ddx = e.clientX - x0;
      const ddy = e.clientY - y0;

      // Finche' non e' chiaro se il gesto e' orizzontale o verticale non si
      // muove niente: altrimenti si ruba lo scorrimento dell'elenco.
      if (!asse && (Math.abs(ddx) > 6 || Math.abs(ddy) > 6)) {
        asse = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
      }
      if (asse !== "x") return;

      // Ai due capi il trascinamento fa resistenza invece di staccarsi.
      const capo = (this._pagina === 0 && ddx > 0) || (this._pagina === PAGINE_HOME - 1 && ddx < 0);
      dx = capo ? ddx * 0.28 : ddx;
      posa(dx);
    });

    const lascia = () => {
      if (!preso) return;
      preso = false;
      const scelta = dx < -60 ? this._pagina + 1 : (dx > 60 ? this._pagina - 1 : this._pagina);
      posa(null);
      dx = 0;
      this.#vaiPagina(scelta);
    };

    pista.addEventListener("pointerup", lascia);
    pista.addEventListener("pointercancel", lascia);

    this.#staccaTasti();
    this._tasti = (e) => {
      if (ui.activeWindow !== this) return;
      if (e.target?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") this.#vaiPagina(this._pagina + 1);
      else if (e.key === "ArrowLeft") this.#vaiPagina(this._pagina - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", this._tasti);
  }

  #staccaTasti() {
    if (this._tasti) window.removeEventListener("keydown", this._tasti);
    this._tasti = null;
  }

  /**
   * Durante una chiamata il secondo scorre nel DOM, senza ridisegnare: un
   * render al secondo rileggerebbe tutto il registro dei messaggi. Uno
   * squillo, invece, si spegne da solo, quindi basta un ridisegno a scadenza.
   */
  #avviaCronometro(chiamata) {
    this.#fermaCronometro();
    if (!chiamata) return;

    if (chiamata.inCorso && chiamata.rispostaQuando) {
      // I punti da scrivere sono due — la schermata di chiamata e la
      // striscia del secondo piano — e non ci sono mai tutti e due insieme.
      // `querySelectorAll` come per gli orologi: con `querySelector` la
      // striscia resterebbe ferma sul primo valore.
      const scrivi = () => {
        const campi = this.element?.querySelectorAll("[data-durata]");
        if (!campi?.length) return;
        const secondi = Math.floor((Date.now() - chiamata.rispostaQuando) / 1000);
        const testo =
          `${String(Math.floor(secondi / 60)).padStart(2, "0")}:${String(secondi % 60).padStart(2, "0")}`;
        for (const campo of campi) campo.textContent = testo;
      };
      scrivi();
      this._cronometro = window.setInterval(scrivi, 1000);
      return;
    }

    if (chiamata.scadeFra > 0) {
      this._cronometro = window.setTimeout(() => this.render(), chiamata.scadeFra + 250);
    }
  }

  #fermaCronometro() {
    if (this._cronometro) {
      window.clearInterval(this._cronometro);
      window.clearTimeout(this._cronometro);
    }
    this._cronometro = null;
  }

  #applicaTema() {
    applicaTemaA(this.element);
  }

  /**
   * Gli orologi sono due — quello della barra di stato e quello grande del
   * quadro — e vanno scritti tutti e due: con `querySelector` il secondo
   * restava fermo su `--:--` per sempre.
   */
  #avviaOrologio() {
    this.#fermaOrologio();
    const scrivi = () => {
      const campi = this.element?.querySelectorAll("[data-orologio]");
      if (!campi?.length) return;
      const ora = new Date();
      const testo =
        `${String(ora.getHours()).padStart(2, "0")}:${String(ora.getMinutes()).padStart(2, "0")}`;
      for (const campo of campi) campo.textContent = testo;
    };
    scrivi();
    this._orologio = window.setInterval(scrivi, 15000);
  }

  #fermaOrologio() {
    if (this._orologio) window.clearInterval(this._orologio);
    this._orologio = null;
  }

  /* ---------------------------------------------------------------- */
  /* Navigazione                                                       */
  /* ---------------------------------------------------------------- */

  #vai(app, extra = {}) {
    this.stato = { app, modifica: null, ...extra };
    this._scorrimento = 0;
    this._compositore = false;
    this.render();
  }

  // `data-scheda` porta dritto a una linguetta di Phone: serve alle notifiche
  // delle chiamate perse e alle tessere del dock.
  static #onApriApp(event, target) {
    const extra = target.dataset.scheda ? { telefonoScheda: target.dataset.scheda } : {};
    this.#vai(target.dataset.app, extra);
    if (extra.telefonoScheda === "recenti") this.#segnaChiamateViste();
  }

  static #onHome() { this.#vai(null); }

  static #onTelefonoScheda(event, target) {
    this.stato.telefonoScheda = target.dataset.scheda;
    // Toccare una linguetta chiude la scheda di un contatto: la scheda sta
    // *sopra* le liste, non accanto, e restare aperti su un contatto mentre
    // in fondo si accende «recenti» non vorrebbe dire niente.
    this.stato.contattoNumero = null;
    this._scorrimento = 0;
    if (this.stato.telefonoScheda === "recenti") this.#segnaChiamateViste();
    this.render();
  }

  /** La scheda di un contatto: si apre da un numero, e da qualunque lista. */
  /** Le tre pillole dell'App Store: tutte, gratuite, a pagamento. */
  static #onFasciaStore(event, target) {
    this.stato = { ...this.stato, fascia: target.dataset.fascia };
    this._scorrimento = 0;
    this.render();
  }

  /** Le tre pillole sopra i movimenti: tutti, solo entrate, solo uscite. */
  static #onFiltroBanca(event, target) {
    this.stato = { ...this.stato, filtroBanca: target.dataset.filtro };
    this._scorrimento = 0;
    this.render();
  }

  /**
   * I quattro tasti sotto la carta. Ognuno apre un pannello e nessuno e'
   * finto: mandare, chiedere, guardare i dati della carta. Premuto due
   * volte richiude — sono interruttori, non pagine.
   */
  static #onBancaPannello(event, target) {
    const quale = target.dataset.pannello;
    this.stato = {
      ...this.stato,
      bancaModulo: this.stato.bancaModulo === quale ? "" : quale
    };
    this.render();
  }

  /**
   * «Richiedi»: non muove soldi, manda un messaggio. E' l'unico modo
   * onesto — chiedere dei soldi a qualcuno non e' una transazione, e'
   * una richiesta, e chi la riceve decide.
   */
  static async #onBancaRichiedi() {
    if (!this.puoScrivere) return;

    const quanto = Math.floor(Number(this.element.querySelector('[name="importo"]')?.value ?? 0));
    const numero = this.element.querySelector('[name="bersaglio"]')?.value ?? "";
    const causale = (this.element.querySelector('[name="causale"]')?.value ?? "").trim();

    if (!Number.isFinite(quanto) || quanto <= 0) {
      ui.notifications.warn(game.i18n.localize("CPRX.BancaImportoNonValido"));
      return;
    }

    const rotta = await this.#rotta(numero);
    if (!rotta) return;

    await invia({
      tipo: TIPO.SMS,
      da: rotta.mio,
      a: rotta.altro,
      daAttore: this.attore,
      aAttore: rotta.attoreAltro,
      aMaster: !!rotta.aMaster,
      testo: game.i18n.format("CPRX.BancaRichiestaTesto", {
        quanto,
        causale: causale || game.i18n.localize("CPRX.BancaSenzaCausale")
      })
    });

    this.stato = { ...this.stato, bancaModulo: "", bersaglio: "" };
    ui.notifications.info(game.i18n.format("CPRX.BancaRichiestaMandata", { quanto }));
    this.render();
  }

  /** Le due pillole sopra gli incarichi: aperti, o gia' chiusi. */
  static #onFiltroGig(event, target) {
    this.stato = { ...this.stato, filtroGig: target.dataset.filtro };
    this._scorrimento = 0;
    this.render();
  }

  /** Le due pillole sopra l'elenco dei messaggi: tutte, o solo le nuove. */
  static #onFiltroMsg(event, target) {
    this.stato = { ...this.stato, filtroMsg: target.dataset.filtro };
    this._scorrimento = 0;
    this.render();
  }

  /** Il tasto in fondo ai messaggi: apre e chiude il campo del numero nuovo. */
  static #onCompositore() {
    this._compositore = !this._compositore;
    this.render();
  }

  /**
   * Lo sfondo. Sta sull'attore e non nelle impostazioni client: il tema e'
   * il gusto di chi ha il monitor davanti, lo sfondo e' il telefono di un
   * personaggio — e due personaggi dello stesso giocatore ne hanno due.
   */
  static async #onSfondo(event, target) {
    if (!this.puoScrivere) return;
    await this.attore.setFlag(MODULO, "sfondo", target.dataset.sfondo ?? "");
    this.render();
  }

  static #onApriContatto(event, target) {
    const numero = normalizzaNumero(target.dataset.numero ?? "");
    if (!numero) return;
    this.stato = { ...this.stato, app: "telefono", contattoNumero: numero };
    this._scorrimento = 0;
    this.render();
  }

  static #onChiudiContatto() {
    this.stato = { ...this.stato, contattoNumero: null };
    this._scorrimento = 0;
    this.render();
  }

  /**
   * La stella. Vale solo su chi e' gia' in rubrica: un preferito e' un
   * contatto marcato, non una seconda lista con dentro dei numeri.
   */
  static async #onPreferito(event, target) {
    if (!this.attore?.isOwner) return;

    const numero = normalizzaNumero(target.dataset.numero ?? "");
    const voci = leggiVoci(this.attore, "contatti");
    const voce = voci.find(v => v.numero && normalizzaNumero(v.numero) === numero);
    if (!voce) return;

    await scriviVoci(this.attore, "contatti",
      voci.map(v => (v === voce ? { ...v, preferito: !v.preferito } : v)));
    this.render();
  }

  /** Aprire i recenti spegne il pallino delle perse. */
  async #segnaChiamateViste() {
    if (!this.attore?.isOwner) return;
    await this.attore.setFlag(MODULO, "chiamateViste", Date.now());
  }

  /** L'impronta. Il blocco torna da solo alla chiusura della finestra. */
  static #onSblocca() {
    this._sbloccato = true;
    this.element?.classList.add("in-sblocco");
    window.setTimeout(() => this.element?.classList.remove("in-sblocco"), 420);
    this.render();
  }

  /**
   * Rimettere il telefono in tasca senza chiudere la finestra. Riporta
   * anche alla prima pagina: riaprendolo si riparte dal quadro, come su un
   * telefono vero.
   */
  static #onBlocca() {
    this._sbloccato = false;
    this._pagina = 0;
    this.stato = { ...this.stato, app: null };
    this.render();
  }

  /** I pallini e le frecce: la home scorre, non cambia vista. */
  static #onPagina(event, target) { this.#vaiPagina(Number(target.dataset.pagina)); }

  #vaiPagina(indice) {
    const p = Math.min(PAGINE_HOME - 1, Math.max(0, Number.isFinite(indice) ? indice : 0));
    if (p === this._pagina) return;
    this._pagina = p;
    this._scorrimento = 0;
    this.render();
  }
  static #onImpostazioni() { this.#vai("impostazioni"); }

  // `data-app` apre il modulo di un'altra App: serve alla rubrica, che vive
  // dentro Phone e non ha un elenco suo da cui partire.
  static #onNuovo(event, target) {
    if (!this.puoScrivere) return;
    const app = target?.dataset?.app;
    if (app && app !== this.stato.app) this.stato = { app, modifica: "nuovo" };
    else this.stato.modifica = "nuovo";
    this.render();
  }

  /**
   * Il modulo mostra i campi per esteso, numero compreso: un contatto coperto
   * — quelli salvati prima che la copertura tenesse — non si apre.
   */
  static #onModifica(event, target) {
    const app = target.dataset.app || this.stato.app;
    const voce = leggiVoci(this.attore, app).find(v => v.id === target.dataset.id);
    if (app === "contatti" && this.#coperto(voce?.numero)) {
      ui.notifications.warn(game.i18n.localize("CPRX.ContattoCoperto"));
      return;
    }

    if (app !== this.stato.app) this.stato = { app, modifica: target.dataset.id };
    else this.stato.modifica = target.dataset.id;
    this.render();
  }

  static #onAnnulla() {
    if (this.#tornaDentro()) return;
    this.stato.modifica = null;
    this.render();
  }

  /**
   * Chiudere il modulo di un'App che vive dentro un'altra riporta li', non a
   * un elenco che non esiste: la rubrica sta dentro Phone.
   */
  #tornaDentro() {
    const dentro = APP[this.stato.app]?.dentro;
    if (!dentro) return false;
    this.#vai(dentro, { telefonoScheda: "contatti" });
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Vetrina                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Un `data-tipo` vuoto e' il tasto "torna al banco": svuota anche la
   * ricerca, altrimenti resteresti in vetrina senza capire perche'.
   */
  static #onScegliCategoria(event, target) {
    const tipo = target.dataset.tipo || "";
    if (!tipo) {
      this.stato.categoria = null;
      this.stato.sotto = null;
      this.stato.ricerca = "";
    } else {
      this.stato.categoria = this.stato.categoria === tipo ? null : tipo;
      this.stato.sotto = null;
    }
    this._scorrimento = 0;
    this.render();
  }

  static #onScegliSotto(event, target) {
    const valore = target.dataset.sotto || "";
    this.stato.sotto = (!valore || this.stato.sotto === valore) ? null : valore;
    this._scorrimento = 0;
    this.render();
  }

  static #onCerca() {
    const campo = this.element.querySelector('[name="ricerca"]');
    this.stato.ricerca = campo?.value ?? "";
    this._scorrimento = 0;
    this.render();
  }

  static #onAbbordabili(event, target) {
    // Due pillole, non un interruttore: `data-tutti` e' quella che spegne.
    this.stato.soloAbbordabili = !target.dataset.tutti;
    this.render();
  }

  /**
   * Acquisto di un oggetto. Soldi e oggetto non sono un'operazione atomica:
   * se la creazione fallisce, i soldi tornano indietro.
   */
  static async #onCompra(event, target) {
    if (!this.puoScrivere) return;

    const documento = await fromUuid(target.dataset.uuid);
    if (!documento) {
      ui.notifications.error(game.i18n.localize("CPRX.OggettoIntrovabile"));
      return;
    }

    const prezzo = prezzoDi(documento) ?? 0;
    const eddies = trovaEddies(this.attore);

    if (eddies.valore === null) {
      ui.notifications.error(game.i18n.localize("CPRX.EddiesNonTrovati"));
      return;
    }
    if (prezzo > eddies.valore) {
      ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
      return;
    }

    const conferma = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.ConfermaAcquistoTitolo"),
      game.i18n.format("CPRX.ConfermaAcquistoTesto", {
        oggetto: documento.name, prezzo, residuo: eddies.valore - prezzo
      })
    );
    if (!conferma) return;

    if (!(await paga(this.attore, prezzo))) {
      ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
      return;
    }

    try {
      await this.attore.createEmbeddedDocuments("Item", [documento.toObject()]);
    } catch (errore) {
      await paga(this.attore, -prezzo);
      console.error("cprx-agent | acquisto fallito, soldi restituiti:", errore);
      ui.notifications.error(game.i18n.localize("CPRX.AcquistoFallito"));
      return;
    }

    ui.notifications.info(game.i18n.format("CPRX.Acquistato", { oggetto: documento.name }));
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* App Store                                                         */
  /* ---------------------------------------------------------------- */

  static async #onCompraApp(event, target) {
    if (!this.puoScrivere) return;

    const chiave = target.dataset.chiave;
    const def = APP_ACQUISTABILI[chiave];
    if (!def) return;

    // Un'App fornita dall'azienda la scarica il datore di lavoro, e al
    // tavolo il datore di lavoro e' il master. Il tasto non c'e' nemmeno,
    // ma da macro ci si arriva.
    if (def.soloMaster && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("CPRX.StoreSoloMaster"));
      return;
    }

    const possedute = appPossedute(this.attore);
    if (possedute.includes(chiave)) {
      ui.notifications.info(game.i18n.localize("CPRX.AppGiaPosseduta"));
      return;
    }

    const eddies = trovaEddies(this.attore);
    if (eddies.valore === null) {
      ui.notifications.error(game.i18n.localize("CPRX.EddiesNonTrovati"));
      return;
    }
    if (def.prezzo > eddies.valore) {
      ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
      return;
    }

    const conferma = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.ConfermaAcquistoTitolo"),
      game.i18n.format("CPRX.ConfermaAcquistoTesto", {
        oggetto: def.nome, prezzo: def.prezzo, residuo: eddies.valore - def.prezzo
      })
    );
    if (!conferma) return;

    if (!(await paga(this.attore, def.prezzo))) {
      ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
      return;
    }

    // Comprata una volta: resta di proprieta' anche se poi la disinstalli.
    await this.attore.setFlag(MODULO, "appPossedute", [...possedute, chiave]);
    await this.attore.setFlag(MODULO, "appInstallate",
      [...new Set([...appInstallate(this.attore), chiave])]);

    ui.notifications.info(game.i18n.format("CPRX.Acquistato", { oggetto: def.nome }));
    this.render();
  }

  static async #onInstallaApp(event, target) {
    if (!this.puoScrivere) return;
    const chiave = target.dataset.chiave;
    if (!appPossedute(this.attore).includes(chiave)) return;

    await this.attore.setFlag(MODULO, "appInstallate",
      [...new Set([...appInstallate(this.attore), chiave])]);
    this.render();
  }

  static async #onDisinstallaApp(event, target) {
    if (!this.puoScrivere) return;
    const chiave = target.dataset.chiave;
    // Un'App di serie non si toglie: il tasto non c'e', ma da macro ci si
    // arriva comunque, e il flag ripulito non cambierebbe niente.
    if (APP_DI_SERIE.includes(chiave)) return;
    // E quella che mette il datore di lavoro non se la toglie il dipendente.
    if (APP_ACQUISTABILI[chiave]?.soloMaster && !game.user.isGM) return;

    await this.attore.setFlag(MODULO, "appInstallate",
      appInstallate(this.attore).filter(c => c !== chiave));

    if (this.stato.app === chiave) this.#vai(null);
    else this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Rete: messaggi e chiamate                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Controlli comuni a tutto cio' che esce dall'Agent: chi scrive, da quale
   * numero, verso quale numero. Restituisce null e avvisa se qualcosa manca.
   */
  async #rotta(numeroAltro) {
    if (!this.puoScrivere) return null;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return null;

    const altro = normalizzaNumero(numeroAltro);
    if (!altro) {
      ui.notifications.warn(game.i18n.localize("CPRX.NumeroNonValido"));
      return null;
    }
    if (altro === mio) {
      ui.notifications.warn(game.i18n.localize("CPRX.NumeroTuo"));
      return null;
    }

    // Il numero libero del master non ha una scheda dietro: la sua posta la
    // archivia il postino nell'impostazione di mondo, non su un attore.
    if (altro === normalizzaNumero(identitaMaster().numero)) {
      return { mio, altro, attoreAltro: null, aMaster: true };
    }

    const attoreAltro = attorePerNumero(altro);
    if (!attoreAltro) {
      ui.notifications.warn(game.i18n.format("CPRX.NumeroInesistente", { numero: altro }));
      return null;
    }

    return { mio, altro, attoreAltro };
  }

  static async #onApriConversazione(event, target) {
    const grezzo = target.dataset.numero || "";

    // Un gruppo si indirizza con la sua chiave, che numero non e' e da
    // normalizzare non c'e' niente.
    if (eChiaveGruppo(grezzo)) {
      this.stato = { app: "messaggi", modifica: null, conversazione: grezzo };
      this._scorrimento = 0;
      await segnaLetta(this.attore, grezzo);
      this.render();
      return;
    }

    const digitato = this.element.querySelector('[name="composto"]')?.value;
    const numero = normalizzaNumero(grezzo || digitato || "");
    if (!numero) {
      ui.notifications.warn(game.i18n.localize("CPRX.NumeroNonValido"));
      return;
    }

    this.stato = { app: "messaggi", modifica: null, conversazione: numero };
    this._scorrimento = 0;
    await segnaLetta(this.attore, numero);
    this.render();
  }

  static async #onInviaSms() {
    const campo = this.element.querySelector('[name="testo"]');
    const testo = (campo?.value ?? "").trim();
    if (!testo) return;

    if (eChiaveGruppo(this.stato.conversazione)) {
      if (!(await this.#scriviAlGruppo(this.stato.conversazione, testo))) return;
      campo.value = "";
      this.render();
      return;
    }

    const rotta = await this.#rotta(this.stato.conversazione);
    if (!rotta) return;

    campo.value = "";
    await invia({
      tipo: TIPO.SMS,
      testo,
      da: rotta.mio,
      a: rotta.altro,
      daAttore: this.attore,
      aAttore: rotta.attoreAltro,
      aMaster: !!rotta.aMaster
    });
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Gruppi                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Una busta sola per tutto il gruppo: il postino ne scrive una copia sulla
   * scheda di ognuno. Mandare N buste separate avrebbe fatto N fili, che e'
   * l'altra cosa — quella la fa il master con «manda a ognuno».
   */
  async #scriviAlGruppo(chiave, testo) {
    if (!this.puoScrivere) return false;

    const conversazione = conversazioni(this.attore).find(c => c.chiave === chiave);
    if (!conversazione?.gruppo) return false;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return false;

    return spedisciAlGruppo({
      idGruppo: conversazione.idGruppo,
      nomeGruppo: conversazione.nomeGruppo,
      membri: conversazione.membri,
      testo,
      da: mio,
      daAttore: this.attore
    });
  }

  static #onGruppoNuovo() {
    if (!this.puoScrivere) return;
    this.stato = { app: "messaggi", modifica: null, conversazione: null, nuovoGruppo: true };
    this._scorrimento = 0;
    this.render();
  }

  static #onGruppoAnnulla() {
    this.stato = { app: "messaggi", modifica: null, conversazione: null };
    this._scorrimento = 0;
    this.render();
  }

  /**
   * Crea il gruppo e ci manda dentro la prima riga. Le due cose stanno
   * insieme perche' un gruppo senza messaggi non esiste: non c'e' nessun
   * registro dei gruppi, ci sono le voci che li nominano.
   */
  static async #onGruppoCrea() {
    if (!this.puoScrivere) return;

    const nome = (this.element.querySelector('[name="gruppoNome"]')?.value ?? "").trim();
    const testo = (this.element.querySelector('[name="gruppoTesto"]')?.value ?? "").trim();
    if (!testo) {
      ui.notifications.warn(game.i18n.localize("CPRX.GruppoSenzaTesto"));
      return;
    }

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    const scelti = [...this.element.querySelectorAll('[name^="gruppoM-"]')]
      .filter(c => c.checked)
      .map(c => normalizzaNumero(c.name.slice("gruppoM-".length)));

    const sciolti = (this.element.querySelector('[name="gruppoNumeri"]')?.value ?? "")
      .split(/[,;\s]+/)
      .map(n => normalizzaNumero(n))
      .filter(Boolean);

    const altri = [...new Set([...scelti, ...sciolti])].filter(n => n && n !== mio);
    if (altri.length < 2) {
      ui.notifications.warn(game.i18n.localize("CPRX.GruppoPochiMembri"));
      return;
    }

    // Verso qualcuno di questi nascondo il numero: nel gruppo si vedrebbe.
    const nascosti = altri.filter(n => nascondoCon(this.attore, n));
    if (nascosti.length) {
      ui.notifications.warn(game.i18n.localize("CPRX.GruppoNienteCoperti"));
      return;
    }

    const idGruppo = foundry.utils.randomID();
    const fatto = await spedisciAlGruppo({
      idGruppo,
      nomeGruppo: nome,
      membri: [mio, ...altri],
      testo,
      da: mio,
      daAttore: this.attore
    });
    if (!fatto) return;

    this.stato = { app: "messaggi", modifica: null, conversazione: chiaveGruppo(idGruppo) };
    this._scorrimento = 0;
    this.render();
  }

  /**
   * Uscire da un gruppo e' mandare una riga con l'elenco accorciato: da li'
   * in poi le voci nuove non ti nominano piu' e non ti arrivano. Quelle
   * vecchie restano sulla tua scheda, come in un telefono vero — per
   * toglierle c'e' «cancella chat».
   */
  static async #onGruppoEsci() {
    if (!this.puoScrivere) return;

    const chiave = this.stato.conversazione;
    const conversazione = conversazioni(this.attore).find(c => c.chiave === chiave);
    if (!conversazione?.gruppo) return;

    const conferma = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.GruppoEsci"),
      game.i18n.localize("CPRX.GruppoEsciTesto")
    );
    if (!conferma) return;

    const mio = numeroDi(this.attore);
    const restano = conversazione.membri.filter(n => n !== mio);

    await spedisciAlGruppo({
      idGruppo: conversazione.idGruppo,
      nomeGruppo: conversazione.nomeGruppo,
      membri: restano,
      testo: game.i18n.format("CPRX.GruppoUscito", { nome: identita(this.attore).handle }),
      da: mio,
      daAttore: this.attore
    });

    this.#vai("messaggi");
  }

  /**
   * Tastierino: le cifre si accumulano in `composto`, senza toccare i flag.
   * Si rilegge sempre il campo prima, altrimenti un numero scritto a mano
   * verrebbe cancellato dal primo tasto premuto.
   */
  static #onCifra(event, target) {
    const attuale = this.element.querySelector('[name="composto"]')?.value ?? this.stato.composto ?? "";
    this.stato.composto = `${attuale}${target.dataset.cifra}`.slice(0, 12);
    this.render();
  }

  static #onCancellaCifra() {
    const attuale = this.element.querySelector('[name="composto"]')?.value ?? this.stato.composto ?? "";
    this.stato.composto = attuale.slice(0, -1);
    this.render();
  }

  static async #onChiama(event, target) {
    const digitato = this.element.querySelector('[name="composto"]')?.value;
    const rotta = await this.#rotta(target.dataset.numero ?? digitato ?? this.stato.composto ?? "");
    if (!rotta) return;

    await spedisciChiamata({
      idChiamata: foundry.utils.randomID(),
      stato: "squilla",
      membri: [rotta.mio, rotta.altro],
      da: rotta.mio,
      daAttore: this.attore
    });

    this.stato.composto = "";
    this._chiamataSfondo = null;
    this.render();
  }

  /** Chiama tutti quelli di una chat di gruppo, in un colpo solo. */
  static async #onGruppoChiama() {
    if (!this.puoScrivere) return;

    const conversazione = conversazioni(this.attore)
      .find(c => c.chiave === this.stato.conversazione);
    if (!conversazione?.gruppo) return;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    const fatto = await spedisciChiamata({
      idChiamata: foundry.utils.randomID(),
      stato: "squilla",
      membri: conversazione.membri,
      da: mio,
      daAttore: this.attore,
      idGruppo: conversazione.idGruppo,
      nomeGruppo: conversazione.nomeGruppo
    });
    if (!fatto) {
      ui.notifications.warn(game.i18n.localize("CPRX.GruppoPochiMembri"));
      return;
    }

    this._chiamataSfondo = null;
    this.render();
  }

  static async #onRispondiChiamata() {
    const chiamata = chiamataCorrente(this.attore);
    if (!chiamata?.inArrivo) return;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    await spedisciChiamata({
      idChiamata: chiamata.idChiamata,
      stato: "risposta",
      membri: chiamata.membri,
      da: mio,
      daAttore: this.attore,
      idGruppo: chiamata.idGruppo,
      nomeGruppo: chiamata.nomeGruppo
    });
    this._chiamataSfondo = null;
    this.render();
  }

  /**
   * Riaggancia, rifiuta o annulla: dipende da dove sta la chiamata. In un
   * gruppo chiude **solo per me** — gli altri restano in linea, e la
   * chiamata finisce quando non ne resta nessuno.
   */
  static async #onChiudiChiamata() {
    const chiamata = chiamataCorrente(this.attore);
    if (!chiamata) return;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    const secondi = chiamata.rispostaQuando
      ? Math.round((Date.now() - chiamata.rispostaQuando) / 1000)
      : 0;

    await spedisciChiamata({
      idChiamata: chiamata.idChiamata,
      stato: chiamata.mioStato === "squilla"
        ? (chiamata.inArrivo ? "rifiuto" : "persa")
        : "chiusa",
      membri: chiamata.membri,
      da: mio,
      daAttore: this.attore,
      idGruppo: chiamata.idGruppo,
      nomeGruppo: chiamata.nomeGruppo,
      durata: `${String(Math.floor(secondi / 60)).padStart(2, "0")}:${String(secondi % 60).padStart(2, "0")}`
    });

    this._chiamataSfondo = null;
    this.stato.chiamataAggiungi = false;
    this.render();
  }

  /* --- chiamate: aggiungere gente e mandarle in secondo piano --- */

  static #onChiamataAggiungi() {
    this.stato.chiamataAggiungi = !this.stato.chiamataAggiungi;
    this.render();
  }

  /**
   * Aggiunge qualcuno a una chiamata gia' aperta: parte una voce con
   * l'elenco dei membri allargato, e da li' in poi e' quello che vale.
   */
  static async #onChiamataInvita() {
    const chiamata = chiamataCorrente(this.attore);
    if (!chiamata) return;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    const spuntati = [...this.element.querySelectorAll('[name^="invita-"]')]
      .filter(c => c.checked)
      .map(c => normalizzaNumero(c.name.slice("invita-".length)));

    const scritti = (this.element.querySelector('[name="invitaNumeri"]')?.value ?? "")
      .split(/[,;\s]+/)
      .map(n => normalizzaNumero(n))
      .filter(Boolean);

    const nuovi = [...new Set([...spuntati, ...scritti])]
      .filter(n => n && !chiamata.membri.includes(n));

    if (!nuovi.length) {
      ui.notifications.warn(game.i18n.localize("CPRX.ChiamataNessunInvitato"));
      return;
    }

    // Chi nasconde il numero verso qualcuno non se lo puo' portare in
    // chiamata di gruppo: li' dentro il numero si vede, come nei gruppi.
    if (nuovi.some(n => nascondoCon(this.attore, n))) {
      ui.notifications.warn(game.i18n.localize("CPRX.GruppoNienteCoperti"));
      return;
    }

    await spedisciChiamata({
      idChiamata: chiamata.idChiamata,
      stato: "squilla",
      membri: [...chiamata.membri, ...nuovi],
      da: mio,
      daAttore: this.attore,
      idGruppo: chiamata.idGruppo,
      nomeGruppo: chiamata.nomeGruppo
    });

    this.stato.chiamataAggiungi = false;
    this.render();
  }

  /**
   * La chiamata va in secondo piano: resta aperta, ma il telefono torna
   * usabile. Sta sull'istanza e non in `stato` perche' `#vai()` azzera
   * `stato`, e girare fra le App non deve far ripartire la schermata a
   * schermo intero.
   *
   * Ci va **solo una chiamata a cui hai gia' risposto**: uno squillo in
   * arrivo prende sempre lo schermo, come su un telefono.
   */
  static #onChiamataSfondo() {
    const chiamata = chiamataCorrente(this.attore);
    if (!chiamata?.connesso) return;

    this._chiamataSfondo = chiamata.idChiamata;
    this.stato.chiamataAggiungi = false;
    this.render();
  }

  static #onChiamataApri() {
    this._chiamataSfondo = null;
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Banca                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Bonifico da giocatore a giocatore. Il mittente possiede la propria
   * scheda e si addebita da solo; l'accredito sulla scheda dell'altro non
   * puo' scriverlo lui, quindi viaggia come ordine di servizio e lo applica
   * il client eletto — la stessa strada di MedScan.
   *
   * L'addebito viene prima: se fallisce non parte niente. Il buco possibile
   * e' quello gia' noto degli acquisti — soldi tolti e messaggio mai
   * partito — e Foundry non ha transazioni per chiuderlo.
   */
  static async #onBancaInvia() {
    if (!this.puoScrivere) return;

    const quanto = Math.floor(Number(this.element.querySelector('[name="importo"]')?.value ?? 0));
    const causale = (this.element.querySelector('[name="causale"]')?.value ?? "").trim();
    const numero = this.element.querySelector('[name="bersaglio"]')?.value ?? "";

    if (!Number.isFinite(quanto) || quanto <= 0) {
      ui.notifications.warn(game.i18n.localize("CPRX.BancaImportoNonValido"));
      return;
    }

    const rotta = await this.#rotta(numero);
    if (!rotta) return;

    const eddies = trovaEddies(this.attore);
    if (eddies.valore === null || eddies.valore < quanto) {
      ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
      return;
    }

    if (!(await accredita(this.attore, -quanto))) {
      ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
      return;
    }

    await segnaMovimento(this.attore, {
      id: foundry.utils.randomID(),
      quando: Date.now(),
      importo: -quanto,
      causale,
      controparte: identita(rotta.attoreAltro).handle
    });

    await invia({
      tipo: TIPO.SERVIZIO,
      app: "banca",
      titolo: game.i18n.localize("CPRX.AppBanca"),
      da: rotta.mio,
      a: rotta.altro,
      daAttore: this.attore,
      aAttore: rotta.attoreAltro,
      testo: game.i18n.format("CPRX.BancaRicevuto", { quanto, da: identita(this.attore).handle }),
      // L'accredito sulla scheda dell'altro lo scrive un suo proprietario.
      accredito: {
        su: rotta.attoreAltro.id,
        importo: quanto,
        causale,
        controparte: identita(this.attore).handle
      }
    });

    this.stato.bersaglio = "";
    ui.notifications.info(game.i18n.format("CPRX.BancaInviato", { quanto }));
    this.render();
  }

  /**
   * Alloggio e vitto si premono, non si salvano: sono pillole, e una pillola
   * che chiede conferma non e' una pillola. La stessa strada dei temi.
   */
  static async #onCasaScegli(event, target) {
    if (!this.puoScrivere || eCorporativo(this.attore)) return;

    const campo = target.dataset.campo;
    const valore = target.dataset.valore;
    const tabella = campo === "alloggio" ? alloggi() : vitti();
    if (!["alloggio", "vitto"].includes(campo) || !tabella[valore]) return;

    const attuale = this.attore.getFlag(MODULO, "casa") ?? {};
    await this.attore.setFlag(MODULO, "casa", { ...attuale, [campo]: valore });
    this.render();
  }

  /**
   * Paga il mese di tasca propria. La strada e' quella della Banca —
   * `accredita()` col segno meno piu' la riga nel registro — perche' i soldi
   * sono quelli della scheda e il registro e' uno solo.
   *
   * Se c'e' un arretrato, si salda quello: chi deve un mese non sta pagando
   * in anticipo il prossimo.
   */
  static async #onCasaPaga() {
    if (!this.puoScrivere) return;

    const stato = statoCasa(this.attore);
    if (stato.corporativo || stato.totale <= 0) return;

    const eddies = trovaEddies(this.attore);
    if ((eddies.valore ?? 0) < stato.totale) {
      ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
      return;
    }

    if (!await accredita(this.attore, -stato.totale)) return;

    await segnaMovimento(this.attore, {
      id: foundry.utils.randomID(),
      quando: Date.now(),
      importo: -stato.totale,
      causale: game.i18n.localize("CPRX.CasaCausale"),
      controparte: game.i18n.localize("CPRX.CasaPadrone")
    });

    const attuale = this.attore.getFlag(MODULO, "casa") ?? {};
    await this.attore.setFlag(MODULO, "casa", {
      ...attuale,
      arretrati: Math.max(0, (Number(attuale.arretrati) || 0) - 1),
      ultimoPagamento: Date.now()
    });

    ui.notifications.info(game.i18n.localize("CPRX.CasaPagato"));
    this.render();
  }

  /**
   * Costruisce o smonta una miglioria del Quartier Generale. I Punti tornano
   * indietro per intero smontandola: e' quello che fa il prototipo, e al
   * tavolo vuol dire che nessuno resta incastrato in una scelta.
   */
  static async #onCasaMiglioria(event, target) {
    if (!this.puoScrivere) return;

    const chiave = target.dataset.miglioria;
    const def = MIGLIORIE_QG[chiave];
    if (!def) return;

    const stato = statoCasa(this.attore);
    const attuale = this.attore.getFlag(MODULO, "casa") ?? {};
    const attiva = stato.migliorie.includes(chiave);

    if (!attiva && stato.pmqg < def.costo) {
      ui.notifications.warn(game.i18n.localize("CPRX.QgPuntiInsufficienti"));
      return;
    }

    await this.attore.setFlag(MODULO, "casa", {
      ...attuale,
      migliorie: attiva ? stato.migliorie.filter(m => m !== chiave)
        : [...stato.migliorie, chiave],
      pmqg: attiva ? stato.pmqg + def.costo : stato.pmqg - def.costo
    });
    this.render();
  }

  /* --- calendario e downtime --- */

  /**
   * Sfoglia i mesi. Lo scarto sta in `stato`, non una data: vedi il contesto.
   *
   * Sfogliando si sposta anche il giorno aperto, al primo del mese che si
   * apre — o a oggi, se si torna al mese corrente. Lasciarlo dov'era voleva
   * dire aprire febbraio e leggerci sotto gli eventi del 3 gennaio.
   */
  static #onCalMese(event, target) {
    const scarto = Number(target.dataset.mese) || 0;
    this.stato.mese = scarto;

    const oggi = istante();
    this.stato.giorno = scarto === 0
      ? chiaveGiorno(oggi)
      : chiaveGiorno(new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() + scarto, 1)));

    this.render();
  }

  static #onCalGiorno(event, target) {
    this.stato.giorno = target.dataset.giorno;
    this.render();
  }

  static #onDtApri() {
    this.stato.dichiara = true;
    this.render();
  }

  static #onDtAnnulla() {
    this.stato.dichiara = false;
    this.render();
  }

  /**
   * Dichiara — o corregge — cosa fai della settimana. Una voce per
   * settimana: se c'e' gia' si riscrive, e finche' il master non l'ha
   * chiusa resta tua.
   */
  static async #onDtSalva() {
    if (!this.puoScrivere) return;

    const attivita = this.element.querySelector('[name="dtAttivita"]')?.value;
    if (!ATTIVITA[attivita]) return;

    const nota = (this.element.querySelector('[name="dtNota"]')?.value ?? "").trim();
    const settimana = settimanaDiGioco();
    const voci = downtimeDi(this.attore);
    const questa = voci.find(v => v.settimana === settimana);

    // Chiusa dal master non si tocca: l'esito e' gia' scritto.
    if (questa?.stato === "chiuso") return;

    const aggiornate = [
      ...voci.filter(v => v.settimana !== settimana),
      {
        id: questa?.id ?? foundry.utils.randomID(),
        creato: questa?.creato ?? Date.now(),
        settimana,
        attivita,
        nota,
        stato: "attesa",
        esito: ""
      }
    ];

    await scriviDowntime(this.attore, aggiornate);
    this.stato.dichiara = false;
    this.render();
  }

  /** Ci ho ripensato: la settimana torna libera. Solo se non e' chiusa. */
  static async #onDtRitira() {
    if (!this.puoScrivere) return;

    const settimana = settimanaDiGioco();
    const voci = downtimeDi(this.attore);
    if (voci.find(v => v.settimana === settimana)?.stato === "chiuso") return;

    await scriviDowntime(this.attore, voci.filter(v => v.settimana !== settimana));
    this.stato.dichiara = false;
    this.render();
  }

  static async #onSalvaContatto(event, target) {
    if (!this.puoScrivere) return;

    const numero = normalizzaNumero(target.dataset.numero);
    if (!numero) return;

    // Un numero che non hai mai letto non lo puoi salvare: in rubrica
    // finirebbe scritto per esteso, ed e' esattamente quello che la
    // copertura deve impedire.
    if (this.#coperto(numero)) {
      ui.notifications.warn(game.i18n.localize("CPRX.ContattoCoperto"));
      return;
    }

    const voci = leggiVoci(this.attore, "contatti");
    if (voci.some(v => v.numero && normalizzaNumero(v.numero) === numero)) return;

    voci.push({
      id: foundry.utils.randomID(),
      creato: Date.now(),
      nome: attorePerNumero(numero)?.name || numero,
      numero
    });
    await scriviVoci(this.attore, "contatti", voci);
    this.render();
  }

  /**
   * Cancella un filo. Sparisce solo dalla propria scheda: la copia dell'altro
   * resta dov'e', come in un telefono vero.
   */
  static async #onCancellaChat(event, target) {
    if (!this.puoScrivere) return;

    const chiave = target.dataset.numero || this.stato.conversazione;
    if (!chiave) return;

    const conferma = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.CancellaChat"),
      game.i18n.localize("CPRX.CancellaChatTesto")
    );
    if (!conferma) return;

    const idGruppo = idGruppoDa(chiave);
    const restano = filo(this.attore).filter(voce => {
      if (voce.tipo !== TIPO.SMS && voce.tipo !== TIPO.CHIAMATA) return true;
      if (idGruppo) return voce.idGruppo !== idGruppo;
      if (voce.idGruppo) return true;
      const altro = voce.daAttore === this.attore.id ? voce.a : voce.da;
      return altro !== chiave;
    });

    await this.attore.setFlag(MODULO, "filo", restano);

    if (this.stato.conversazione === chiave) this.#vai("messaggi");
    else this.render();
  }

  static async #onRigeneraNumero() {
    if (!this.puoScrivere) return;

    const conferma = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.RigeneraNumero"),
      game.i18n.localize("CPRX.RigeneraNumeroTesto")
    );
    if (!conferma) return;

    await assegnaNumero(this.attore, { forza: true });
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Agent bruciato                                                    */
  /* ---------------------------------------------------------------- */

  static async #onRiparaAgent() {
    const prezzo = game.settings.get(MODULO, "prezzoAgent");

    // Il GM rimette in piedi l'Agent gratis; il giocatore ne compra uno nuovo.
    if (!game.user.isGM) {
      if (!this.puoScrivere) return;

      const eddies = trovaEddies(this.attore);
      if (eddies.valore === null || eddies.valore < prezzo) {
        ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
        return;
      }

      const conferma = await Agent.#chiediConferma(
        game.i18n.localize("CPRX.SostituisciAgent"),
        game.i18n.format("CPRX.SostituisciAgentTesto", { prezzo, residuo: eddies.valore - prezzo })
      );
      if (!conferma) return;

      if (!(await paga(this.attore, prezzo))) {
        ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
        return;
      }
    }

    await this.attore.unsetFlag(MODULO, "agentDistrutto");
    // Le App restano di proprieta': un Agent nuovo se le riscarica tutte.
    await this.attore.setFlag(MODULO, "appInstallate", appPossedute(this.attore));
    this.#vai(null);
  }

  /* ---------------------------------------------------------------- */
  /* Digital Gladiator                                                 */
  /* ---------------------------------------------------------------- */

  static async #onSfida(event, target) {
    const digitato = this.element.querySelector('[name="composto"]')?.value;
    const rotta = await this.#rotta(target.dataset.numero ?? digitato ?? this.stato.composto ?? "");
    if (!rotta) return;

    if (!appInstallate(rotta.attoreAltro).includes("gladiator")) {
      ui.notifications.warn(game.i18n.format("CPRX.AppMancanteAltrove", {
        nome: rotta.attoreAltro.name, app: APP_ACQUISTABILI.gladiator.nome
      }));
      return;
    }

    // Senza gladiatore non si scende in arena: il duello e' fra due Solitari
    // di Grado 4, non fra due Agent.
    if (!gladiatoreDi(this.attore)) {
      ui.notifications.warn(game.i18n.localize("CPRX.GladiatoreMancante"));
      return;
    }

    const amichevole = target.dataset.modo === "amichevole";
    const posta = amichevole
      ? (this.element.querySelector('[name="posta"]')?.value ?? "").trim()
      : "";

    await invia({
      tipo: TIPO.SFIDA,
      stato: "invito",
      idSfida: foundry.utils.randomID(),
      modo: amichevole ? "amichevole" : "classificata",
      posta,
      da: rotta.mio,
      a: rotta.altro,
      daAttore: this.attore,
      aAttore: rotta.attoreAltro
    });

    this.stato.composto = "";
    this.render();
  }

  /**
   * Il duello lo tira il client di chi accetta. Il perdente non viene toccato
   * da qui: il messaggio di esito porta il suo id, e sara' un suo proprietario
   * ad applicarsi le conseguenze.
   */
  static async #onAccettaSfida() {
    const sfida = sfidaAperta(this.attore);
    if (!sfida?.inArrivo) return;

    const sfidante = game.actors.get(sfida.daAttore);
    if (!sfidante) {
      ui.notifications.warn(game.i18n.localize("CPRX.SfidanteSparito"));
      return;
    }

    const mio = gladiatoreDi(this.attore);
    if (!mio) {
      ui.notifications.warn(game.i18n.localize("CPRX.GladiatoreMancante"));
      return;
    }

    // In arena scendono i gladiatori, non i loro proprietari. Se lo
    // sfidante non ne ha piu' uno collegato, combatte lui.
    const suo = gladiatoreDi(sfidante) ?? sfidante;
    const amichevole = sfida.modo === "amichevole";

    const esito = await risolviDuello(suo, mio, {
      danno: game.settings.get(MODULO, "dannoArena") || "2d6"
    });

    // Il vincitore fra i gladiatori dice chi ha vinto fra i proprietari.
    const vinceSfidante = esito.vincitore === suo;
    const perdente = vinceSfidante ? this.attore : sfidante;

    // Un duello con conseguenze meccaniche e' un fatto del tavolo, non
    // corrispondenza privata: il risultato va in chiaro, in chat.
    await annuncia(this.attore, APP_ACQUISTABILI.gladiator.icona,
      `${APP_ACQUISTABILI.gladiator.nome} — ${game.i18n.localize(
        amichevole ? "CPRX.ArenaAmichevole" : "CPRX.ArenaClassificata")}`,
      [esito.riassunto, ...esito.resoconto].join("\n"));

    await this.#segnaArena(esito, amichevole);

    if (amichevole) {
      // Un'amichevole non brucia niente. La posta resta un accordo fra i
      // due: la applica il master, l'App non muove soldi ne' oggetti.
      if (sfida.posta) {
        await annuncia(this.attore, APP_ACQUISTABILI.gladiator.icona,
          game.i18n.localize("CPRX.ArenaPosta"),
          game.i18n.format("CPRX.ArenaPostaTesto", {
            vincitore: (vinceSfidante ? sfidante : this.attore).name,
            posta: sfida.posta
          }));
      }
      this.render();
      return;
    }

    // Questa invece e' una busta di servizio: dice a chi ha perso di
    // bruciarsi l'Agent, e sparisce appena consegnata.
    await invia({
      tipo: TIPO.ESITO,
      idSfida: sfida.idSfida,
      perdente: perdente.id,
      da: sfida.a,
      a: sfida.da,
      daAttore: this.attore,
      aAttore: sfidante
    });
    this.render();
  }

  /** Una riga di classifica per parte, sulla scheda di ciascuno. */
  async #segnaArena(esito, amichevole) {
    const vinceMio = esito.vincitore === gladiatoreDi(this.attore);
    const voce = {
      id: foundry.utils.randomID(),
      quando: Date.now(),
      modo: amichevole ? "amichevole" : "classificata",
      avversario: (vinceMio ? esito.perdente : esito.vincitore).name,
      vinto: vinceMio,
      round: esito.round
    };

    const storia = [...arenaStorico(this.attore), voce].slice(-40);
    try {
      await this.attore.setFlag(MODULO, "arena", storia);
    } catch (errore) {
      console.warn("cprx-agent | classifica non scrivibile:", errore);
    }
  }

  /** Collega la scheda del gladiatore, o la stacca scegliendo il vuoto. */
  static async #onGladiatoreScegli() {
    if (!this.puoScrivere) return;
    const id = this.element.querySelector('[name="gladiatore"]')?.value ?? "";
    if (id) await this.attore.setFlag(MODULO, "gladiatore", id);
    else await this.attore.unsetFlag(MODULO, "gladiatore");
    this.render();
  }

  /** La scheda vera si apre nel foglio del sistema, non qui dentro. */
  static #onGladiatoreApri() {
    gladiatoreDi(this.attore)?.sheet?.render(true);
  }

  static async #onRifiutaSfida() {
    const sfida = sfidaAperta(this.attore);
    if (!sfida) return;

    const altro = game.actors.get(sfida.inArrivo ? sfida.daAttore : sfida.aAttore);
    await invia({
      tipo: TIPO.SFIDA,
      stato: "rifiuto",
      idSfida: sfida.idSfida,
      da: numeroDi(this.attore),
      a: sfida.inArrivo ? sfida.da : sfida.a,
      daAttore: this.attore,
      aAttore: altro
    });
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* 4Tify                                                             */
  /* ---------------------------------------------------------------- */

  static async #onFortifyScandisci() {
    if (!this.puoScrivere) return;

    const bersaglio = (this.element.querySelector('[name="bersaglio"]')?.value ?? "").trim();
    if (!bersaglio) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    await this.attore.setFlag(MODULO, "fortify", { bersaglio, quando: Date.now() });
    const avanzato = await avanzaTempo(FORTIFY_SCANSIONE);

    await annuncia(this.attore, "fa-solid fa-shield-halved", APP_ACQUISTABILI.fortify.nome,
      game.i18n.format(avanzato ? "CPRX.FortifyScansioneTempo" : "CPRX.FortifyScansione",
        { bersaglio, minuti: FORTIFY_SCANSIONE / 60 }));

    this.stato.bersaglio = "";
    this.render();
  }

  static async #onFortifyUsa() {
    const stato = statoFortify(this.attore);
    if (!stato || !this.puoScrivere) return;

    const tiro = await new Roll("1d6").evaluate();
    await this.attore.unsetFlag(MODULO, "fortify");

    await annuncia(this.attore, "fa-solid fa-shield-halved", APP_ACQUISTABILI.fortify.nome,
      game.i18n.format("CPRX.FortifyDado", { bersaglio: stato.bersaglio, valore: tiro.total }),
      [tiro]);

    this.render();
  }

  static async #onFortifyScarta() {
    if (!this.puoScrivere) return;
    await this.attore.unsetFlag(MODULO, "fortify");
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* NCPD                                                              */
  /* ---------------------------------------------------------------- */

  /* --- NCPD: il casellario ------------------------------------------ */

  /**
   * L'App NCPD e' un terminale di consultazione: apre un fascicolo e lo
   * chiude, niente altro. Chi scheda qualcuno lo fa dalla console del
   * master — anche quando a tenere in mano l'Agent e' il master stesso.
   */
  static #onSchedaApri(event, target) {
    this.stato.scheda = target.dataset.id;
    this._scorrimento = 0;
    this.render();
  }

  static #onSchedaAnnulla() {
    this.stato.scheda = null;
    this.render();
  }


  /* ---------------------------------------------------------------- */
  /* MedScan                                                          */
  /* ---------------------------------------------------------------- */

  static async #onMedscanRichiedi(event, target) {
    if (!this.puoScrivere) return;

    const def = MEDSCAN_LIVELLI[target.dataset.livello];
    if (!def) return;

    // Il consulto si puo' pagare per se' o per un altro Agent.
    const grezzo = (this.element.querySelector('[name="perNumero"]')?.value ?? "").trim();
    let beneficiario = this.attore;
    if (grezzo) {
      beneficiario = attorePerNumero(grezzo);
      if (!beneficiario) {
        ui.notifications.warn(game.i18n.format("CPRX.NumeroInesistente",
          { numero: normalizzaNumero(grezzo) }));
        return;
      }
    }

    // Un abbonato Trauma Team Executive non paga: niente conto, niente
    // conferma di spesa, si collega e basta.
    const abbonato = abbonatoTrauma(this.attore);
    const eddies = trovaEddies(this.attore);

    if (!abbonato) {
      if (eddies.valore === null || eddies.valore < def.prezzo) {
        ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
        return;
      }

      const conferma = await Agent.#chiediConferma(
        game.i18n.localize("CPRX.ConfermaAcquistoTitolo"),
        game.i18n.format("CPRX.ConfermaAcquistoTesto", {
          oggetto: game.i18n.localize(def.etichetta),
          prezzo: def.prezzo,
          residuo: eddies.valore - def.prezzo
        })
      );
      if (!conferma) return;

      if (!(await paga(this.attore, def.prezzo))) {
        ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
        return;
      }

      await segnaMovimento(this.attore, {
        id: foundry.utils.randomID(),
        quando: Date.now(),
        importo: -def.prezzo,
        causale: game.i18n.localize(def.etichetta),
        controparte: APP_ACQUISTABILI.medscan.produttore
      });
    }

    const valore = {
      livello: target.dataset.livello,
      fino: (game.time?.worldTime ?? 0) + def.ore * 3600,
      per: this.attore.name,
      gratis: abbonato
    };

    await invia({
      tipo: TIPO.SERVIZIO,
      app: "medscan",
      titolo: APP_ACQUISTABILI.medscan.nome,
      da: numeroDi(this.attore),
      a: numeroDi(beneficiario) || null,
      daAttore: this.attore,
      aAttore: beneficiario === this.attore ? null : beneficiario,
      testo: game.i18n.format("CPRX.MedscanAttivo", {
        livello: game.i18n.localize(def.etichetta),
        ore: def.ore,
        nome: beneficiario.name
      }),
      // Se il beneficiario non e' mio, glielo scrive un suo proprietario —
      // flag e ActiveEffect insieme, dallo stesso client.
      applica: {
        su: beneficiario.id,
        flag: "medscan",
        valore,
        effetto: {
          descrizione: game.i18n.localize(def.etichetta),
          secondi: def.ore * 3600,
          // Il +1 va alle abilita' di questo livello, non a quelle dell'altro.
          modifiche: def.modifiche
        }
      }
    });

    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Ziggurat                                                          */
  /* ---------------------------------------------------------------- */

  static #onZigguratCategoria(event, target) {
    this.stato.categoria = target.dataset.categoria ?? "";
    this._scorrimento = 0;
    this.render();
  }

  static #onZigguratCerca() {
    this.stato.ricerca = this.element.querySelector('[name="ricerca"]')?.value ?? "";
    this._scorrimento = 0;
    this.render();
  }

  static async #onZigguratSalva() {
    if (!this.puoScrivere) return;

    const citta = (this.element.querySelector('[name="citta"]')?.value ?? "").trim();
    if (citta) {
      await this.attore.setFlag(MODULO, "ziggurat", { citta });
      // La guida della citta' non scade: effetto senza durata, e nessuno
      // te la toglie dalla console.
      await accendiEffetto(this.attore, "ziggurat", { descrizione: citta });
    } else {
      await this.attore.unsetFlag(MODULO, "ziggurat");
      await spegniEffetto(this.attore, "ziggurat", { forza: true });
    }
    this.render();
  }

  static async #onZigguratConsulta() {
    const stato = statoZiggurat(this.attore);
    if (!stato) return;

    // Se sulla scheda c'e' un'abilita' di conoscenza locale la si usa,
    // altrimenti resta il solo bonus della guida.
    const abilita = (this.attore.items ?? []).find(i =>
      /skill/i.test(i.type ?? "") && NOMI_ESPERTO_LOCALE.test(i.name ?? ""));
    const livello = Number(abilita?.system?.level ?? 0) || 0;
    const base = statistica(this.attore, abilita?.system?.stat ?? "int");

    const tiro = await tiroCpr(base + livello + ZIGGURAT_BONUS);

    await annuncia(this.attore, "fa-solid fa-city", APP_ACQUISTABILI.ziggurat.nome,
      game.i18n.format("CPRX.ZigguratTiro", {
        citta: stato.citta,
        totale: tiro.totale,
        dado: tiro.dado,
        modificatore: tiro.modificatore,
        bonus: ZIGGURAT_BONUS
      }));

    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Le App del DLC «Tutto sugli Agent»                                */
  /* ---------------------------------------------------------------- */

  /**
   * Alex cerca nel Database Urbano e tira Archivistica. Il tiro e' vero —
   * STAT + abilita' + il bonus dell'Agent — e il bonus e' +2, o +3 con Big
   * IAAA installata.
   */
  static async #onAlexCerca() {
    this.stato.ricerca = this.element.querySelector('[name="ricerca"]')?.value ?? "";
    this._scorrimento = 0;
    this.render();
  }

  static async #onAlexTira() {
    const abilita = (this.attore.items ?? []).find(i =>
      /skill/i.test(i.type ?? "") && NOMI_ARCHIVISTICA.test(i.name ?? ""));
    const livello = Number(abilita?.system?.level ?? 0) || 0;
    const base = statistica(this.attore, abilita?.system?.stat ?? "int");
    const bonus = bonusArchivistica(this.attore);

    const tiro = await tiroCpr(base + livello + bonus);

    await annuncia(this.attore, "fa-solid fa-magnifying-glass-chart",
      APP_ACQUISTABILI.alex.nome,
      game.i18n.format("CPRX.AlexTiro", {
        cerca: (this.stato.ricerca ?? "").trim() || game.i18n.localize("CPRX.AlexSenzaChiave"),
        totale: tiro.totale,
        dado: tiro.dado,
        modificatore: tiro.modificatore,
        bonus
      }));

    this.render();
  }

  /* --- ZPost -------------------------------------------------------- */

  static #onZpostLinguetta(event, target) {
    this.stato = { ...this.stato, zpostScritte: target.dataset.scheda === "inviate", email: null };
    this._scorrimento = 0;
    this.render();
  }

  static #onZpostApri(event, target) {
    this.stato = { ...this.stato, email: target.dataset.id };
    this._scorrimento = 0;
    this.render();
  }

  static #onZpostChiudi() {
    this.stato = { ...this.stato, email: null };
    this._scorrimento = 0;
    this.render();
  }

  /** Rispondere: si riapre il modulo con il numero gia' dentro. */
  static #onZpostRispondi(event, target) {
    this.stato = {
      ...this.stato, email: null, zpostScritte: false,
      composto: target.dataset.numero ?? ""
    };
    this._scorrimento = 0;
    this.render();
  }

  static async #onZpostInvia() {
    if (!this.puoScrivere) return;

    const numero = this.element.querySelector('[name="composto"]')?.value ?? "";
    const oggetto = (this.element.querySelector('[name="oggetto"]')?.value ?? "").trim();
    const testo = (this.element.querySelector('[name="testo"]')?.value ?? "").trim();

    if (!testo) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    const rotta = await this.#rotta(numero);
    if (!rotta) return;

    await invia({
      tipo: TIPO.EMAIL,
      da: rotta.mio,
      a: rotta.altro,
      daAttore: this.attore,
      aAttore: rotta.attoreAltro,
      aMaster: !!rotta.aMaster,
      oggetto,
      testo
    });

    this.stato = { ...this.stato, composto: "" };
    this.render();
  }

  /* --- Garden ------------------------------------------------------- */

  /**
   * Un post viaggia come una busta: sulla bacheca — che e' un'impostazione
   * di mondo — scrive solo il postino. Senza un GM collegato il post resta
   * in giacenza e compare quando ne arriva uno.
   */
  static async #onGardenPubblica() {
    if (!this.puoScrivere) return;

    const testo = (this.element.querySelector('[name="testo"]')?.value ?? "").trim();
    if (!testo) return;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    await invia({
      tipo: TIPO.GARDEN,
      da: mio,
      daAttore: this.attore,
      // Sulla Patch si firma con l'handle, non col nome della scheda: su
      // una bacheca pubblica ci va il nome di strada, che e' anche quello
      // che l'Agent usa dappertutto.
      daNome: identita(this.attore).handle,
      // Su Garden si firma: e' una bacheca pubblica, non corrispondenza.
      // Chi vuole restare coperto non pubblica.
      anonimo: false,
      testo
    });

    this.element.querySelector('[name="testo"]').value = "";
    ui.notifications.info(game.i18n.localize("CPRX.GardenPubblicato"));
  }

  /**
   * Il cuore. La bacheca e' un'impostazione di mondo, quindi lo scrive un
   * GM: da un client giocatore l'aggiornamento fallisce in silenzio, e per
   * questo il tasto passa dalla stessa busta del post.
   */
  static async #onGardenCuore(event, target) {
    const mio = numeroDi(this.attore);
    if (!mio) return;

    const id = target.dataset.id;
    const voci = gardenPatch();
    const voce = voci.find(v => v.id === id);
    if (!voce) return;

    const cuori = Array.isArray(voce.cuori) ? voce.cuori : [];
    const nuovi = cuori.includes(mio) ? cuori.filter(n => n !== mio) : [...cuori, mio];

    if (game.user.isGM) {
      await scriviGardenPatch(voci.map(v => (v.id === id ? { ...v, cuori: nuovi } : v)));
    } else {
      await invia({
        tipo: TIPO.SERVIZIO,
        app: "garden",
        titolo: APP_ACQUISTABILI.garden.nome,
        da: mio,
        daAttore: this.attore,
        anonimo: false,
        testo: game.i18n.localize("CPRX.GardenCuore"),
        gardenCuore: { id, numero: mio }
      });
    }

    this.render();
  }

  /* --- BangMe! ------------------------------------------------------ */

  static #onBangImporto(event, target) {
    this.stato = { ...this.stato, importo: Number(target.dataset.importo) || 0 };
    this.render();
  }

  static #onBangDestinatario(event, target) {
    this.stato = { ...this.stato, bersaglio: target.dataset.numero ?? "" };
    this.render();
  }

  /**
   * Il trasferimento e' quello della Banca: mi addebito da solo, e
   * l'accredito viaggia sulla busta perche' sulla scheda di un altro non
   * posso scrivere. L'addebito viene prima: se fallisce non parte niente.
   */
  static async #onBangInvia() {
    if (!this.puoScrivere) return;

    const scritto = this.element.querySelector('[name="importo"]')?.value;
    const quanto = Math.floor(Number(scritto ?? this.stato.importo ?? 0));

    if (!Number.isFinite(quanto) || quanto <= 0) {
      ui.notifications.warn(game.i18n.localize("CPRX.BancaImportoNonValido"));
      return;
    }

    const rotta = await this.#rotta(this.stato.bersaglio ?? "");
    if (!rotta || !rotta.attoreAltro) return;

    const eddies = trovaEddies(this.attore);
    if (eddies.valore === null || eddies.valore < quanto) {
      ui.notifications.warn(game.i18n.localize("CPRX.SoldiInsufficienti"));
      return;
    }

    if (!(await accredita(this.attore, -quanto))) {
      ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
      return;
    }

    const causale = game.i18n.localize("CPRX.BangCausale");

    await segnaMovimento(this.attore, {
      id: foundry.utils.randomID(),
      quando: Date.now(),
      importo: -quanto,
      causale,
      controparte: identita(rotta.attoreAltro).handle
    });

    await invia({
      tipo: TIPO.SERVIZIO,
      app: "bangme",
      titolo: APP_ACQUISTABILI.bangme.nome,
      da: rotta.mio,
      a: rotta.altro,
      daAttore: this.attore,
      aAttore: rotta.attoreAltro,
      testo: game.i18n.format("CPRX.BancaRicevuto", { quanto, da: identita(this.attore).handle }),
      accredito: {
        su: rotta.attoreAltro.id,
        importo: quanto,
        causale,
        controparte: identita(this.attore).handle
      }
    });

    this.stato = { ...this.stato, importo: 0 };
    ui.notifications.info(game.i18n.format("CPRX.BancaInviato", { quanto }));
    this.render();
  }

  /* --- HusTool ------------------------------------------------------ */

  /**
   * «VOGLIO IL CASH»: mezz'ora, dieci eurodollari, e un 1d10. Con 1 il
   * lavoretto va male e non prendi niente; con 10 lo concludi ma ci sono
   * guai, e il master tira sulla tabella degli incontri. I soldi si
   * accreditano davvero, e il tempo avanza se a premere e' un GM.
   */
  static async #onHustoolLavoretto() {
    if (!this.puoScrivere) return;

    const dado = await new Roll("1d10").evaluate();
    const risultato = dado.total;
    const esito = risultato === 1 ? "male" : (risultato === 10 ? "guai" : "bene");
    const paga = esito === "male" ? 0 : HUSTOOL_PAGA;

    if (paga > 0) {
      if (!(await accredita(this.attore, paga))) {
        ui.notifications.error(game.i18n.localize("CPRX.EddiesNonScrivibili"));
        return;
      }
      await segnaMovimento(this.attore, {
        id: foundry.utils.randomID(),
        quando: Date.now(),
        importo: paga,
        causale: game.i18n.localize("CPRX.HusCausale"),
        controparte: APP_ACQUISTABILI.hustool.produttore
      });
    }

    const voci = leggiVoci(this.attore, "hustool");
    await scriviVoci(this.attore, "hustool",
      [...voci, { id: foundry.utils.randomID(), quando: Date.now(), esito, paga }].slice(-60));

    const avanzato = await avanzaTempo(HUSTOOL_DURATA);

    await annuncia(this.attore, "fa-solid fa-hand-holding-dollar",
      APP_ACQUISTABILI.hustool.nome,
      game.i18n.format(`CPRX.HusEsito${esito.charAt(0).toUpperCase()}${esito.slice(1)}`, {
        paga, minuti: HUSTOOL_DURATA / 60
      }) + (avanzato ? ` ${game.i18n.localize("CPRX.TempoAvanzato")}` : ""),
      [dado]);

    this.render();
  }

  /* --- Roach Race --------------------------------------------------- */

  /**
   * Una partita. Il manuale non da' numeri per un platform, quindi non ne
   * sono stati inventati: si tira, e il punteggio e' il tiro. Quello che
   * resta e' il record, che e' l'unica cosa per cui questa App esiste al
   * tavolo — avere qualcosa da rinfacciare a qualcun altro.
   */
  static async #onRoachGioca() {
    if (!this.puoScrivere) return;

    const tiro = await new Roll("3d10 * 100").evaluate();
    const punti = tiro.total;
    const stato = statoRoach(this.attore);
    const record = Math.max(stato.record, punti);

    await this.attore.setFlag(MODULO, "roachrace", {
      record, partite: stato.partite + 1, ultima: punti
    });

    await annuncia(this.attore, "fa-solid fa-horse", APP_ACQUISTABILI.roachrace.nome,
      game.i18n.format(punti >= record ? "CPRX.RoachRecord" : "CPRX.RoachPunti",
        { punti, record }),
      [tiro]);

    this.render();
  }

  /* --- WatchBox ----------------------------------------------------- */

  /**
   * Cinque minuti per mappare la stanza. Un Agent Interno non puo' farlo —
   * e' scritto nel manuale, e il motivo e' che l'Agent va **lasciato** in
   * mezzo alla stanza.
   */
  static async #onWatchboxAvvia() {
    if (!this.puoScrivere) return;

    if (haAgentInterno(this.attore)) {
      ui.notifications.warn(game.i18n.localize("CPRX.WatchInterno"));
      return;
    }

    const stanza = (this.element.querySelector('[name="bersaglio"]')?.value ?? "").trim();
    if (!stanza) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    await this.attore.setFlag(MODULO, "watchbox", { stanza, quando: Date.now() });
    const avanzato = await avanzaTempo(WATCHBOX_MAPPATURA);

    await annuncia(this.attore, "fa-solid fa-video", APP_ACQUISTABILI.watchbox.nome,
      game.i18n.format("CPRX.WatchAvviata", {
        stanza, lato: WATCHBOX_LATO, vd: WATCHBOX_VD_FURTIVITA
      }) + (avanzato ? ` ${game.i18n.localize("CPRX.TempoAvanzato")}` : ""));

    this.render();
  }

  static async #onWatchboxSpegni() {
    if (!this.puoScrivere) return;
    await this.attore.unsetFlag(MODULO, "watchbox");
    this.render();
  }

  /* --- Brainwasher -------------------------------------------------- */

  /**
   * Una sessione al giorno, e il giorno e' quello del mondo: senza quel
   * controllo si preme sette volte di fila e il ciclo di una settimana si
   * chiude in tre secondi.
   */
  static async #onBrainwasherSessione() {
    if (!this.puoScrivere) return;

    if (brainwasherOggiFatta(this.attore)) {
      ui.notifications.warn(game.i18n.localize("CPRX.BwGiaOggi"));
      return;
    }

    const stato = statoBrainwasher(this.attore);
    const sessioni = Math.min(BRAINWASHER_GIORNI, stato.sessioni + 1);

    await this.attore.setFlag(MODULO, "brainwasher",
      { sessioni, ultima: oraMondo(), esito: stato.esito });

    await annuncia(this.attore, "fa-solid fa-head-side-virus",
      APP_ACQUISTABILI.brainwasher.nome,
      game.i18n.format("CPRX.BwSessione", { fatte: sessioni, totale: BRAINWASHER_GIORNI }));

    this.render();
  }

  /**
   * Il ciclo completo: 1d10. Pari, la terapia dura un giorno di meno;
   * dispari, uno di piu' per via dei «blocchi» prodotti dall'app. E' tutto
   * quello che il manuale dice, e il modulo non tocca la terapia — la
   * gestisce il master, come ogni altra cosa del tempo morto.
   */
  static async #onBrainwasherChiudi() {
    if (!this.puoScrivere) return;

    const stato = statoBrainwasher(this.attore);
    if (stato.sessioni < BRAINWASHER_GIORNI) return;

    const dado = await new Roll("1d10").evaluate();
    const pari = dado.total % 2 === 0;
    const esito = pari ? "prima" : "dopo";

    await this.attore.setFlag(MODULO, "brainwasher",
      { sessioni: 0, ultima: null, esito });

    await annuncia(this.attore, "fa-solid fa-head-side-virus",
      APP_ACQUISTABILI.brainwasher.nome,
      game.i18n.format(pari ? "CPRX.BwEsitoPrima" : "CPRX.BwEsitoDopo", { dado: dado.total }),
      [dado]);

    this.render();
  }

  /* --- Elftracker --------------------------------------------------- */

  static #onElfModifica() {
    this.stato = { ...this.stato, modifica: "elflines" };
    this.render();
  }

  static #onElfAnnulla() {
    this.stato = { ...this.stato, modifica: null };
    this.render();
  }

  static async #onElfSalva() {
    if (!this.puoScrivere) return;

    const leggi = (nome) => (this.element.querySelector(`[name="${nome}"]`)?.value ?? "").trim();
    const nome = leggi("nome");
    if (!nome) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    const dati = { nome, livello: leggi("livello"), gilda: leggi("gilda"), server: leggi("server") };
    for (const chiave of ELFLINES_STAT) dati[chiave] = leggi(chiave);

    await this.attore.setFlag(MODULO, "elflines", dati);
    this.stato = { ...this.stato, modifica: null };
    this.render();
  }

  /* --- Big IAAA ----------------------------------------------------- */

  /**
   * L'unico interruttore dell'App, e accende un ActiveEffect vero: il
   * bonus ad Archivistica si somma sulla scheda, non solo qui dentro.
   */
  static async #onIaaaCommuta() {
    if (!this.puoScrivere) return;

    const acceso = !statoBigIaaa(this.attore);
    await this.attore.setFlag(MODULO, "bigiaaa", { acceso });

    if (acceso) await accendiEffetto(this.attore, "bigiaaa");
    else await spegniEffetto(this.attore, "bigiaaa", { forza: true });

    this.render();
  }

  /* --- Netwatch Sentinel -------------------------------------------- */

  static async #onSentQualita(event, target) {
    if (!this.puoScrivere) return;
    const qualita = target.dataset.qualita;
    if (!QUALITA_AGENT[qualita]) return;

    const stato = statoSentinel(this.attore);
    await this.attore.setFlag(MODULO, "sentinel", { ...stato, qualita });
    this.render();
  }

  /**
   * La controscansione. Il manuale dice che chi sospetta di essere stato
   * hackerato tira **Elettronica e Sicurezza** contro il risultato della
   * prova dell'hacker. Quel numero il modulo non ce l'ha — lo sa il master —
   * quindi qui si tira e si mette il totale in chat, che e' esattamente
   * quello che serve al tavolo per confrontarlo.
   */
  static async #onSentScansiona() {
    if (!this.puoScrivere) return;

    const abilita = (this.attore.items ?? []).find(i =>
      /skill/i.test(i.type ?? "") && NOMI_ELETTRONICA.test(i.name ?? ""));
    const livello = Number(abilita?.system?.level ?? 0) || 0;
    const base = statistica(this.attore, abilita?.system?.stat ?? "tech");

    const tiro = await tiroCpr(base + livello);
    const stato = statoSentinel(this.attore);

    await this.attore.setFlag(MODULO, "sentinel", {
      ...stato,
      registro: [...stato.registro, { quando: Date.now(), totale: tiro.totale }].slice(-30)
    });

    await annuncia(this.attore, "fa-solid fa-shield-virus", APP_ACQUISTABILI.sentinel.nome,
      game.i18n.format("CPRX.SentTiro", {
        totale: tiro.totale, dado: tiro.dado, modificatore: tiro.modificatore
      }));

    this.render();
  }

  /**
   * Il riavvio del manuale: cinque minuti, il Breacher si stacca e ogni
   * comando installato sparisce. Non tocca la scheda — quello che pulisce
   * sta nella finzione, e il tavolo ne prende atto dalla carta in chat.
   */
  static async #onSentRiavvia() {
    if (!this.puoScrivere) return;

    const stato = statoSentinel(this.attore);
    await this.attore.setFlag(MODULO, "sentinel", { ...stato, riavvio: Date.now() });
    const avanzato = await avanzaTempo(SENTINEL_RIAVVIO);

    await annuncia(this.attore, "fa-solid fa-shield-virus", APP_ACQUISTABILI.sentinel.nome,
      game.i18n.format("CPRX.SentRiavviato", { minuti: SENTINEL_RIAVVIO / 60 })
      + (avanzato ? ` ${game.i18n.localize("CPRX.TempoAvanzato")}` : ""));

    this.render();
  }

  /* --- Ziggurat Patch Pro ------------------------------------------- */

  static #onPatchScheda(event, target) {
    this.stato = { ...this.stato, patchScheda: target.dataset.scheda };
    this._scorrimento = 0;
    this.render();
  }

  static async #onPatchBozza() {
    if (!this.puoScrivere) return;

    const testo = (this.element.querySelector('[name="testo"]')?.value ?? "").trim();
    if (!testo) return;

    const bozze = bozzePatch(this.attore);
    await this.attore.setFlag(MODULO, "patchpro", {
      bozze: [...bozze, { id: foundry.utils.randomID(), creato: Date.now(), testo }].slice(-40)
    });

    this.element.querySelector('[name="testo"]').value = "";
    this.render();
  }

  static async #onPatchElimina(event, target) {
    if (!this.puoScrivere) return;
    await this.attore.setFlag(MODULO, "patchpro", {
      bozze: bozzePatch(this.attore).filter(v => v.id !== target.dataset.id)
    });
    this.render();
  }

  /**
   * Pubblicare una bozza e' pubblicare su Garden: stessa busta, stesso
   * postino. Patch Pro non ha una bacheca sua — sarebbe la seconda verita'
   * che questo modulo evita ovunque.
   */
  static async #onPatchPubblica(event, target) {
    if (!this.puoScrivere) return;

    const bozze = bozzePatch(this.attore);
    const bozza = bozze.find(v => v.id === target.dataset.id);
    if (!bozza) return;

    const mio = await assegnaNumero(this.attore);
    if (!mio) return;

    await invia({
      tipo: TIPO.GARDEN,
      da: mio,
      daAttore: this.attore,
      daNome: identita(this.attore).handle,
      anonimo: false,
      testo: bozza.testo
    });

    await this.attore.setFlag(MODULO, "patchpro",
      { bozze: bozze.filter(v => v.id !== bozza.id) });

    ui.notifications.info(game.i18n.localize("CPRX.GardenPubblicato"));
    this.stato = { ...this.stato, patchScheda: "pubblicate" };
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Voci di contatti, lavori, note                                    */
  /* ---------------------------------------------------------------- */

  static async #onElimina(event, target) {
    if (!this.puoScrivere) return;
    const id = target.dataset.id;

    const conferma = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.ConfermaEliminaTitolo"),
      game.i18n.localize("CPRX.ConfermaEliminaTesto")
    );
    if (!conferma) return;

    const voci = leggiVoci(this.attore, this.stato.app).filter(v => v.id !== id);
    await scriviVoci(this.attore, this.stato.app, voci);
    if (this.#tornaDentro()) return;
    this.render();
  }

  static async #onSalva() {
    if (!this.puoScrivere) return;

    const def = APP[this.stato.app];
    const voci = leggiVoci(this.attore, this.stato.app);
    const nuovo = this.stato.modifica === "nuovo";

    const dati = {};
    for (const c of def.campi) {
      const campo = this.element.querySelector(`[name="${c.chiave}"]`);
      if (!campo) continue;
      if (c.tipo === "check") dati[c.chiave] = campo.checked;
      else if (c.tipo === "number") dati[c.chiave] = Number(campo.value) || 0;
      else if (c.numero) dati[c.chiave] = normalizzaNumero(campo.value);
      else dati[c.chiave] = campo.value.trim();
    }

    const obbligatorio = def.campi.find(c => c.richiesto);
    if (obbligatorio && !dati[obbligatorio.chiave]) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    if (nuovo) {
      voci.push({
        id: foundry.utils.randomID(),
        creato: Date.now(),
        daMaster: game.user.isGM && !this.attore.testUserPermission(game.user, "OWNER", { exact: true }),
        ...dati
      });
    } else {
      const indice = voci.findIndex(v => v.id === this.stato.modifica);
      if (indice >= 0) voci[indice] = { ...voci[indice], ...dati };
    }

    await scriviVoci(this.attore, this.stato.app, voci);
    if (this.#tornaDentro()) return;
    this.stato.modifica = null;
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Aspetto e preferenze                                              */
  /* ---------------------------------------------------------------- */

  static async #onScegliTema(event, target) {
    await game.settings.set(MODULO, "tema", target.dataset.tema);
    this.render();
  }

  /* --- Corp Link ----------------------------------------------------- */

  /**
   * L'unica cosa che si preme in Corp Link: cambiare linguetta. Non c'e'
   * nient'altro, ed e' voluto — la Corporazione e il livello del badge li
   * assegna il master dalla console, avvisi, accessi e incarichi li scrive
   * lui nell'archivio aziendale. Da un telefono non ti dai un badge di
   * Arasaka, come non ti metti nel casellario della polizia.
   */
  static #onCorpScheda(event, target) {
    this.stato.corpScheda = target.dataset.scheda;
    this._scorrimento = 0;
    this.render();
  }

  /* --- prima accensione --------------------------------------------- */

  /**
   * Ogni passo si salva prima di passare al successivo. Non e' una comodita':
   * il setup vive su `this._setupPasso`, che muore con la finestra, mentre le
   * risposte stanno sulla scheda — chi chiude a meta' ritrova quello che
   * aveva gia' scritto.
   *
   * Tema e sfondo non passano di qui: hanno i loro tasti, che scrivono
   * subito. Qui ci sono solo i campi di modulo, che vanno letti dal DOM.
   */
  async #salvaPassoSetup(passo) {
    if (!this.puoScrivere) return;
    const leggi = (nome) => this.element.querySelector(`[name="${nome}"]`);

    if (passo === "identita") {
      await this.attore.setFlag(MODULO, "handle", (leggi("handle")?.value ?? "").trim());
      await this.attore.setFlag(MODULO, "nomeVero", (leggi("nomeVero")?.value ?? "").trim());
      await this.attore.setFlag(MODULO, "saluto", leggi("saluto")?.checked ? "nome" : "handle");
    }

    if (passo === "casa" && !eCorporativo(this.attore)) {
      const attuale = this.attore.getFlag(MODULO, "casa") ?? {};
      await this.attore.setFlag(MODULO, "casa", {
        ...attuale,
        alloggio: leggi("alloggio")?.value ?? attuale.alloggio,
        vitto: leggi("vitto")?.value ?? attuale.vitto
      });
    }

    if (passo === "dispositivo") {
      await this.attore.setFlag(MODULO, "agentInterno", !!leggi("agentInterno")?.checked);
      await this.attore.setFlag(MODULO, "gps", !!leggi("gps")?.checked);
    }
  }

  static async #onSetupAvanti() {
    const passo = SETUP_PASSI[this._setupPasso] ?? SETUP_PASSI[0];

    // Il setup e' cominciato: da qui in poi decide il flag, non l'euristica
    // sul telefono gia' usato. Va scritto **prima** di salvare il passo,
    // altrimenti il primo handle scritto chiude il giro a meta'.
    if (!this.attore.getFlag(MODULO, "setup")) {
      await this.attore.setFlag(MODULO, "setup", { fatto: false, iniziato: Date.now() });
    }

    await this.#salvaPassoSetup(passo);

    if (this._setupPasso < SETUP_PASSI.length - 1) {
      this._setupPasso += 1;
      this.render();
      return;
    }

    // Ultimo passo: il telefono e' configurato. Si apre gia' sbloccato —
    // hai appena finito di averlo in mano, farti rifare l'impronta subito
    // sarebbe stato solo un tasto in piu'.
    await this.attore.setFlag(MODULO, "setup", { fatto: true, quando: Date.now() });
    this._setupPasso = 0;
    this._sbloccato = true;
    this.render();
  }

  static #onSetupIndietro() {
    if (this._setupPasso > 0) this._setupPasso -= 1;
    this.render();
  }

  /**
   * Ripristino: il telefono torna come appena comprato e riparte dal setup.
   * Cancella quello che sta sul dispositivo e **non** le App comprate ne' i
   * soldi, che stanno sulla scheda.
   *
   * La conferma non e' cerimonia: qui si perdono rubrica, note, lavori e
   * archivio, e non c'e' modo di rimetterli.
   */
  static async #onRipristina() {
    if (!this.puoScrivere) return;

    const ok = await Agent.#chiediConferma(
      game.i18n.localize("CPRX.Ripristina"),
      game.i18n.localize("CPRX.RipristinaConferma"));
    if (!ok) return;

    await ripristinaAgent(this.attore);
    this.stato = { app: null, modifica: null };
    this._setupPasso = 0;
    this._sbloccato = false;
    this._pagina = 0;
    this.render();
    ui.notifications.info(game.i18n.localize("CPRX.RipristinoFatto"));
  }

  static async #onSalvaPreferenze() {
    const leggi = (nome) => this.element.querySelector(`[name="${nome}"]`);

    await game.settings.set(MODULO, "accento", (leggi("accento")?.value ?? "").trim());
    if (this.puoScrivere) {
      await this.attore.setFlag(MODULO, "handle", (leggi("handle")?.value ?? "").trim());
      await this.attore.setFlag(MODULO, "nomeVero", (leggi("nomeVero")?.value ?? "").trim());
      await this.attore.setFlag(MODULO, "saluto", leggi("saluto")?.checked ? "nome" : "handle");
      await this.attore.setFlag(MODULO, "agentInterno", !!leggi("agentInterno")?.checked);
      await this.attore.setFlag(MODULO, "gps", !!leggi("gps")?.checked);
    }
    this.render();
  }

  /**
   * Gli interruttori della pagina di sistema si premono e basta: niente
   * tasto di conferma, come su un telefono vero. Il proprietario e' l'unico
   * che puo' scrivere sulla propria scheda.
   */
  static async #onCommuta(event, target) {
    if (!this.puoScrivere) return;
    const flag = target.dataset.flag;
    if (!["agentInterno", "gps"].includes(flag)) return;

    await this.attore.setFlag(MODULO, flag, !this.attore.getFlag(MODULO, flag));
    this.render();
  }

  static async #chiediConferma(titolo, contenuto) {
    try {
      return await foundry.applications.api.DialogV2.confirm({
        window: { title: titolo },
        content: `<p>${contenuto}</p>`,
        rejectClose: false,
        modal: true
      });
    } catch (errore) {
      return window.confirm(`${titolo}\n\n${contenuto}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* La console del master                                                */
/*                                                                      */
/* Si apre quando un GM chiede l'Agent senza avere un token selezionato: */
/* non e' il telefono di nessuno, e' il banco da cui il master gestisce  */
/* il tavolo. Tre cose: la banca, il casellario NCPD e la posta.         */
/*                                                                      */
/* Per scrivere, il master ha due strade — impersonare un attore del     */
/* mondo (e allora e' il suo Agent, con il suo numero, senza niente di   */
/* nuovo sotto) oppure il numero libero, che non ha una scheda dietro e  */
/* il cui archivio e' un'impostazione di mondo.                          */
/* ------------------------------------------------------------------ */

class AgentMaster extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(opzioni = {}) {
    super(opzioni);
    // `scheda` e' la linguetta aperta, `fascicolo` la scheda NCPD in
    // lavorazione: due cose diverse, due chiavi diverse.
    this.stato = {
      scheda: "banca", bersaglio: "", conversazione: null, fascicolo: null,
      gruppoNome: ""
    };
  }

  static DEFAULT_OPTIONS = {
    id: "cprx-agent-master",
    classes: ["cprx", "cprx-agent", "cprx-agent-master"],
    tag: "div",
    window: {
      title: "CPRX.ConsoleMaster",
      icon: "fa-solid fa-tower-broadcast",
      resizable: true,
      minimizable: true
    },
    // Poco piu' larga dell'Agent di un giocatore (400): le stesse forme, ma
    // qui dentro ci stanno righe con tre campi e due tasti.
    position: { width: 460, height: 700 },
    actions: {
      scheda: AgentMaster.#onScheda,
      fascicoloNuovo: AgentMaster.#onFascicoloNuovo,
      fascicoloApri: AgentMaster.#onFascicoloApri,
      fascicoloSalva: AgentMaster.#onFascicoloSalva,
      fascicoloElimina: AgentMaster.#onFascicoloElimina,
      fascicoloAnnulla: AgentMaster.#onFascicoloAnnulla,
      zigSalva: AgentMaster.#onZigSalva,
      zigElimina: AgentMaster.#onZigElimina,
      // Corp Link
      corpAvvisoSalva: AgentMaster.#onCorpAvvisoSalva,
      corpAvvisoElimina: AgentMaster.#onCorpAvvisoElimina,
      corpAssegna: AgentMaster.#onCorpAssegna,
      corpSospendi: AgentMaster.#onCorpSospendi,
      corpApp: AgentMaster.#onCorpApp,
      // Tempo, calendario e downtime
      tempoAvanza: AgentMaster.#onTempoAvanza,
      tempoMese: AgentMaster.#onTempoMese,
      tempoImposta: AgentMaster.#onTempoImposta,
      tempoAuto: AgentMaster.#onTempoAuto,
      calSalva: AgentMaster.#onCalSalva,
      calElimina: AgentMaster.#onCalElimina,
      dtChiudi: AgentMaster.#onDtChiudi,
      riparaDaConsole: AgentMaster.#onRiparaDaConsole,
      revocaStato: AgentMaster.#onRevocaStato,
      riscuotiMese: AgentMaster.#onRiscuotiMese,
      condona: AgentMaster.#onCondona,
      casaPmqg: AgentMaster.#onCasaPmqg,
      casaSalvaVoce: AgentMaster.#onCasaSalvaVoce,
      casaEliminaVoce: AgentMaster.#onCasaEliminaVoce,
      casaAggiungi: AgentMaster.#onCasaAggiungi,
      mandaImmagine: AgentMaster.#onMandaImmagine,
      togliImmagine: AgentMaster.#onTogliImmagine,
      paga: AgentMaster.#onPaga,
      repMuovi: AgentMaster.#onRepMuovi,
      aggiungiGiocatore: AgentMaster.#onAggiungiGiocatore,
      togliGiocatore: AgentMaster.#onTogliGiocatore,
      salvaIdentita: AgentMaster.#onSalvaIdentita,
      rigeneraIdentita: AgentMaster.#onRigeneraIdentita,
      impersona: AgentMaster.#onImpersona,
      scriviLibero: AgentMaster.#onScriviLibero,
      scriviTutti: AgentMaster.#onScriviTutti,
      scriviGruppo: AgentMaster.#onScriviGruppo,
      apriFilo: AgentMaster.#onApriFilo
    }
  };

  static PARTS = { schermo: { template: `modules/${MODULO}/templates/master.hbs` } };

  static istanza = null;

  static apri() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("CPRX.SoloMaster"));
      return null;
    }
    AgentMaster.istanza ??= new AgentMaster();
    AgentMaster.istanza.render(true);
    return AgentMaster.istanza;
  }

  // Nella barra del titolo la console si presenta come gli altri Agent —
  // «Agent — Console GM» accanto ad «Agent — Zero»: e' lo stesso apparecchio,
  // in mano a un'altra persona.
  get title() {
    return `${game.i18n.localize("CPRX.TitoloAgent")} — ${game.i18n.localize("CPRX.ConsoleMaster")}`;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    applicaTemaA(this.element);
    this.#avviaOrologio();

    // Lo scorrimento si conserva: chiudere un fascicolo o pagare qualcuno
    // non deve riportare la lista in cima.
    const schermo = this.element.querySelector(".agent-schermo");
    if (schermo) {
      schermo.scrollTop = this._scorrimento ?? 0;
      schermo.addEventListener("scroll", () => { this._scorrimento = schermo.scrollTop; });
    }
  }

  _onClose(options) {
    this.#fermaOrologio();
    super._onClose?.(options);
  }

  /** Lo stesso orologio della barra di stato dell'Agent, stesso attributo. */
  #avviaOrologio() {
    this.#fermaOrologio();
    const scrivi = () => {
      const campi = this.element?.querySelectorAll("[data-orologio]");
      if (!campi?.length) return;
      const ora = new Date();
      const testo =
        `${String(ora.getHours()).padStart(2, "0")}:${String(ora.getMinutes()).padStart(2, "0")}`;
      for (const campo of campi) campo.textContent = testo;
    };
    scrivi();
    this._orologio = window.setInterval(scrivi, 15000);
  }

  #fermaOrologio() {
    if (this._orologio) window.clearInterval(this._orologio);
    this._orologio = null;
  }

  /**
   * La marca da mettere sulla scocca per ogni linguetta. La console e' un
   * Agent anche qui: apri la banca e diventa verde NIGHT CITY TRUST, apri
   * l'NCPD e diventa blu, esattamente come sul telefono di un giocatore.
   *
   * Le linguette che sull'Agent non hanno marchio (posta, effetti, tavolo)
   * ricadono su `console`, che ha il suo — il banco resta riconoscibile.
   */
  static MARCHE = {
    banca: "banca",
    ncpd: "ncpd",
    posta: "console",
    ziggurat: "ziggurat",
    arena: "gladiator",
    tempo: "console",
    stati: "console",
    corp: "corp",
    tavolo: "console"
  };

  async _prepareContext() {
    const scheda = this.stato.scheda;
    const base = {
      schede: [
        { chiave: "banca", etichetta: game.i18n.localize("CPRX.AppBanca"),
          icona: APP.banca.icona, attiva: scheda === "banca" },
        { chiave: "ncpd", etichetta: "NCPD",
          icona: APP_ACQUISTABILI.ncpd.icona, attiva: scheda === "ncpd" },
        { chiave: "posta", etichetta: game.i18n.localize("CPRX.AppMessaggi"),
          icona: APP.messaggi.icona, attiva: scheda === "posta" },
        { chiave: "ziggurat", etichetta: "Ziggurat",
          icona: APP_ACQUISTABILI.ziggurat.icona, attiva: scheda === "ziggurat" },
        { chiave: "arena", etichetta: game.i18n.localize("CPRX.ArenaTitolo"),
          icona: APP_ACQUISTABILI.gladiator.icona, attiva: scheda === "arena" },
        { chiave: "tempo", etichetta: game.i18n.localize("CPRX.TempoTitolo"),
          icona: APP.calendario.icona, attiva: scheda === "tempo" },
        { chiave: "stati", etichetta: game.i18n.localize("CPRX.StatiTitolo"),
          icona: "fa-solid fa-wand-magic-sparkles", attiva: scheda === "stati" },
        { chiave: "corp", etichetta: APP_ACQUISTABILI.corp.nome,
          icona: APP_ACQUISTABILI.corp.icona, attiva: scheda === "corp" },
        { chiave: "tavolo", etichetta: game.i18n.localize("CPRX.Tavolo"),
          icona: "fa-solid fa-users", attiva: scheda === "tavolo" }
      ]
    };

    // Quello che sta fuori dai blocchi delle viste — barra di stato,
    // testata, linguette — legge solo da qui: e' la stessa regola che vale
    // sull'Agent per la barra di stato.
    const aperta = base.schede.find(s => s.attiva) ?? base.schede[0];
    const master = identitaMaster();

    Object.assign(base, {
      appCorrente: AgentMaster.MARCHE[scheda] ?? "console",
      etichettaScheda: aperta.etichetta,
      iconaScheda: aperta.icona,
      nomeMaster: master.nome,
      numeroMaster: master.numero,
      haIdentita: !!master.numero,
      scanlines: game.settings.get(MODULO, "scanlines") !== false
    });

    switch (scheda) {
      case "ncpd": return { ...base, ...this.#contestoNcpd() };
      case "posta": return { ...base, ...this.#contestoPosta() };
      case "tavolo": return { ...base, ...this.#contestoTavolo() };
      case "ziggurat": return { ...base, ...this.#contestoZiggurat() };
      case "arena": return { ...base, ...this.#contestoArena() };
      case "tempo": return { ...base, ...this.#contestoTempo() };
      case "stati": return { ...base, ...this.#contestoStati() };
      case "corp": return { ...base, ...this.#contestoCorp() };
      default: return { ...base, ...this.#contestoBanca() };
    }
  }

  /**
   * Il banco del tempo: che giorno e' nel mondo, i tasti per farlo passare,
   * il calendario da riempire e la coda del downtime da smaltire.
   *
   * L'orologio si muove **solo in avanti**, e i tasti lo dicono. Riportare
   * indietro `worldTime` e' un'operazione legittima di Foundry ma qui non
   * c'e': le conseguenze del tempo che passa — il canone — sono gia' state
   * pagate, e riavanzando si ripagherebbero.
   */
  #contestoTempo() {
    const ora = istante();
    const voci = calendarioVoci()
      .slice()
      .sort((a, b) => String(a.giorno).localeCompare(String(b.giorno)));

    const aperta = this.stato.fascicolo
      ? (this.stato.fascicolo === "nuovo" ? {} : voci.find(v => v.id === this.stato.fascicolo) ?? {})
      : null;

    // La coda: ogni dichiarazione ancora aperta, di chiunque. Non solo la
    // rubrica — chi ha dichiarato ha diritto a una risposta anche se dal
    // tavolo l'hanno tolto.
    const coda = [];
    for (const attore of game.actors) {
      for (const v of downtimeDi(attore)) {
        if (v.stato === "chiuso") continue;
        coda.push({
          attore: attore.id,
          id: v.id,
          nome: identita(attore).handle,
          // La chiave ordina, il numero dell'anno si mostra: due settimane
          // di anni diversi hanno lo stesso numero mostrato.
          chiave: v.settimana,
          settimana: etichettaSettimana(v.settimana),
          etichetta: game.i18n.localize(ATTIVITA[v.attivita]?.etichetta ?? "CPRX.DtAffari"),
          icona: ATTIVITA[v.attivita]?.icona ?? ATTIVITA.affari.icona,
          nota: v.nota ?? ""
        });
      }
    }
    coda.sort((a, b) => a.chiave - b.chiave || a.nome.localeCompare(b.nome));

    return {
      vistaMasterTempo: true,
      dataLunga: formattaData(ora),
      oraDelMondo: ora.toLocaleTimeString(game.i18n.lang,
        { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
      settimanaNumero: settimanaDellAnno(),
      mesiAuto: game.settings.get(MODULO, "mesiAuto") !== false,
      // Senza nessuno in rubrica il canone non tocca nessuno e gli avvisi
      // non arrivano da nessuna parte: meglio dirlo che lasciarlo scoprire.
      rubricaVuota: elencoGiocatori().length === 0,

      // I campi partono da dove si e' adesso: chi vuole spostare solo
      // l'anno cambia quattro cifre invece di riscrivere tutto.
      giornoOra: chiaveGiorno(ora),
      orarioOra: `${String(ora.getUTCHours()).padStart(2, "0")}:${
        String(ora.getUTCMinutes()).padStart(2, "0")}`,

      salti: [
        { chiave: "ora", secondi: ORA, etichetta: game.i18n.localize("CPRX.TempoUnOra") },
        { chiave: "giorno", secondi: GIORNO, etichetta: game.i18n.localize("CPRX.TempoUnGiorno") },
        { chiave: "settimana", secondi: SETTIMANA, etichetta: game.i18n.localize("CPRX.TempoUnaSettimana") }
      ],

      voci: voci.map(v => ({
        id: v.id,
        titolo: v.titolo || "—",
        riga: formattaData(daChiaveGiorno(v.giorno) ?? ora, { day: "numeric", month: "long", year: "numeric" })
      })),
      vuoto: voci.length === 0,
      scheda: aperta ? {
        nuova: this.stato.fascicolo === "nuovo",
        id: aperta.id ?? "",
        titolo: aperta.titolo ?? "",
        giorno: aperta.giorno ?? chiaveGiorno(ora),
        testo: aperta.testo ?? ""
      } : null,

      coda,
      codaVuota: coda.length === 0
    };
  }

  /** Il Database Urbano: lo sportello unico che consultano i giocatori. */
  #contestoZiggurat() {
    const voci = zigguratDb();
    const aperta = this.stato.fascicolo
      ? (this.stato.fascicolo === "nuovo" ? {} : voci.find(v => v.id === this.stato.fascicolo) ?? {})
      : null;

    return {
      vistaMasterZiggurat: true,
      vuoto: voci.length === 0,
      voci: voci.map(v => ({
        id: v.id,
        nome: v.nome || "—",
        riga: [game.i18n.localize(ZIGGURAT_CATEGORIE[v.categoria] ?? "CPRX.ZigCatServizi"),
               v.citta, v.zona].filter(Boolean).join(" · ")
      })),
      scheda: aperta ? {
        nuova: this.stato.fascicolo === "nuovo",
        id: aperta.id ?? "",
        nome: aperta.nome ?? "",
        citta: aperta.citta ?? "",
        zona: aperta.zona ?? "",
        testo: aperta.testo ?? "",
        categorie: Object.entries(ZIGGURAT_CATEGORIE).map(([chiave, etichetta]) => ({
          chiave,
          etichetta: game.i18n.localize(etichetta),
          scelta: chiave === (aperta.categoria ?? "locali")
        }))
      } : null
    };
  }

  /**
   * L'archivio aziendale e i badge del tavolo. **Corp Link si governa tutta
   * da qui**: nell'App non c'e' un solo tasto di scrittura.
   *
   * Terzo archivio condiviso dopo il casellario NCPD e il Database Urbano, e
   * per la stessa ragione: un avviso di Arasaka non e' di nessun
   * personaggio. Ci scrive solo il master — un giocatore che chiamasse
   * `scriviCorpArchivio()` fallirebbe in silenzio.
   *
   * Tre generi in un archivio solo: avvisi in bacheca, aree con la loro
   * soglia di livello, incarichi con la loro paga. Tenerli in tre
   * impostazioni voleva dire tre volte lo stesso codice.
   *
   * Sotto, chi ha un badge — e li' si assegna: Corporazione, livello,
   * sospensione. Un giocatore non si assume in Arasaka da solo.
   */
  #contestoCorp() {
    const voci = corpArchivio();
    const aperta = this.stato.fascicolo
      ? (this.stato.fascicolo === "nuovo" ? {} : voci.find(v => v.id === this.stato.fascicolo) ?? {})
      : null;

    const nomeCorp = (chiave) =>
      chiave === "*" ? game.i18n.localize("CPRX.CorpTutte")
        : (CORPORAZIONI[chiave]?.nome ?? chiave);

    // L'elenco delle Corporazioni serve due volte — nel modulo dell'archivio
    // e su ogni riga di badge — e in tutte e due i casi con la voce vuota in
    // cima: li' vuol dire «nessuna», qui «a tutte».
    const elencoCorp = (scelta, primo) => [
      primo,
      ...Object.entries(CORPORAZIONI).map(([chiave, def]) => ({
        chiave, nome: def.nome, scelta: chiave === scelta
      }))
    ];

    const badge = [];
    for (const attore of elencoGiocatori()) {
      const corp = statoCorp(attore);
      badge.push({
        attore: attore.id,
        nome: identita(attore).handle,
        corp: corp.scelta ? corp.nome : "",
        haCorp: corp.scelta,
        numero: corp.badge,
        attivo: corp.attivo,
        // Chi ha l'App installata: senza, il badge non lo vede nessuno.
        haApp: appInstallate(attore).includes("corp"),
        corporazioni: elencoCorp(corp.chiave, {
          chiave: "",
          nome: game.i18n.localize("CPRX.CorpNessuna"),
          scelta: !corp.scelta || corp.homebrew
        }),
        nomeLibero: corp.homebrew ? corp.nome : "",
        livelli: Array.from({ length: LIVELLO_CORP_MASSIMO }, (_, i) => ({
          valore: i + 1,
          scelto: corp.scelta && i + 1 === corp.livello
        }))
      });
    }

    return {
      vistaMasterCorp: true,
      vuoto: voci.length === 0,
      voci: voci.map(v => ({
        id: v.id,
        titolo: v.titolo || "—",
        riga: [game.i18n.localize(CORP_TIPI[v.tipo ?? "avviso"]?.etichetta ?? "CPRX.CorpBacheca"),
               nomeCorp(v.corp), v.tag, etichettaQuando(v.quando)].filter(Boolean).join(" · ")
      })),
      badge,
      haBadge: badge.length > 0,
      scheda: aperta ? {
        nuova: this.stato.fascicolo === "nuovo",
        id: aperta.id ?? "",
        titolo: aperta.titolo ?? "",
        testo: aperta.testo ?? "",
        tag: aperta.tag ?? "",
        livello: Number(aperta.livello) || 1,
        importo: Number(aperta.importo) || 0,
        tipi: Object.entries(CORP_TIPI).map(([chiave, def]) => ({
          chiave,
          etichetta: game.i18n.localize(def.etichetta),
          scelto: chiave === (aperta.tipo ?? "avviso")
        })),
        // «Tutte» in cima: un avviso che riguarda chiunque abbia un badge e'
        // il caso piu' frequente, non un'eccezione.
        corporazioni: elencoCorp(aperta.corp, {
          chiave: "*",
          nome: game.i18n.localize("CPRX.CorpTutte"),
          scelta: (aperta.corp ?? "*") === "*"
        })
      } : null
    };
  }

  /**
   * Gli effetti accesi sui personaggi del tavolo, e il tasto per spegnerli.
   *
   * Serve perche' nessuno di questi scade da solo in modo affidabile: il
   * consulto MedScan muore quando l'orologio del mondo passa la sua ora, e
   * se il tavolo non fa avanzare il tempo non ci arriva mai; la marcatura
   * 4Tify resta finche' non si spende il dado; la citta' di Ziggurat non
   * scade affatto. Senza questa scheda l'unico modo era la console.
   *
   * Gira su **tutti** gli attori, non sulla rubrica del tavolo: un effetto
   * si accende dall'App e non chiede il permesso a nessun elenco, quindi
   * puo' benissimo stare su un attore che in rubrica non c'e' — un NPC, un
   * personaggio appena creato, uno tolto dall'elenco dopo. Legarlo alla
   * rubrica voleva dire non poterlo piu' spegnere, che e' esattamente cio'
   * che questa scheda esiste per evitare. La rubrica decide solo l'ordine,
   * cosi' i personaggi del tavolo restano in cima.
   */
  #contestoStati() {
    const righe = [];
    const inRubrica = elencoGiocatori();
    const primi = new Set(inRubrica.map(a => a.id));
    const tutti = [...inRubrica, ...game.actors.filter(a => !primi.has(a.id))];

    for (const attore of tutti) {
      const medscan = statoMedscan(attore);
      const fortify = statoFortify(attore);
      const ziggurat = statoZiggurat(attore);
      const stati = [];

      if (medscan) {
        const def = MEDSCAN_LIVELLI[medscan.livello];
        stati.push({
          flag: "medscan",
          nome: APP_ACQUISTABILI.medscan.nome,
          testo: game.i18n.localize(def?.etichetta ?? "CPRX.MedscanPronto"),
          // Un consulto gia' scaduto resta scritto sulla scheda finche'
          // qualcuno non lo toglie: qui si vede, e si toglie.
          scaduto: medscan.scaduto,
          nota: medscan.scaduto
            ? game.i18n.localize("CPRX.StatiScaduto")
            : game.i18n.format("CPRX.StatiRestano", {
                minuti: Math.max(0, Math.round((medscan.fino - (game.time?.worldTime ?? 0)) / 60))
              })
        });
      }

      if (fortify) {
        stati.push({
          flag: "fortify",
          nome: APP_ACQUISTABILI.fortify.nome,
          testo: fortify.bersaglio,
          nota: game.i18n.localize("CPRX.StatiDadoInPiu")
        });
      }

      if (ziggurat) {
        stati.push({
          flag: "ziggurat",
          nome: APP_ACQUISTABILI.ziggurat.nome,
          testo: ziggurat.citta,
          nota: game.i18n.localize("CPRX.StatiNonScade"),
          // Si vede, ma non si spegne: e' l'App comprata, non un buff.
          fisso: true
        });
      }

      // Le App del DLC che lasciano uno stato scritto sulla scheda. Due si
      // spengono da qui, una no: Big IAAA e' l'App comprata, come Ziggurat.
      if (statoWatchbox(attore)) {
        stati.push({
          flag: "watchbox",
          nome: APP_ACQUISTABILI.watchbox.nome,
          testo: statoWatchbox(attore).stanza,
          nota: game.i18n.format("CPRX.StatiWatch", { vd: WATCHBOX_VD_FURTIVITA })
        });
      }

      const bw = statoBrainwasher(attore);
      if (bw.sessioni > 0) {
        stati.push({
          flag: "brainwasher",
          nome: APP_ACQUISTABILI.brainwasher.nome,
          testo: game.i18n.format("CPRX.BwSessione",
            { fatte: bw.sessioni, totale: BRAINWASHER_GIORNI }),
          nota: game.i18n.localize("CPRX.StatiNonScade")
        });
      }

      if (statoBigIaaa(attore)) {
        stati.push({
          flag: "bigiaaa",
          nome: APP_ACQUISTABILI.bigiaaa.nome,
          testo: `+${IAAA_BONUS_GRANDE}`,
          nota: game.i18n.localize("CPRX.StatiNonScade"),
          fisso: true
        });
      }

      if (stati.length) righe.push({ id: attore.id, nome: identita(attore).handle, stati });
    }

    return {
      vistaMasterStati: true,
      vuoto: righe.length === 0,
      righe
    };
  }

  /**
   * L'arena vista dal banco: chi ha un gladiatore, come sta andando, e la
   * possibilita' di staccare la spina a un Agent bruciato per sbaglio.
   */
  #contestoArena() {
    const righe = elencoGiocatori().map(a => {
      const glad = gladiatoreDi(a);
      const bilancio = arenaBilancio(a);
      return {
        id: a.id,
        nome: identita(a).handle,
        gladiatore: glad?.name ?? "",
        haGladiatore: !!glad,
        distrutto: agentDistrutto(a),
        ...bilancio
      };
    });

    return {
      vistaMasterArena: true,
      vuoto: righe.length === 0,
      righe,
      danno: game.settings.get(MODULO, "dannoArena") || "2d6"
    };
  }

  /** La banca del master: paga o addebita chiunque sia in rubrica. */
  #contestoBanca() {
    const giocatori = elencoGiocatori();
    const spese = giocatori.map(a => statoCasa(a));

    return {
      vistaMasterBanca: true,
      giocatori: giocatori.map((a, i) => {
        const eddies = trovaEddies(a);
        return {
          id: a.id,
          nome: identita(a).handle,
          numero: numeroDi(a) || "—",
          eddies: eddies.valore === null ? "—" : eddies.valore,
          eddiesNoti: eddies.valore !== null,
          mensile: spese[i].totale,
          arretrati: spese[i].arretrati,
          // I Punti Miglioria del Quartier Generale: li assegna il master,
          // sono quello che la squadra si e' costruita. Il giocatore li
          // spende dall'App Casa, non se li da'.
          pmqg: spese[i].pmqg
        };
      }),
      // Il canone di tutti insieme: e' il numero che serve per decidere se
      // far scattare il mese.
      canoneTavolo: spese.reduce((t, s) => t + s.totale, 0),
      vuoto: giocatori.length === 0,
      mesiAuto: game.settings.get(MODULO, "mesiAuto") !== false,
      ...this.#contestoTabelleCasa()
    };
  }

  /**
   * Alloggi e vitto: le righe del manuale col canone modificabile, piu' le
   * voci homebrew. Sta nella Banca perche' e' li' che si riscuote il mese.
   *
   * Il canone di serie resta scritto accanto a quello in vigore: chi cambia
   * un prezzo deve poter vedere da cosa e' partito, e rimetterlo a posto.
   */
  #contestoTabelleCasa() {
    const riga = (chiave, def, costo) => {
      const cambiato = def.base !== undefined && def.base !== costo;
      return {
        chiave,
        nome: etichettaCasa(def),
        costo,
        base: def.base ?? null,
        cambiato,
        homebrew: !!def.homebrew,
        // Il tasto toglie una voce homebrew o rimette il prezzo di serie:
        // su una riga del manuale mai toccata non c'e' niente da fare.
        rimovibile: !!def.homebrew || cambiato
      };
    };

    return {
      casaGruppi: [
        {
          chiave: "alloggi",
          titolo: game.i18n.localize("CPRX.CasaAlloggio"),
          segnaposto: game.i18n.localize("CPRX.CasaNuovoAlloggio"),
          voci: Object.entries(alloggi()).map(([c, d]) => riga(c, d, d.canone))
        },
        {
          chiave: "vitti",
          titolo: game.i18n.localize("CPRX.CasaVitto"),
          segnaposto: game.i18n.localize("CPRX.CasaNuovoVitto"),
          voci: Object.entries(vitti()).map(([c, d]) => riga(c, d, d.costo))
        }
      ]
    };
  }

  /**
   * Il casellario si compila qui e solo qui. Dall'Agent di un personaggio si
   * legge e basta: un telefono non mette gente nel casellario della polizia.
   */
  #contestoNcpd() {
    const voci = schedario();
    const aperta = this.stato.fascicolo
      ? (this.stato.fascicolo === "nuovo" ? {} : voci.find(v => v.id === this.stato.fascicolo) ?? {})
      : null;

    return {
      vistaMasterNcpd: true,
      vuoto: voci.length === 0,
      voci: voci.map(v => ({
        id: v.id,
        nome: v.nome || "—",
        riga: [v.alias, v.taglia ? `${v.taglia} eb` : ""].filter(Boolean).join(" · ")
      })),
      scheda: aperta ? {
        nuova: this.stato.fascicolo === "nuovo",
        id: aperta.id ?? "",
        nome: aperta.nome ?? "",
        alias: aperta.alias ?? "",
        taglia: aperta.taglia ?? "",
        mandati: aperta.mandati ?? "",
        precedenti: aperta.precedenti ?? ""
      } : null
    };
  }

  /** La posta del numero libero: chi ha scritto al master e cosa. */
  /**
   * La posta del numero libero. Tre modi di scrivere, e sono tre cose
   * diverse: a uno solo, **la stessa riga a ognuno** (fili separati, nessuno
   * sa degli altri), oppure **un gruppo** (un filo solo, tutti si vedono).
   */
  #contestoPosta() {
    const master = identitaMaster();
    const mioNumero = normalizzaNumero(master.numero);
    const fili = new Map();

    for (const voce of master.filo) {
      if (voce.tipo !== TIPO.SMS && voce.tipo !== TIPO.CHIAMATA) continue;
      const uscente = normalizzaNumero(voce.da) === mioNumero;
      const diGruppo = !!voce.idGruppo;
      const numero = diGruppo ? null : (uscente ? voce.a : voce.da);
      if (!diGruppo && !numero) continue;

      const chiave = diGruppo ? chiaveGruppo(voce.idGruppo) : numero;
      const filo = fili.get(chiave)
        ?? { chiave, numero, gruppo: diGruppo, membri: [], nomeGruppo: "", voci: [], ultimo: 0 };

      if (diGruppo) {
        const membri = membriDi(voce);
        if (membri.length) filo.membri = membri;
        if (voce.nomeGruppo) filo.nomeGruppo = voce.nomeGruppo;
      }

      filo.voci.push({ ...voce, uscente });
      filo.ultimo = Math.max(filo.ultimo, voce.quando);
      fili.set(chiave, filo);
    }

    const nomeFilo = (f) => f.gruppo
      ? (f.nomeGruppo || nomeGruppoPredefinito(f.membri))
      : (attorePerNumero(f.numero)?.name || f.numero);

    const elenco = [...fili.values()].sort((a, b) => b.ultimo - a.ultimo).map(f => ({
      chiave: f.chiave,
      gruppo: f.gruppo,
      nome: nomeFilo(f),
      anteprima: (f.voci[f.voci.length - 1].testo ?? "").slice(0, 60),
      aperto: f.chiave === this.stato.conversazione
    }));

    const aperto = fili.get(this.stato.conversazione);

    // I personaggi del tavolo si scelgono da un elenco: il master non deve
    // ricordarsi i numeri dei suoi giocatori. Le caselle servono ai due modi
    // in blocco, la tendina al messaggio singolo.
    const scelto = normalizzaNumero(this.stato.bersaglio ?? "");
    const destinatari = elencoGiocatori()
      .filter(a => numeroDi(a))
      .map(a => ({
        numero: numeroDi(a),
        nome: identita(a).handle,
        scelto: numeroDi(a) === scelto
      }));

    return {
      vistaMasterPosta: true,
      nome: master.nome,
      numero: master.numero,
      configurata: !!master.numero,
      bersaglio: this.stato.bersaglio ?? "",
      immagine: this.stato.immagine ?? "",
      destinatari,
      haDestinatari: destinatari.length > 0,
      gruppoNome: this.stato.gruppoNome ?? "",
      fili: elenco,
      haFili: elenco.length > 0,
      conversazione: aperto ? {
        chiave: aperto.chiave,
        gruppo: aperto.gruppo,
        nome: nomeFilo(aperto),
        membriTesto: aperto.gruppo
          ? aperto.membri
              .map(n => (n === mioNumero
                ? master.nome || game.i18n.localize("CPRX.GruppoIo")
                : (attorePerNumero(n)?.name || n)))
              .join(", ")
          : "",
        voci: aperto.voci.map(v => ({
          uscente: v.uscente,
          mittente: aperto.gruppo && !v.uscente
            ? (attorePerNumero(v.da)?.name || v.daNome || v.da)
            : "",
          testo: v.tipo === TIPO.CHIAMATA
            ? game.i18n.localize("CPRX.AnteprimaChiamata")
            : v.testo,
          ora: new Date(v.quando).toLocaleTimeString(game.i18n.lang,
            { hour: "2-digit", minute: "2-digit" })
        }))
      } : null
    };
  }

  /**
   * Chi sono i giocatori, con quale scheda il master vuole parlare, e la
   * loro reputazione.
   *
   * La REP sta qui e non in una scheda sua perche' e' una riga per persona,
   * come il numero: una linguetta intera per un `+1` con un motivo sarebbe
   * stata una linguetta per niente.
   */
  #contestoTavolo() {
    const dentro = new Set(elencoGiocatori().map(a => a.id));
    return {
      vistaMasterTavolo: true,
      giocatori: elencoGiocatori().map(a => {
        const { valore } = trovaReputazione(a);
        return {
          id: a.id, nome: a.name, numero: numeroDi(a) || "—",
          repNota: valore !== null,
          rep: valore,
          repLivello: valore === null ? "" : game.i18n.localize(livelloRep(valore).etichetta)
        };
      }),
      vuoto: dentro.size === 0,
      // Candidati: ogni attore con un numero che non e' gia' in rubrica.
      candidati: game.actors
        .filter(a => !dentro.has(a.id))
        .map(a => ({ id: a.id, nome: a.name, numero: numeroDi(a) || "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome))
    };
  }

  /**
   * Muove la reputazione di uno. Il motivo si scrive, e non e' un
   * optional: nel registro del sistema la colonna c'e', e una riga senza
   * motivo fra sei mesi non dice niente a nessuno.
   *
   * Il master possiede ogni scheda, quindi scrive diretto — e passa da
   * `deltaLedgerProperty()`, che aggiorna valore e registro insieme.
   */
  static async #onRepMuovi(event, target) {
    const attore = game.actors.get(target.dataset.id);
    if (!attore) return;

    const quanto = Number(target.dataset.quanto);
    const motivo = (this.element.querySelector(
      `[name="repMotivo-${target.dataset.id}"]`)?.value ?? "").trim();

    if (!(await muoviReputazione(attore, quanto, motivo))) {
      ui.notifications.warn(game.i18n.localize("CPRX.RepNonScrivibile"));
      return;
    }

    const campo = this.element.querySelector(`[name="repMotivo-${target.dataset.id}"]`);
    if (campo) campo.value = "";

    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  static #onScheda(event, target) {
    this.stato.scheda = target.dataset.scheda;
    this.stato.conversazione = null;
    this.stato.fascicolo = null;
    this.render();
  }

  /* --- casellario NCPD --------------------------------------------- */

  static #onFascicoloNuovo() {
    this.stato.fascicolo = "nuovo";
    this.render();
  }

  static #onFascicoloApri(event, target) {
    this.stato.fascicolo = target.dataset.id;
    this.render();
  }

  static #onFascicoloAnnulla() {
    this.stato.fascicolo = null;
    this.render();
  }

  /* --- Database Urbano e arena ------------------------------------- */

  static async #onZigSalva() {
    const leggi = (nome) => (this.element.querySelector(`[name="${nome}"]`)?.value ?? "").trim();
    const nome = leggi("zigNome");
    if (!nome) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    const dati = {
      nome,
      citta: leggi("zigCitta"),
      zona: leggi("zigZona"),
      categoria: leggi("zigCategoria") || "locali",
      testo: leggi("zigTesto")
    };

    const voci = zigguratDb();
    if (this.stato.fascicolo === "nuovo") {
      voci.push({ id: foundry.utils.randomID(), ...dati });
    } else {
      const indice = voci.findIndex(v => v.id === this.stato.fascicolo);
      if (indice >= 0) voci[indice] = { ...voci[indice], ...dati };
    }

    await scriviZigguratDb(voci);
    this.stato.fascicolo = null;
    this.render();
  }

  /**
   * I Punti Miglioria del Quartier Generale. Li da' il master: sono quello
   * che la squadra si e' costruita, non una cosa che si compra. Il giocatore
   * li spende dall'App Casa.
   *
   * Non scendono sotto zero e non si riprendono i punti gia' spesi: se il
   * master toglie punti a chi ha gia' costruito, quello che ha costruito
   * resta — smontarlo e' una scelta del giocatore.
   */
  static async #onCasaPmqg(event, target) {
    const attore = game.actors.get(target.dataset.id);
    if (!attore) return;

    const delta = Number(target.dataset.delta) || 0;
    const attuale = attore.getFlag(MODULO, "casa") ?? {};
    const punti = Math.max(0, (Number(attuale.pmqg) || 0) + delta);

    await attore.setFlag(MODULO, "casa", { ...attuale, pmqg: punti });
    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  /* --- Corp Link: archivio aziendale e badge --- */

  static async #onCorpAvvisoSalva() {
    const leggi = (nome) => (this.element.querySelector(`[name="${nome}"]`)?.value ?? "").trim();
    const titolo = leggi("corpTitolo");
    if (!titolo) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    const tipo = CORP_TIPI[leggi("corpTipo")] ? leggi("corpTipo") : "avviso";
    const dati = {
      tipo,
      titolo,
      testo: leggi("corpTesto"),
      tag: leggi("corpTag"),
      corp: leggi("corpDestinataria") || "*",
      // Un accesso porta la soglia, un incarico la paga: le due chiavi
      // restano sulla voce anche quando non le legge nessuno, e costano
      // meno di tre archivi da tenere allineati.
      livello: Math.max(1, Math.min(LIVELLO_CORP_MASSIMO, Number(leggi("corpLivelloArea")) || 1)),
      importo: Math.max(0, Math.floor(Number(leggi("corpImporto")) || 0))
    };

    const voci = corpArchivio();
    if (this.stato.fascicolo === "nuovo") {
      voci.push({ id: foundry.utils.randomID(), quando: Date.now(), ...dati });
    } else {
      const indice = voci.findIndex(v => v.id === this.stato.fascicolo);
      if (indice >= 0) voci[indice] = { ...voci[indice], ...dati };
    }

    await scriviCorpArchivio(voci);
    this.stato.fascicolo = null;
    this.render();
  }

  static async #onCorpAvvisoElimina(event, target) {
    const id = target.dataset.id;
    await scriviCorpArchivio(corpArchivio().filter(v => v.id !== id));
    if (this.stato.fascicolo === id) this.stato.fascicolo = null;
    this.render();
  }

  /**
   * Assegna il badge: Corporazione e livello. Il master possiede ogni
   * scheda, quindi scrive diretto — nessuna busta, come per l'accredito
   * della banca.
   *
   * Il nome scritto a mano vince sull'elenco: se hai preso la penna, e'
   * quello che volevi. Con l'elenco su «nessuna» e il campo vuoto il badge
   * si toglie del tutto.
   */
  static async #onCorpAssegna(event, target) {
    const attore = game.actors.get(target.dataset.attore);
    if (!attore) return;

    const riga = target.closest("[data-riga]") ?? this.element;
    const leggi = (nome) => (riga.querySelector(`[name="${nome}"]`)?.value ?? "").trim();

    const chiave = CORPORAZIONI[leggi("corpQuale")] ? leggi("corpQuale") : "";
    const nome = leggi("corpNomeLibero");
    const attuale = attore.getFlag(MODULO, "corp") ?? {};

    await attore.setFlag(MODULO, "corp", {
      ...attuale,
      chiave: nome ? "" : chiave,
      nome: nome || "",
      colore: nome ? (attuale.colore || COLORI_CORP[0]) : "",
      livello: Math.max(1, Math.min(LIVELLO_CORP_MASSIMO, Number(leggi("corpLivelloBadge")) || 2))
    });

    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  /**
   * Sospende o riattiva un badge. Un badge sospeso non apre piu' niente: e'
   * il senso di sospenderlo, e lo fa l'azienda — che al tavolo e' il master.
   */
  static async #onCorpSospendi(event, target) {
    const attore = game.actors.get(target.dataset.attore);
    if (!attore) return;

    const attuale = attore.getFlag(MODULO, "corp") ?? {};
    await attore.setFlag(MODULO, "corp", { ...attuale, attivo: attuale.attivo === false });
    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  /**
   * Installa o toglie Corp Link sull'Agent di qualcuno. E' l'App che mette
   * il datore di lavoro, quindi il tasto sta qui e non nello Store del
   * giocatore. Resta comprata per sempre, come tutte: toglierla e' toglierla
   * dalla schermata.
   */
  static async #onCorpApp(event, target) {
    const attore = game.actors.get(target.dataset.attore);
    if (!attore) return;

    const installate = appInstallate(attore);
    const ce = installate.includes("corp");

    if (ce) {
      await attore.setFlag(MODULO, "appInstallate", installate.filter(c => c !== "corp"));
    } else {
      await attore.setFlag(MODULO, "appPossedute",
        [...new Set([...appPossedute(attore), "corp"])]);
      await attore.setFlag(MODULO, "appInstallate", [...installate, "corp"]);
    }

    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  /* --- tempo, calendario, downtime --- */

  /**
   * Fa passare il tempo del mondo. Chiama `game.time.advance` e basta: le
   * conseguenze — canone, avvisi — non stanno qui ma nell'hook
   * `updateWorldTime`, cosi' scattano anche quando l'orologio lo muove
   * qualcun altro (un modulo di calendario, una macro, la barra di Foundry).
   */
  static async #onTempoAvanza(event, target) {
    const secondi = Number(target.dataset.secondi);
    if (!Number.isFinite(secondi) || secondi <= 0) return;

    try {
      await game.time.advance(secondi);
    } catch (errore) {
      console.warn("cprx-agent | tempo non avanzabile:", errore);
      return;
    }
    this.render();
  }

  /** Salta al primo del mese prossimo. Il conto sta in `secondiAlMeseProssimo()`. */
  static async #onTempoMese() {
    const secondi = secondiAlMeseProssimo();
    if (secondi <= 0) return;

    try {
      await game.time.advance(secondi);
    } catch (errore) {
      console.warn("cprx-agent | tempo non avanzabile:", errore);
      return;
    }
    this.render();
  }

  /**
   * Mette la data a mano. Chi ambienta nel 2045 e chi nel 2074 non deve
   * arrivarci a colpi di «+1 mese»: si scrive dove si vuole stare e ci si
   * va, avanti o indietro che sia.
   *
   * Il salto e' marcato con `SALTO_MANUALE`, quindi **non fa scattare
   * niente**: nessun canone, nessun avviso. Spostare l'ambientazione di
   * trent'anni non e' trent'anni di affitto non pagato.
   */
  static async #onTempoImposta() {
    const leggi = (nome) => (this.element.querySelector(`[name="${nome}"]`)?.value ?? "").trim();
    const quando = tempoDaData(leggi("tempoGiorno"), leggi("tempoOrario") || "00:00");

    if (quando === null) {
      ui.notifications.warn(game.i18n.localize("CPRX.TempoDataStorta"));
      return;
    }

    const delta = quando - (game.time?.worldTime ?? 0);
    if (delta === 0) return;

    // Indietro si torna, ma vale la pena dirlo: quello che e' gia' successo
    // resta successo, e riavanzando il mese riscatta.
    if (delta < 0) {
      const conferma = await AgentMaster.#chiediConferma(
        game.i18n.localize("CPRX.TempoImposta"),
        game.i18n.localize("CPRX.TempoIndietroTesto")
      );
      if (!conferma) return;
    }

    try {
      await game.time.advance(delta, { [SALTO_MANUALE]: true });
    } catch (errore) {
      console.warn("cprx-agent | data non impostabile:", errore);
      return;
    }

    ui.notifications.info(game.i18n.format("CPRX.TempoImpostata", {
      data: formattaData(istante())
    }));
    this.render();
  }

  /** L'interruttore del canone automatico, dalla console invece che dalle impostazioni. */
  static async #onTempoAuto() {
    await game.settings.set(MODULO, "mesiAuto",
      !(game.settings.get(MODULO, "mesiAuto") !== false));
    this.render();
  }

  static async #onCalSalva() {
    const leggi = (nome) => (this.element.querySelector(`[name="${nome}"]`)?.value ?? "").trim();
    const titolo = leggi("calTitolo");
    if (!titolo) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    // Il campo e' un `input type="date"`, che parla gia' in `YYYY-MM-DD`:
    // e' la stessa chiave con cui gli eventi si agganciano ai giorni.
    const giorno = leggi("calGiorno");
    if (!daChiaveGiorno(giorno)) {
      ui.notifications.warn(game.i18n.localize("CPRX.TempoDataStorta"));
      return;
    }

    const dati = { titolo, giorno, testo: leggi("calTesto") };
    const voci = calendarioVoci();

    if (this.stato.fascicolo === "nuovo") {
      voci.push({ id: foundry.utils.randomID(), ...dati });
    } else {
      const indice = voci.findIndex(v => v.id === this.stato.fascicolo);
      if (indice >= 0) voci[indice] = { ...voci[indice], ...dati };
    }

    await scriviCalendario(voci);
    this.stato.fascicolo = null;
    this.render();
  }

  static async #onCalElimina(event, target) {
    const conferma = await AgentMaster.#chiediConferma(
      game.i18n.localize("CPRX.Elimina"),
      game.i18n.localize("CPRX.ConfermaElimina")
    );
    if (!conferma) return;

    await scriviCalendario(calendarioVoci().filter(v => v.id !== target.dataset.id));
    this.stato.fascicolo = null;
    this.render();
  }

  /**
   * Chiude una settimana di downtime: il master scrive l'esito e la voce
   * smette di essere modificabile dal giocatore. Scrive diretto sulla sua
   * scheda — il master la possiede — senza buste ne' client eletti.
   */
  static async #onDtChiudi(event, target) {
    const attore = game.actors.get(target.dataset.attore);
    if (!attore) return;

    const esito = (this.element.querySelector(
      `[name="dtEsito-${target.dataset.id}"]`)?.value ?? "").trim();

    const voci = downtimeDi(attore).map(v => v.id === target.dataset.id
      ? { ...v, stato: "chiuso", esito, chiuso: Date.now() }
      : v);

    await scriviDowntime(attore, voci);
    await segnaAvviso(attore, {
      genere: "downtime",
      titolo: game.i18n.localize("CPRX.AvvisoDowntime"),
      testo: esito || game.i18n.localize("CPRX.DtChiusaSenzaEsito")
    });

    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  static async #onZigElimina(event, target) {
    const conferma = await AgentMaster.#chiediConferma(
      game.i18n.localize("CPRX.ConfermaEliminaTitolo"),
      game.i18n.localize("CPRX.ConfermaEliminaTesto")
    );
    if (!conferma) return;

    await scriviZigguratDb(zigguratDb().filter(v => v.id !== target.dataset.id));
    this.stato.fascicolo = null;
    this.render();
  }

  /**
   * Spegne un effetto. Il master possiede ogni scheda, quindi scrive
   * diretto — nessuna busta, nessun client eletto.
   */
  static async #onRevocaStato(event, target) {
    const attore = game.actors.get(target.dataset.id);
    const flag = target.dataset.flag;

    // Ziggurat e Big IAAA non sono in elenco di proposito: sono le App
    // comprate, non buff che qualcuno ti stacca.
    if (!attore || !["medscan", "fortify", "watchbox", "brainwasher"].includes(flag)) return;

    try {
      await attore.unsetFlag(MODULO, flag);
      await spegniEffetto(attore, flag);
    } catch (errore) {
      console.error("cprx-agent | stato non revocabile:", errore);
      return;
    }

    ui.notifications.info(game.i18n.format("CPRX.StatiRevocato", { nome: attore.name }));
    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  /**
   * Fa scattare il mese a mano. Il conto sta in `riscuotiMese()`, che ha
   * due chiamanti: questo tasto e il calendario. Il tasto resta anche col
   * canone automatico acceso — un mese si puo' sempre voler far pagare
   * fuori tempo.
   */
  static async #onRiscuotiMese() {
    const conferma = await AgentMaster.#chiediConferma(
      game.i18n.localize("CPRX.CasaRiscuoti"),
      game.i18n.localize("CPRX.CasaRiscuotiTesto")
    );
    if (!conferma) return;

    const esito = await riscuotiMese();
    ui.notifications.info(game.i18n.format("CPRX.CasaRiscosso", esito));
    this.render();
  }

  /** Azzera gli arretrati di uno: ha saldato, o il master ha condonato. */
  static async #onCondona(event, target) {
    const attore = game.actors.get(target.dataset.id);
    if (!attore) return;

    const attuale = attore.getFlag(MODULO, "casa") ?? {};
    await attore.setFlag(MODULO, "casa", { ...attuale, arretrati: 0 });
    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  /* --- alloggi e vitto: manuale e homebrew --- */

  /**
   * Cambia il prezzo di una riga. Per una voce del manuale scrive uno
   * scostamento in `canoni` — la tabella in codice non si tocca, cosi'
   * rimettere il prezzo di serie e' togliere una chiave; per una homebrew
   * riscrive nome e costo.
   */
  static async #onCasaSalvaVoce(event, target) {
    const chiave = target.dataset.chiave;
    const elenco = target.dataset.elenco === "vitti" ? "vitti" : "alloggi";
    const riga = target.closest("[data-riga]");
    if (!chiave || !riga) return;

    const costo = Math.max(0, Math.floor(Number(riga.querySelector('[name="costo"]')?.value)));
    if (!Number.isFinite(costo)) {
      ui.notifications.warn(game.i18n.localize("CPRX.BancaImportoNonValido"));
      return;
    }

    const dati = casaExtra();
    const homebrew = dati[elenco].find(v => v.chiave === chiave);

    if (homebrew) {
      const nome = (riga.querySelector('[name="nome"]')?.value ?? "").trim();
      homebrew.nome = nome || homebrew.nome;
      homebrew[elenco === "vitti" ? "costo" : "canone"] = costo;
      await scriviCasaExtra({ [elenco]: dati[elenco] });
    } else {
      await scriviCasaExtra({ canoni: { ...dati.canoni, [chiave]: costo } });
    }

    ridisegnaTutte();
  }

  static async #onCasaEliminaVoce(event, target) {
    const chiave = target.dataset.chiave;
    const elenco = target.dataset.elenco === "vitti" ? "vitti" : "alloggi";
    const dati = casaExtra();

    // Una voce del manuale non si cancella: si rimette il prezzo di serie.
    if (dati[elenco].some(v => v.chiave === chiave)) {
      await scriviCasaExtra({ [elenco]: dati[elenco].filter(v => v.chiave !== chiave) });
    } else {
      const canoni = { ...dati.canoni };
      delete canoni[chiave];
      await scriviCasaExtra({ canoni });
    }

    ridisegnaTutte();
  }

  static async #onCasaAggiungi(event, target) {
    const elenco = target.dataset.elenco === "vitti" ? "vitti" : "alloggi";
    const riga = target.closest("[data-riga]");
    const nome = (riga?.querySelector('[name="nomeNuovo"]')?.value ?? "").trim();
    const costo = Math.max(0, Math.floor(Number(riga?.querySelector('[name="costoNuovo"]')?.value) || 0));

    if (!nome) {
      ui.notifications.warn(game.i18n.localize("CPRX.CasaSenzaNome"));
      return;
    }

    const dati = casaExtra();
    await scriviCasaExtra({
      [elenco]: [...dati[elenco], {
        chiave: `x-${foundry.utils.randomID(8)}`,
        nome,
        [elenco === "vitti" ? "costo" : "canone"]: costo
      }]
    });

    ridisegnaTutte();
  }

  /** Rimette in piedi un Agent bruciato: il master non paga il prezzo. */
  static async #onRiparaDaConsole(event, target) {
    const attore = game.actors.get(target.dataset.id);
    if (!attore) return;

    await attore.unsetFlag(MODULO, "agentDistrutto");
    await attore.setFlag(MODULO, "appInstallate", appPossedute(attore));
    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  static async #onFascicoloSalva() {
    const leggi = (nome) => (this.element.querySelector(`[name="${nome}"]`)?.value ?? "").trim();
    const nome = leggi("schedaNome");
    if (!nome) {
      ui.notifications.warn(game.i18n.localize("CPRX.CampoObbligatorio"));
      return;
    }

    const dati = {
      nome,
      alias: leggi("schedaAlias"),
      taglia: leggi("schedaTaglia"),
      mandati: leggi("schedaMandati"),
      precedenti: leggi("schedaPrecedenti")
    };

    const voci = schedario();
    if (this.stato.fascicolo === "nuovo") {
      voci.push({ id: foundry.utils.randomID(), ...dati });
    } else {
      const indice = voci.findIndex(v => v.id === this.stato.fascicolo);
      if (indice >= 0) voci[indice] = { ...voci[indice], ...dati };
    }

    await scriviSchedario(voci);
    this.stato.fascicolo = null;
    this.render();
  }

  static async #onFascicoloElimina(event, target) {
    const conferma = await AgentMaster.#chiediConferma(
      game.i18n.localize("CPRX.ConfermaEliminaTitolo"),
      game.i18n.localize("CPRX.ConfermaEliminaTesto")
    );
    if (!conferma) return;

    await scriviSchedario(schedario().filter(v => v.id !== target.dataset.id));
    this.stato.fascicolo = null;
    this.render();
  }

  static async #chiediConferma(titolo, contenuto) {
    try {
      return await foundry.applications.api.DialogV2.confirm({
        window: { title: titolo },
        content: `<p>${contenuto}</p>`,
        rejectClose: false,
        modal: true
      });
    } catch (errore) {
      return window.confirm(`${titolo}\n\n${contenuto}`);
    }
  }

  /**
   * Il master accredita o addebita direttamente: possiede ogni scheda,
   * quindi non serve nessuna busta — scrive e basta, e segna il registro.
   */
  static async #onPaga(event, target) {
    const attore = game.actors.get(target.dataset.id);
    if (!attore) return;

    const riga = target.closest("[data-riga]");
    const importo = Math.floor(Number(riga?.querySelector('[name="importo"]')?.value ?? 0));
    const causale = (riga?.querySelector('[name="causale"]')?.value ?? "").trim();
    const segno = target.dataset.segno === "meno" ? -1 : 1;

    if (!Number.isFinite(importo) || importo <= 0) {
      ui.notifications.warn(game.i18n.localize("CPRX.BancaImportoNonValido"));
      return;
    }

    if (!(await accredita(attore, segno * importo))) {
      ui.notifications.warn(game.i18n.localize("CPRX.BancaNonApplicabile"));
      return;
    }

    await segnaMovimento(attore, {
      id: foundry.utils.randomID(),
      quando: Date.now(),
      importo: segno * importo,
      causale,
      controparte: game.i18n.localize("CPRX.BancaFixer")
    });

    ui.notifications.info(game.i18n.format("CPRX.BancaFatto", {
      quanto: segno * importo, nome: attore.name
    }));

    Agent.istanze.get(attore.id)?.render();
    this.render();
  }

  static async #onAggiungiGiocatore(event, target) {
    const scelto = this.element.querySelector('[name="candidato"]')?.value || target.dataset.id;
    if (!scelto) return;
    const ids = [...new Set([...elencoGiocatori().map(a => a.id), scelto])];
    await scriviElencoGiocatori(ids);
    this.render();
  }

  static async #onTogliGiocatore(event, target) {
    await scriviElencoGiocatori(elencoGiocatori().map(a => a.id).filter(id => id !== target.dataset.id));
    this.render();
  }

  static async #onSalvaIdentita() {
    const nome = (this.element.querySelector('[name="nomeLibero"]')?.value ?? "").trim();
    const numero = normalizzaNumero(this.element.querySelector('[name="numeroLibero"]')?.value ?? "");

    if (numero && attorePerNumero(numero)) {
      ui.notifications.warn(game.i18n.localize("CPRX.NumeroGiaPreso"));
      return;
    }

    await scriviIdentitaMaster({ nome, numero });
    this.render();
  }

  /** Un numero libero pescato a caso, che non sia gia' di qualcuno. */
  static async #onRigeneraIdentita() {
    const usati = rubricaNumeri();
    const prefisso = prefissoNumeri();
    for (let passo = 0; passo < 10000; passo++) {
      const candidato = `${prefisso}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      if (usati.has(candidato)) continue;
      await scriviIdentitaMaster({ numero: candidato });
      this.render();
      return;
    }
    ui.notifications.error(game.i18n.localize("CPRX.NumeriEsauriti"));
  }

  /** Apre l'Agent vero di un attore: da li' il master scrive come lui. */
  static #onImpersona(event, target) {
    const attore = game.actors.get(target.dataset.id);
    if (attore) Agent.apri(attore);
  }

  static #onApriFilo(event, target) {
    // La chiave e' un numero, oppure `g:<id>` se il filo e' un gruppo.
    this.stato.conversazione = target.dataset.chiave ?? target.dataset.numero;
    this.render();
  }

  /**
   * Manda un'immagine nel filo. Il selettore di file c'e' **solo qui**: il
   * master puo' gia' caricare file ovunque in Foundry, quindi non gli si
   * sta dando niente di nuovo. Dall'Agent di un giocatore non si carica
   * niente, e la regola del progetto resta in piedi dove conta.
   *
   * `FilePicker` e' dichiarata con `class` e vive nell'ambiente lessicale
   * globale: va referenziata nuda e protetta da `typeof`, perche'
   * `globalThis.FilePicker` restituisce `undefined`.
   */
  static async #onMandaImmagine() {
    if (typeof FilePicker === "undefined") {
      ui.notifications.warn(game.i18n.localize("CPRX.ImmagineNonDisponibile"));
      return;
    }

    const scelta = await new Promise((risolvi) => {
      const selettore = new FilePicker({
        type: "image",
        callback: (percorso) => risolvi(percorso),
        close: () => risolvi(null)
      });
      selettore.render(true);
    });
    if (!scelta) return;

    this.stato.immagine = scelta;
    this.render();
  }

  static #onTogliImmagine() {
    this.stato.immagine = "";
    this.render();
  }

  /**
   * Scrive dal numero libero. Non c'e' nessuna scheda dalla parte del
   * mittente: la busta parte con `daMaster`, e il postino ne archivia una
   * copia nell'impostazione di mondo oltre che sulla scheda di chi riceve.
   */
  static async #onScriviLibero() {
    const master = identitaMaster();
    if (!master.numero) {
      ui.notifications.warn(game.i18n.localize("CPRX.IdentitaMancante"));
      return;
    }

    const testo = (this.element.querySelector('[name="testoLibero"]')?.value ?? "").trim();
    const immagine = this.stato.immagine ?? "";
    if (!testo && !immagine) return;

    // Se il filo aperto e' un gruppo, il tasto d'invio scrive li' dentro:
    // e' quello che ci si aspetta da una finestra di conversazione aperta.
    const aperto = this.stato.conversazione;
    if (eChiaveGruppo(aperto)) {
      if (!(await this.#scriviAlGruppoAperto(aperto, testo, immagine))) return;
      this.stato.immagine = "";
      this.render();
      return;
    }

    // L'elenco del tavolo ha la precedenza; il campo libero serve a chi nel
    // tavolo non c'e'; il filo aperto e' l'ultimo ripiego.
    const numero = normalizzaNumero(
      this.element.querySelector('[name="destinatario"]')?.value
      || this.element.querySelector('[name="bersaglio"]')?.value
      || aperto
      || "");
    const destinatario = attorePerNumero(numero);
    if (!destinatario) {
      ui.notifications.warn(game.i18n.format("CPRX.NumeroInesistente", { numero: numero || "—" }));
      return;
    }

    await invia({
      tipo: TIPO.SMS,
      testo,
      immagine,
      da: master.numero,
      a: numero,
      daNome: master.nome,
      daAttore: null,
      aAttore: destinatario,
      daMaster: true,
      // Un numero senza scheda non ha una rubrica dove nascondersi.
      anonimo: false
    });

    this.stato.conversazione = numero;
    this.stato.immagine = "";
    this.render();
  }

  /** I numeri spuntati nell'elenco del tavolo, piu' quelli scritti a mano. */
  #destinatariSpuntati() {
    const master = normalizzaNumero(identitaMaster().numero);

    const spuntati = [...this.element.querySelectorAll('[name^="mdest-"]')]
      .filter(c => c.checked)
      .map(c => normalizzaNumero(c.name.slice("mdest-".length)));

    const sciolti = (this.element.querySelector('[name="bersaglio"]')?.value ?? "")
      .split(/[,;\s]+/)
      .map(n => normalizzaNumero(n))
      .filter(Boolean);

    return [...new Set([...spuntati, ...sciolti])].filter(n => n && n !== master);
  }

  /**
   * La stessa riga a ognuno, in fili separati: nessuno dei destinatari sa
   * degli altri. E' l'opposto del gruppo, ed e' il motivo per cui sono due
   * tasti e non un'opzione dentro allo stesso.
   */
  static async #onScriviTutti() {
    const master = identitaMaster();
    if (!master.numero) {
      ui.notifications.warn(game.i18n.localize("CPRX.IdentitaMancante"));
      return;
    }

    const testo = (this.element.querySelector('[name="testoLibero"]')?.value ?? "").trim();
    const immagine = this.stato.immagine ?? "";
    if (!testo && !immagine) return;

    const numeri = this.#destinatariSpuntati();
    if (!numeri.length) {
      ui.notifications.warn(game.i18n.localize("CPRX.PostaNessunSpuntato"));
      return;
    }

    let mandati = 0;
    const spenti = [];

    for (const numero of numeri) {
      const destinatario = attorePerNumero(numero);
      if (!destinatario) { spenti.push(numero); continue; }

      await invia({
        tipo: TIPO.SMS,
        testo,
        immagine,
        da: master.numero,
        a: numero,
        daNome: master.nome,
        daAttore: null,
        aAttore: destinatario,
        daMaster: true,
        anonimo: false
      });
      mandati += 1;
    }

    if (spenti.length) {
      ui.notifications.warn(game.i18n.format("CPRX.GruppoNumeriSpenti",
        { numeri: spenti.join(", ") }));
    }
    if (mandati) {
      ui.notifications.info(game.i18n.format("CPRX.PostaMandatiSeparati", { quanti: mandati }));
    }

    this.stato.immagine = "";
    this.render();
  }

  /**
   * Un filo solo con dentro tutti, il master compreso: si vedono fra loro e
   * rispondono a tutti. Il gruppo nasce con la prima riga — non c'e' nessun
   * registro dei gruppi da creare prima.
   */
  static async #onScriviGruppo() {
    const master = identitaMaster();
    if (!master.numero) {
      ui.notifications.warn(game.i18n.localize("CPRX.IdentitaMancante"));
      return;
    }

    const testo = (this.element.querySelector('[name="testoLibero"]')?.value ?? "").trim();
    const immagine = this.stato.immagine ?? "";
    if (!testo && !immagine) return;

    const numeri = this.#destinatariSpuntati();
    if (numeri.length < 2) {
      ui.notifications.warn(game.i18n.localize("CPRX.GruppoPochiMembri"));
      return;
    }

    const nome = (this.element.querySelector('[name="gruppoNomeMaster"]')?.value ?? "").trim();
    const idGruppo = foundry.utils.randomID();
    const mio = normalizzaNumero(master.numero);

    const fatto = await spedisciAlGruppo({
      idGruppo,
      nomeGruppo: nome,
      membri: [mio, ...numeri],
      testo,
      immagine,
      da: mio,
      daNome: master.nome,
      daMaster: true
    });
    if (!fatto) return;

    this.stato.conversazione = chiaveGruppo(idGruppo);
    this.stato.gruppoNome = "";
    this.stato.immagine = "";
    this.render();
  }

  /** Scrive dentro un gruppo gia' aperto nella colonna dei fili. */
  async #scriviAlGruppoAperto(chiave, testo, immagine) {
    const master = identitaMaster();
    const idGruppo = idGruppoDa(chiave);

    // I membri sono quelli dell'ultima voce del gruppo nell'archivio del
    // numero libero: e' li' che il postino tiene la copia del master.
    const voci = master.filo.filter(v => v.idGruppo === idGruppo);
    const ultima = voci[voci.length - 1];
    if (!ultima) return false;

    return spedisciAlGruppo({
      idGruppo,
      nomeGruppo: ultima.nomeGruppo ?? "",
      membri: membriDi(ultima),
      testo,
      immagine,
      da: normalizzaNumero(master.numero),
      daNome: master.nome,
      daMaster: true
    });
  }
}

/* ------------------------------------------------------------------ */
/* Impostazioni                                                         */
/* ------------------------------------------------------------------ */

function ridisegnaTutte() {
  for (const finestra of Agent.istanze.values()) {
    if (finestra.rendered) finestra.render();
  }
  if (AgentMaster.istanza?.rendered) AgentMaster.istanza.render();
}

Hooks.once("init", () => {
  game.settings.register(MODULO, "tema", {
    name: "CPRX.ImpostazioneTema", hint: "CPRX.ImpostazioneTemaNota",
    scope: "client", config: true, type: String, choices: TEMI,
    default: "notte", onChange: () => ridisegnaTutte()
  });

  game.settings.register(MODULO, "accento", {
    name: "CPRX.ImpostazioneAccento", hint: "CPRX.ImpostazioneAccentoNota",
    scope: "client", config: true, type: String, default: "",
    onChange: () => ridisegnaTutte()
  });

  game.settings.register(MODULO, "percorsoEddies", {
    name: "CPRX.ImpostazionePercorsoEddies", hint: "CPRX.ImpostazionePercorsoEddiesNota",
    scope: "world", config: true, type: String, default: "",
    onChange: () => ridisegnaTutte()
  });

  game.settings.register(MODULO, "compendiNegozio", {
    name: "CPRX.ImpostazioneCompendi", hint: "CPRX.ImpostazioneCompendiNota",
    scope: "world", config: true, type: String, default: "",
    onChange: () => { svuotaCatalogo(); ridisegnaTutte(); }
  });

  game.settings.register(MODULO, "posizioneTasto", {
    name: "CPRX.ImpostazionePosizione", hint: "CPRX.ImpostazionePosizioneNota",
    scope: "client", config: true, type: String,
    choices: {
      navigazione: "CPRX.PosizioneNavigazione",
      flottante: "CPRX.PosizioneFlottante",
      nessuno: "CPRX.PosizioneNessuno"
    },
    default: "navigazione", onChange: () => inserisciTasto()
  });

  game.settings.register(MODULO, "tastoBarra", {
    name: "CPRX.ImpostazioneTastoBarra", hint: "CPRX.ImpostazioneTastoBarraNota",
    scope: "client", config: true, type: Boolean, default: false
  });

  // Le righe di scansione e la spazzata luminosa sul vetro. Chi le trova
  // fastidiose le spegne; con `prefers-reduced-motion` la spazzata si ferma
  // da sola, senza toccare niente.
  game.settings.register(MODULO, "scanlines", {
    name: "CPRX.ImpostazioneScanlines", hint: "CPRX.ImpostazioneScanlinesNota",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => ridisegnaTutte()
  });

  // L'Agent e' un oggetto: di serie serve averlo in inventario per aprirlo.
  // Chi lo da' per scontato a tutti spegne questa e il vincolo sparisce.
  game.settings.register(MODULO, "richiediOggetto", {
    name: "CPRX.ImpostazioneRichiediOggetto", hint: "CPRX.ImpostazioneRichiediOggettoNota",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => { inserisciTasto(); ridisegnaTutte(); }
  });

  game.settings.register(MODULO, "avvisaModifiche", {
    name: "CPRX.ImpostazioneAvvisa", hint: "CPRX.ImpostazioneAvvisaNota",
    scope: "client", config: true, type: Boolean, default: true
  });

  /* --- rete --- */

  game.settings.register(MODULO, "prefissoNumeri", {
    name: "CPRX.ImpostazionePrefisso", hint: "CPRX.ImpostazionePrefissoNota",
    scope: "world", config: true, type: String, default: "555"
  });

  game.settings.register(MODULO, "prezzoAgent", {
    name: "CPRX.ImpostazionePrezzoAgent", hint: "CPRX.ImpostazionePrezzoAgentNota",
    scope: "world", config: true, type: Number, default: 100
  });

  game.settings.register(MODULO, "avanzaTempo", {
    name: "CPRX.ImpostazioneAvanzaTempo", hint: "CPRX.ImpostazioneAvanzaTempoNota",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULO, "suoni", {
    name: "CPRX.ImpostazioneSuoni", hint: "CPRX.ImpostazioneSuoniNota",
    scope: "client", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULO, "apriSuChiamata", {
    name: "CPRX.ImpostazioneApriSuChiamata", hint: "CPRX.ImpostazioneApriSuChiamataNota",
    scope: "client", config: true, type: Boolean, default: true
  });

  // Di serie spenta: coperto vuol dire coperto per tutti, GM compreso. Chi
  // vuole tenere il tavolo sotto controllo la accende e vede i numeri veri.
  game.settings.register(MODULO, "gmVedeCoperti", {
    name: "CPRX.ImpostazioneGmCoperti", hint: "CPRX.ImpostazioneGmCopertiNota",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => ridisegnaTutte()
  });

  game.settings.register(MODULO, "limiteFilo", {
    name: "CPRX.ImpostazioneLimiteFilo", hint: "CPRX.ImpostazioneLimiteFiloNota",
    scope: "world", config: true, type: Number, default: 300
  });

  // Il casellario dell'NCPD. Scrive solo il GM, dall'App stessa.
  game.settings.register(MODULO, "ncpdSchedario", {
    scope: "world", config: false, type: Object, default: { voci: [] },
    onChange: () => ridisegnaTutte()
  });

  // Oltre questa reputazione il nome gira da solo: non serve conoscerti
  // per sapere chi sei. La tabella dei livelli sta in codice — e' il
  // manuale — ma dove cade il confine della fama lo decide il tavolo.
  game.settings.register(MODULO, "repPubblica", {
    name: "CPRX.ImpostazioneRepPubblica", hint: "CPRX.ImpostazioneRepPubblicaNota",
    scope: "world", config: true, type: Number, default: 5,
    onChange: () => ridisegnaTutte()
  });

  // Il giorno su cui cade `worldTime` zero: da qui il modulo ricava la data
  // vera. Di serie il 2045, l'anno in cui comincia Cyberpunk RED.
  game.settings.register(MODULO, "dataZero", {
    name: "CPRX.ImpostazioneDataZero", hint: "CPRX.ImpostazioneDataZeroNota",
    scope: "world", config: true, type: String, default: "2045-01-01",
    onChange: () => ridisegnaTutte()
  });

  // L'archivio aziendale di Corp Link: avvisi, accessi e incarichi. Terzo
  // archivio condiviso dopo il casellario NCPD e il Database Urbano, e per
  // la stessa ragione: quello che dice una Corporazione non e' di nessun
  // personaggio.
  game.settings.register(MODULO, "corpArchivio", {
    scope: "world", config: false, type: Array, default: [],
    onChange: () => ridisegnaTutte()
  });

  // Il calendario condiviso: lo compila il master dalla console.
  game.settings.register(MODULO, "calendario", {
    scope: "world", config: false, type: Object, default: { voci: [] },
    onChange: () => ridisegnaTutte()
  });

  // Il canone che scatta col calendario. Prima il mese lo faceva partire
  // solo il tasto del master, di proposito: un automatismo appeso
  // all'orologio del mondo non succede mai, se il tempo non avanza. Adesso
  // il tempo lo fa avanzare la console, quindi l'automatismo ha senso — ma
  // il tasto resta, e questo interruttore lo spegne.
  game.settings.register(MODULO, "mesiAuto", {
    name: "CPRX.ImpostazioneMesiAuto", hint: "CPRX.ImpostazioneMesiAutoNota",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ridisegnaTutte()
  });

  // Alloggi e vitto homebrew, piu' i canoni del manuale cambiati dal master.
  game.settings.register(MODULO, "casaExtra", {
    scope: "world", config: false, type: Object,
    default: { alloggi: [], vitti: [], canoni: {} },
    onChange: () => ridisegnaTutte()
  });

  // Il Corporativo ha casa e vitto pagati dall'azienda: si riconosce dal
  // ruolo sulla scheda. Chi non vuole l'automatismo la spegne e assegna la
  // casa a mano dalla spunta sull'Agent.
  game.settings.register(MODULO, "corpGratis", {
    name: "CPRX.ImpostazioneCorpGratis", hint: "CPRX.ImpostazioneCorpGratisNota",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ridisegnaTutte()
  });

  // Il danno di un colpo in arena. Non e' l'arma vera del gladiatore: e'
  // la taratura dello scontro, e si cambia se i duelli durano troppo.
  game.settings.register(MODULO, "dannoArena", {
    name: "CPRX.ImpostazioneDannoArena", hint: "CPRX.ImpostazioneDannoArenaNota",
    scope: "world", config: true, type: String, default: "2d6"
  });

  // Il Database Urbano di Ziggurat. Ci scrive il master, dalla console.
  game.settings.register(MODULO, "zigguratDb", {
    scope: "world", config: false, type: Object, default: { voci: [] },
    onChange: () => ridisegnaTutte()
  });

  // La bacheca di Garden: il Data Pool locale del tavolo. E' l'unico
  // archivio condiviso su cui scrivono anche i giocatori — ma non
  // direttamente: i post passano dalla busta e li deposita il postino.
  game.settings.register(MODULO, "gardenPatch", {
    scope: "world", config: false, type: Object, default: { voci: [] },
    onChange: () => ridisegnaTutte()
  });

  // La rubrica di lavoro del master: gli attori che gestisce sempre.
  game.settings.register(MODULO, "elencoGiocatori", {
    scope: "world", config: false, type: Object, default: { ids: [] },
    onChange: () => ridisegnaTutte()
  });

  // L'identita' libera del master, per scrivere da un numero senza scheda.
  game.settings.register(MODULO, "identitaMaster", {
    scope: "world", config: false, type: Object,
    default: { nome: "", numero: "", filo: [] },
    onChange: () => ridisegnaTutte()
  });

  game.modules.get(MODULO).api = {
    Agent, AgentMaster, APP, APP_ACQUISTABILI, TEMI, TIPO,
    elencoGiocatori, scriviElencoGiocatori, identitaMaster, scriviIdentitaMaster,
    movimenti, accredita,
    leggiVoci, scriviVoci, trovaEddies, svuotaCatalogo, diagnostica,
    trovaReputazione, muoviReputazione,
    numeroDi, assegnaNumero, assegnaNumeri, attorePerNumero, normalizzaNumero,
    invia, traffico, conversazioni, filo,
    schedario, scriviSchedario, consegnaArretrati
  };
});

/** Da macro, per dare un numero a tutti gli attori che non ce l'hanno. */
async function assegnaNumeri({ soloPersonaggi = false } = {}) {
  const assegnati = [];
  for (const attore of game.actors) {
    if (numeroDi(attore)) continue;
    if (!attore.isOwner) continue;
    if (soloPersonaggi && attore.type !== "character") continue;
    const numero = await assegnaNumero(attore);
    if (numero) assegnati.push(`${attore.name}: ${numero}`);
  }
  console.log("cprx-agent | numeri assegnati:", assegnati);
  ui.notifications.info(game.i18n.format("CPRX.NumeriAssegnati", { quanti: assegnati.length }));
  return assegnati;
}


/** Da lanciare in console quando qualcosa non torna. */
function diagnostica(attore) {
  attore = attore ?? attoreCorrente();
  if (!attore) return console.warn("Nessun attore selezionato.");
  const esito = trovaEddies(attore);
  console.log("--- Agent, diagnostica ---");
  console.log("Attore:", attore.name);
  console.log("Eddies:", esito.valore, "| origine:", esito.origine ?? "nessuna");
  console.log("Numero:", numeroDi(attore) || "nessuno");
  console.log("App possedute:", appPossedute(attore));
  console.log("App installate:", appInstallate(attore));
  console.log("Agent distrutto:", agentDistrutto(attore), "| interno:", haAgentInterno(attore));
  console.log("Agent in inventario:", haOggettoAgent(attore),
    "| puo' aprirlo:", puoAvereAgent(attore));
  console.log("Numeri coperti:", [...numeriCoperti(attore)].length);
  console.log("Voci archiviate:", filo(attore).length,
    "| in giacenza:", giacenza(attore).length,
    "| non letti:", messaggiNonLetti(attore));
  console.log("Applicante eletto:", game.users.get(applicanteDi(attore))?.name ?? "nessuno");
  console.log("Sono il postino:", sonoIlPostino());
  console.log("Schedario NCPD:", schedario().length, "voci");
  return esito;
}

/* ------------------------------------------------------------------ */
/* Punti di accesso                                                     */
/* ------------------------------------------------------------------ */

function attoreCorrente() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

/**
 * Il master senza token selezionato non ha un Agent personale da aprire:
 * gli si apre la console. Un giocatore in quella condizione riceve l'avviso
 * di sempre, perche' per lui non c'e' niente da aprire.
 */
function apriAgentGiusto() {
  const attore = attoreCorrente();
  if (attore) return Agent.apri(attore);
  if (game.user.isGM) return AgentMaster.apri();
  return Agent.apri(null);
}

function inserisciTasto() {
  document.getElementById("cprx-agent-tasto")?.remove();

  const modo = game.settings.get(MODULO, "posizioneTasto");
  if (modo === "nessuno") return;

  // Niente Agent in tasca, niente tasto. Il master lo vede sempre: senza
  // token selezionato gli apre la console, che non e' di nessun attore.
  if (!game.user.isGM && !puoAvereAgent(attoreCorrente())) return;

  const tasto = document.createElement("button");
  tasto.id = "cprx-agent-tasto";
  tasto.type = "button";
  tasto.className = `cprx-tasto cprx-tasto--${modo}`;
  tasto.title = game.i18n.localize("CPRX.ApriAgent");
  tasto.innerHTML = `<i class="fa-solid fa-mobile-screen-button"></i><span>AGENT</span>`;
  tasto.addEventListener("click", () => apriAgentGiusto());

  const alto = document.getElementById("ui-top");
  if (modo === "navigazione" && alto) alto.appendChild(tasto);
  else document.body.appendChild(tasto);
}

Hooks.once("ready", async () => {
  inserisciTasto();

  // Il personaggio assegnato all'utente deve essere raggiungibile anche se
  // non ha ancora aperto l'Agent. Gli altri prendono il numero all'apertura.
  const mio = game.user?.character;
  if (mio?.isOwner && !numeroDi(mio)) await assegnaNumero(mio);

  // Chi apre per primo fra i GM svuota la giacenza: la posta arrivata mentre
  // non c'era nessun postino viene archiviata adesso.
  await consegnaArretrati();
});

/** Se il postino si scollega, il prossimo GM eredita la giacenza. */
Hooks.on("userConnected", () => {
  if (game.user.isGM) consegnaArretrati();
});
Hooks.on("renderSceneNavigation", () => inserisciTasto());

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.settings.get(MODULO, "tastoBarra")) return;
  const gruppo = controls.find(c => c.name === "token");
  if (!gruppo) return;

  gruppo.tools.push({
    name: "cprx-agent", title: "CPRX.ApriAgent",
    icon: "fa-solid fa-mobile-screen-button", button: true,
    onClick: () => apriAgentGiusto()
  });
});

/**
 * Il tasto dipende da chi hai selezionato e da cosa ha in tasca: va
 * rifatto quando cambia l'uno o l'altro. Senza questo resta appeso allo
 * stato di quando e' comparso — visibile su un personaggio che l'Agent non
 * ce l'ha, o assente su uno che l'ha appena comprato.
 */
Hooks.on("controlToken", () => inserisciTasto());

for (const evento of ["createItem", "deleteItem"]) {
  Hooks.on(evento, (oggetto) => {
    if (!NOMI_AGENT.test(oggetto?.name ?? "")) return;
    if (oggetto.parent?.id !== attoreCorrente()?.id) return;
    inserisciTasto();
  });
}

Hooks.on("getActorSheetHeaderButtons", (scheda, bottoni) => {
  const attore = scheda.document ?? scheda.actor;
  if (!attore?.isOwner) return;
  if (!puoAvereAgent(attore)) return;

  bottoni.unshift({
    label: "Agent", class: "cprx-agent-scheda",
    icon: "fa-solid fa-mobile-screen-button",
    onclick: () => Agent.apri(attore)
  });
});

Hooks.on("updateActor", (attore, cambi, opzioni, idUtente) => {
  const nostri = foundry.utils.getProperty(cambi, `flags.${MODULO}`);
  if (!nostri) return;

  const finestra = Agent.istanze.get(attore.id);
  if (finestra?.rendered) finestra.render();
  // Il saldo di un giocatore cambia sotto gli occhi del master.
  if (AgentMaster.istanza?.rendered) AgentMaster.istanza.render();

  if (idUtente === game.user.id) return;
  if (!attore.isOwner) return;
  if (!game.settings.get(MODULO, "avvisaModifiche")) return;

  // Il postino riscrive il filo a ogni messaggio: per quello l'avviso c'e'
  // gia', ed e' quello del messaggio. La banca ha il suo avviso quando
  // arrivano i soldi. Qui interessano solo le modifiche a mano, tipo un
  // lavoro aggiunto dal master.
  //
  // `calendario` e `casa` sono zitte per lo stesso motivo: quando il tempo
  // avanza il modulo scrive su tutte le schede del tavolo in un colpo, e
  // l'avviso lo dava gia' la notifica dentro l'Agent. Senza, un mese che
  // scatta seppellisce il tavolo di finestrelle.
  const zitte = new Set(["filo", "letti", "banca", "calendario", "casa"]);
  const chiavi = Object.keys(nostri);
  if (chiavi.length && chiavi.every(c => zitte.has(c))) return;

  ui.notifications.info(game.i18n.format("CPRX.AvvisoAggiornamento", { nome: attore.name }));
});

/**
 * L'orologio del mondo si e' mosso. Le conseguenze stanno qui e non nei
 * tasti della console di proposito: cosi' scattano anche se a muovere il
 * tempo e' qualcos'altro — la barra di Foundry, una macro, un altro modulo
 * di calendario. `tempoAvanzato()` fa passare un GM solo.
 */
Hooks.on("updateWorldTime", async (nuovo, delta, opzioni) => {
  try {
    await tempoAvanzato(nuovo, delta, opzioni);
  } catch (errore) {
    console.error("cprx-agent | conseguenze del tempo non applicate:", errore);
  }
  AgentMaster.istanza?.render();
  for (const finestra of Agent.istanze.values()) if (finestra.rendered) finestra.render();
});

/**
 * La busta arriva a tutti i client. Ognuno fa la sua parte e una sola:
 * il postino la archivia e la cancella, l'applicante scrive le conseguenze
 * sulla scheda che le subisce, il destinatario suona e avvisa.
 */
Hooks.on("createChatMessage", async (messaggio) => {
  const f = messaggio.flags?.[MODULO];
  if (!f?.tipo) return;

  // Duello perso: il perdente si brucia l'Agent da solo.
  if (f.perdente) {
    const perdente = game.actors.get(f.perdente);
    if (perdente && toccaAMe(perdente)) {
      const conseguenze = await bruciaAgent(perdente);
      if (conseguenze.length) {
        await annuncia(perdente, APP_ACQUISTABILI.gladiator.icona,
          APP_ACQUISTABILI.gladiator.nome, conseguenze.join(" "));
      }
    }
  }

  // Accredito in banca: soldi sulla scheda piu' una riga di registro, e
  // tutti e due li scrive il client eletto per quella scheda.
  if (f.accredito?.su) {
    const beneficiario = game.actors.get(f.accredito.su);
    if (beneficiario && toccaAMe(beneficiario)) {
      try {
        if (await accredita(beneficiario, f.accredito.importo)) {
          await segnaMovimento(beneficiario, {
            id: f.idVoce,
            quando: f.quando ?? Date.now(),
            importo: f.accredito.importo,
            causale: f.accredito.causale ?? "",
            controparte: f.accredito.controparte ?? ""
          });
        } else {
          console.warn("cprx-agent | accredito non scrivibile su", beneficiario.name);
        }
      } catch (errore) {
        console.error("cprx-agent | accredito fallito:", errore);
      }
    }
  }

  // Effetti che vanno scritti su una scheda che il mittente non possiede.
  if (f.applica?.su) {
    const bersaglio = game.actors.get(f.applica.su);
    if (bersaglio && toccaAMe(bersaglio)) {
      try {
        await bersaglio.setFlag(MODULO, f.applica.flag, f.applica.valore);

        // Se quel flag ha un effetto sulla scheda, lo accende lo stesso
        // client: e' l'unico che possiede il bersaglio.
        if (f.applica.effetto) {
          await accendiEffetto(bersaglio, f.applica.flag, f.applica.effetto);
        }
      } catch (errore) {
        console.error("cprx-agent | conseguenza non applicabile:", errore);
      }
    }
  }

  // Un cuore su Garden: la bacheca e' un'impostazione di mondo, quindi lo
  // scrive un GM — lo stesso eletto che fa il postino, altrimenti con tre
  // GM collegati il cuore verrebbe messo e tolto tre volte.
  if (f.gardenCuore?.id && sonoIlPostino()) {
    const voci = gardenPatch();
    const voce = voci.find(v => v.id === f.gardenCuore.id);
    if (voce) {
      const cuori = Array.isArray(voce.cuori) ? voce.cuori : [];
      const numero = f.gardenCuore.numero;
      const nuovi = cuori.includes(numero)
        ? cuori.filter(n => n !== numero)
        : [...cuori, numero];
      await scriviGardenPatch(voci.map(v =>
        (v.id === voce.id ? { ...v, cuori: nuovi } : v)));
    }
  }

  const autore = messaggio.author?.id ?? messaggio.user?.id;

  if (autore !== game.user.id) avvisaDestinatario(f);

  // Per ultimo, cosi' chi doveva leggerla l'ha gia' letta.
  if (sonoIlPostino()) await consegna(messaggio);
  else for (const id of [f.daAttore, f.aAttore]) {
    const finestra = id ? Agent.istanze.get(id) : null;
    if (finestra?.rendered) finestra.render();
  }
});

/** Suono e notifica per chi riceve, con il numero coperto se e' coperto. */
function avvisaDestinatario(f) {
  const destinatario = f.aAttore ? game.actors.get(f.aAttore) : null;
  if (!destinatario || !toccaAMe(destinatario)) return;
  if (agentDistrutto(destinatario)) return;

  const nome = (f.anonimo && !vedoInChiaro())
    ? game.i18n.localize("CPRX.Sconosciuto")
    : (f.daNome || f.da);

  switch (f.tipo) {
    case TIPO.SMS:
      suona(SUONO_MESSAGGIO);
      ui.notifications.info(game.i18n.format("CPRX.AvvisoMessaggio", { nome }));
      break;

    case TIPO.CHIAMATA:
      if (f.stato !== "squilla") break;
      suona(SUONO_CHIAMATA);
      ui.notifications.info(game.i18n.format("CPRX.AvvisoChiamata", { nome }));
      if (game.settings.get(MODULO, "apriSuChiamata")) Agent.apri(destinatario);
      break;

    case TIPO.SFIDA:
      if (f.stato !== "invito") break;
      suona(SUONO_MESSAGGIO);
      ui.notifications.info(game.i18n.format("CPRX.AvvisoSfida", { nome }));
      break;

    case TIPO.SERVIZIO:
      suona(SUONO_MESSAGGIO);
      ui.notifications.info(game.i18n.format("CPRX.AvvisoRisposta", { titolo: f.titolo ?? "" }));
      break;
  }
}

/**
 * Le buste non si vedono mai in chat, nemmeno per un istante e nemmeno dal
 * GM: la corrispondenza sta nell'Agent. Quelle che restano in giacenza sono
 * comunque nascoste, quindi il log resta pulito anche senza un postino.
 */
Hooks.on("renderChatMessage", (messaggio, html) => {
  if (!messaggio.flags?.[MODULO]?.tipo) return;

  const elemento = html?.[0] ?? html;
  if (!elemento?.style) return;

  elemento.style.display = "none";
});

Hooks.on("getActorDirectoryEntryContext", (html, voci) => {
  voci.push({
    name: game.i18n.localize("CPRX.ApriAgent"),
    icon: '<i class="fa-solid fa-mobile-screen-button"></i>',
    condition: (li) => {
      const attore = game.actors.get(li.data("documentId"));
      return !!attore?.isOwner && puoAvereAgent(attore);
    },
    callback: (li) => Agent.apri(game.actors.get(li.data("documentId")))
  });
});

/* ------------------------------------------------------------------ */
/* Uso da macro                                                        */
/*                                                                     */
/*   const api = game.modules.get("cprx-agent").api;                   */
/*   api.Agent.apri(game.actors.getName("Zero"));                      */
/*                                                                     */
/* Regalare un'App senza farla pagare:                                 */
/*   const a = game.actors.getName("Zero");                            */
/*   await a.setFlag("cprx-agent", "appPossedute", ["ncpd"]);          */
/*   await a.setFlag("cprx-agent", "appInstallate", ["ncpd"]);         */
/* ------------------------------------------------------------------ */
