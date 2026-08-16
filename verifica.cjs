/**
 * Compila agent.hbs e lo rende una volta per ogni vista, con un helper
 * `localize` che segna le chiavi non trovate nel file di lingua.
 *
 * Gli errori di blocchi non chiusi ({{#unless}} chiuso con {{/if}}) e le
 * chiavi di lingua dimenticate non si vedono altrimenti fino a runtime.
 *
 *   node verifica.cjs
 *
 * Handlebars non serve installarlo: sta gia' dentro Foundry. Se l'eseguibile
 * e' altrove, e' l'unico percorso da cambiare.
 */
const fs = require("fs");
const path = require("path");

const Handlebars = require("D:/Foundry/FoundryV12/Code/resources/app/node_modules/handlebars");

const RADICE = __dirname;
const sorgente = fs.readFileSync(path.join(RADICE, "templates/agent.hbs"), "utf8");
const it = JSON.parse(fs.readFileSync(path.join(RADICE, "lang/it.json"), "utf8"));

const mancanti = new Set();
Handlebars.registerHelper("localize", (chiave) => {
  if (typeof chiave !== "string") return "";
  if (!(chiave in it)) mancanti.add(chiave);
  return it[chiave] ?? chiave;
});

const modello = Handlebars.compile(sorgente);

const base = {
  nomeAttore: "Zero", immagine: "a.png", puoScrivere: true, eGm: true,
  // Il dock sta fuori dalle viste: come la barra di stato, legge da qui.
  dock: [
    { app: "telefono", icona: "i", etichetta: "Phone", attiva: true, conteggio: 1 },
    { app: "messaggi", icona: "i", etichetta: "Messaggi", attiva: false },
    { app: "telefono", scheda: "contatti", icona: "i", etichetta: "Contatti", attiva: false },
    { app: "lavori", icona: "i", etichetta: "Incarichi", attiva: false }
  ],
  numeroMio: "555-0142", bentornato: "Bentornato, Zero",
  // Lo sfondo si rende fuori dalle viste, come la barra di stato.
  sfondo: "modules/cprx-agent/assets/sfondi/nightcity.jpg", sfondoVisibile: true,
  etichettaApp: "App", iconaApp: "fa-solid fa-x", descrizione: "descrizione",
  produttore: "Segotari", chiaveApp: "gladiator", appCorrente: "home"
};

const viste = {
  // La prima accensione: cinque passi, e ognuno accende un blocco diverso.
  // Il dock non c'e' — come sul vetro di blocco, non c'e' niente da aprire.
  vistaSetupAvvio: {
    vistaSetup: true, appCorrente: "setup", dock: null,
    _con: ['data-action="setupAvanti"', "agent-setup-punto"],
    _senza: ["agent-dock", 'data-action="setupIndietro"'],
    setupAvvio: true, setupPrimo: true, setupUltimo: false,
    setupPunti: [{ chiave: "avvio", fatto: true }, { chiave: "identita", fatto: false }],
    modello: "Agent · Pocket", seriale: "CR-I77-ZRV", numero: "555-0142"
  },
  vistaSetupIdentita: {
    vistaSetup: true, appCorrente: "setup", dock: null,
    _con: ['data-action="setupIndietro"', 'name="handle"', "agent-setup-anteprima"],
    setupIdentita: true, setupPrimo: false, setupUltimo: false,
    setupPunti: [{ chiave: "avvio", fatto: true }, { chiave: "identita", fatto: true }],
    handle: "Zero", nomeVero: "Anna Vega", salutoHandle: true,
    salutoAnteprima: "Bentornato, Zero"
  },
  vistaSetupAspetto: {
    vistaSetup: true, appCorrente: "setup", dock: null,
    _con: ['data-action="scegliTema"', 'data-action="sfondo"'],
    setupAspetto: true, setupPrimo: false, setupUltimo: false,
    setupPunti: [{ chiave: "avvio", fatto: true }],
    temi: [{ chiave: "notte", etichetta: "Notte", attivo: true }],
    sfondi: [
      { chiave: "", etichetta: "Nessuno", url: "", scelto: false },
      { chiave: "nightcity", etichetta: "Night City", url: "a.jpg", scelto: true }
    ]
  },
  // Un Corporativo non sceglie dove vive: glielo da' l'azienda.
  vistaSetupCasa: {
    vistaSetup: true, appCorrente: "setup", dock: null,
    _con: ['name="alloggio"', 'name="vitto"'],
    setupCasa: true, setupPrimo: false, setupUltimo: false,
    setupPunti: [{ chiave: "avvio", fatto: true }],
    corporativo: false, totale: 1500,
    alloggi: [{ chiave: "conapt", etichetta: "Conapt", canone: 1000, scelto: true }],
    vitti: [{ chiave: "generico", etichetta: "Generico", costo: 500, scelto: true }]
  },
  vistaSetupCasaCorp: {
    vistaSetup: true, appCorrente: "setup", dock: null,
    _senza: ['name="alloggio"'],
    setupCasa: true, setupPrimo: false, setupUltimo: false,
    setupPunti: [{ chiave: "avvio", fatto: true }],
    corporativo: true, alloggi: [], vitti: []
  },
  vistaSetupDispositivo: {
    vistaSetup: true, appCorrente: "setup", dock: null,
    _con: ['name="agentInterno"', 'name="gps"'],
    setupDispositivo: true, setupPrimo: false, setupUltimo: true,
    setupPunti: [{ chiave: "avvio", fatto: true }],
    agentInterno: false, gps: true
  },
  vistaBlocco: {
    dataLunga: "venerdi' 08 agosto", nomeBlocco: "Zero", nonLetti: 3, numeroMio: "555-0142"
  },
  // Sul vetro di blocco il dock non c'e': non c'e' niente da aprire.
  vistaBloccoSenzaDock: {
    vistaBlocco: true, dock: null,
    _senza: ["agent-dock"],
    dataLunga: "venerdi' 08 agosto", nomeBlocco: "Zero", nonLetti: 0, numeroMio: "555-0142"
  },
  vistaBloccoLetto: {
    vistaBlocco: true,
    dataLunga: "venerdi' 08 agosto", nomeBlocco: "Zero", nonLetti: 0, numeroMio: "555-0142"
  },
  vistaBanca: {
    appCorrente: "banca",
    _con: ["app-banca", "agent-carta-chip", "agent-flusso", 'data-action="filtroBanca"',
           'data-action="bancaPannello"'],
    eddies: 999280, eddiesNoti: true, eddiesOrigine: "system.wealth.value",
    intestatario: "Zero", numeroMio: "555-0142", bersaglio: "",
    numeroCarta: "4471 \u00b7\u00b7 \u00b7\u00b7 8820", scadenzaCarta: "08/79", seriale: "CR-I77-ZRV",
    bancaModulo: "", bancaInvio: false, bancaRichiesta: false, bancaCarta: false,
    settimana: [{ etichetta: "GIO", dentro: 40, fuori: 10 }, { etichetta: "VEN", dentro: 0, fuori: 100 }],
    nettoSettimana: 1900, entrateMese: 48200, usciteMese: 12750,
    filtriBanca: [
      { chiave: "tutti", etichetta: "Tutti", attiva: true },
      { chiave: "entrate", etichetta: "Entrate", attiva: false }
    ],
    vuoto: false,
    giorni: [{
      giorno: "VEN 08 AGO", saldoTesto: "+1900", positivo: true,
      righe: [
        { entrata: true, importo: "+2400", segno: "i", causale: "Lavoro Watson", controparte: "Fixer", ora: "01:52" },
        { entrata: false, importo: "\u2212500", segno: "i", causale: "MedScan", controparte: "", ora: "22:10" }
      ]
    }]
  },
  /* Il pannello del bonifico si apre da un tasto: chiuso non c'e'. */
  vistaBancaInvio: {
    vistaBanca: true, appCorrente: "banca",
    _con: ['data-action="bancaInvia"'],
    eddies: 100, eddiesNoti: true, intestatario: "Zero", numeroMio: "555-0142",
    bersaglio: "", numeroCarta: "0000 \u00b7\u00b7 \u00b7\u00b7 0000", scadenzaCarta: "01/79",
    seriale: "CR-000-000", bancaModulo: "invia", bancaInvio: true,
    bancaRichiesta: false, bancaCarta: false,
    settimana: [], nettoSettimana: 0, entrateMese: 0, usciteMese: 0,
    filtriBanca: [], vuoto: true, giorni: []
  },
  vistaBancaVuota: {
    vistaBanca: true, eddies: "\u2014", eddiesNoti: false, intestatario: "Zero",
    numeroMio: "555-0142", bersaglio: "", numeroCarta: "0000 \u00b7\u00b7 \u00b7\u00b7 0000",
    scadenzaCarta: "01/79", seriale: "CR-000-000", bancaModulo: "", bancaInvio: false,
    bancaRichiesta: false, bancaCarta: false,
    settimana: [], nettoSettimana: 0, entrateMese: 0, usciteMese: 0,
    filtriBanca: [], vuoto: true, giorni: []
  },
  /* Corp Link. La schermata di scelta e le quattro linguette: tre non
     leggono niente di archiviato, e infatti nei casi qui sotto arrivano
     senza nessuna sorgente dietro. */
  /* Senza badge non c'e' niente da mostrare e niente da premere: la
     Corporazione la assegna il master dalla console. */
  vistaCorpSenzaBadge: {
    vistaCorp: true, appCorrente: "corp", corpSenzaBadge: true, eGm: true,
    _con: ["app-corp", "agent-corp-badge"],
    _senza: ['data-action="corpScheda"', 'data-action="corpScegli"']
  },
  vistaCorpBacheca: {
    vistaCorp: true, appCorrente: "corp", corpSetup: false,
    _con: ['data-action="corpScheda"', "agent-corp-badge", "agent-marchietto"],
    corp: {
      scelta: true, chiave: "arasaka", homebrew: false, nome: "Arasaka",
      glifo: "亜", colore: "#e03b3b", settore: "Sicurezza corporativa",
      qg: "Tokyo, Giappone", uffici: "Ovunque", note: "Tre fazioni interne.",
      dirigente: "Hanako Arasaka", impiegati: "1 000 000",
      livello: 2, badge: "774-A", attivo: true
    },
    corpStato: "Valido", corpHaScheda: true,
    corpSchede: [
      { chiave: "bacheca", etichetta: "Bacheca", attiva: true },
      { chiave: "accessi", etichetta: "Accessi", attiva: false }
    ],
    corpBachecaAperta: true,
    avvisi: [{ id: "a1", titolo: "Protocollo di sicurezza", testo: "Badge a ogni varco.",
               tag: "OBBLIGO", quando: "12/08" }],
    haAvvisi: true, accessi: [], incarichi: [], haIncarichi: false, benefit: []
  },
  /* Badge sospeso: nessuna area aperta, e la scheda della Corporazione non
     c'e' perche' e' una inventata al tavolo. */
  vistaCorpAccessi: {
    vistaCorp: true, appCorrente: "corp", corpSetup: false,
    _con: ["agent-corp-accesso"],
    corp: {
      scelta: true, chiave: "", homebrew: true, nome: "Kang Tao",
      glifo: "K", colore: "#8fa8c8", settore: "Corporazione indipendente",
      qg: "", uffici: "", note: "", dirigente: "", impiegati: "",
      livello: 1, badge: "112-C", attivo: false
    },
    corpStato: "Sospeso", corpHaScheda: false,
    corpSchede: [{ chiave: "accessi", etichetta: "Accessi", attiva: true }],
    corpAccessiAperta: true,
    accessi: [
      { chiave: "atrio", nome: "Atrio", nota: "Orari d'ufficio.", livello: 1, aperto: false },
      { chiave: "eliporto", nome: "Eliporto", nota: "Solo dirigenza.", livello: 5, aperto: false }
    ],
    avvisi: [], haAvvisi: false, incarichi: [], haIncarichi: false, benefit: []
  },
  vistaCorpIncarichi: {
    vistaCorp: true, appCorrente: "corp", corpSetup: false,
    // Gli incarichi li mette l'azienda: si leggono, non si aprono.
    _con: ["agent-voce-cifra", "agent-corp-incarico"],
    _senza: [`data-action="modifica"`],
    corp: {
      scelta: true, chiave: "militech", homebrew: false, nome: "Militech International",
      glifo: "▼", colore: "#4a7fe0", settore: "Armi", qg: "Washington D.C.",
      uffici: "Roma, Zurigo", note: "Nazionalizzata e poi no.",
      dirigente: "Donald Lundee", impiegati: "350 000", livello: 3, badge: "301-F", attivo: true
    },
    etichettaApp: "Militech International",
    corpStato: "Valido", corpHaScheda: true,
    corpSchede: [{ chiave: "incarichi", etichetta: "Incarichi", attiva: true }],
    corpIncarichiAperta: true,
    incarichi: [{ id: "l1", titolo: "Scorta a un dirigente",
                  testo: "Trasferimento notturno da Japantown a Northside.",
                  tag: "SICUREZZA", importo: 6500 }],
    haIncarichi: true, avvisi: [], haAvvisi: false, accessi: [], benefit: []
  },
  vistaCorpBenefit: {
    vistaCorp: true, appCorrente: "corp", corpSetup: false,
    _con: ["agent-corp-benefit"],
    corp: {
      scelta: true, chiave: "traumateam", homebrew: false, nome: "Trauma Team",
      glifo: "✚", colore: "#ff2e6e", settore: "Paramedici", qg: "Seattle",
      uffici: "Nord America", note: "Neutrale durante la Guerra.",
      dirigente: "Bob Jones", impiegati: "15 000", livello: 4, badge: "550-B", attivo: true
    },
    corpStato: "Valido", corpHaScheda: true,
    corpSchede: [{ chiave: "benefit", etichetta: "Benefit", attiva: true }],
    corpBenefitAperta: true,
    benefit: [
      { chiave: "medica", nome: "Copertura medica", nota: "A carico dell'azienda.", attivo: true },
      { chiave: "buonuscita", nome: "Buonuscita", nota: "Gradi alti.", attivo: false }
    ],
    avvisi: [], haAvvisi: false, accessi: [], incarichi: [], haIncarichi: false
  },
  vistaCasa: {
    appCorrente: "casa",
    _con: ["app-casa", 'data-action="casaScegli"', 'data-action="casaPaga"',
           'data-action="casaMiglioria"', "agent-qg-riga"],
    alloggio: "conapt", vitto: "generico", corporativo: false,
    canone: 1000, cibo: 500, totale: 1500, arretrati: 0, sconto: 0, haSconto: false,
    etichettaAlloggio: "Conapt", etichettaVitto: "Cibo generico",
    alloggi: [{ chiave: "conapt", etichetta: "Conapt", canone: 1000, scelto: true }],
    vitti: [{ chiave: "generico", etichetta: "Cibo generico", costo: 500, scelto: true }],
    eddies: 9000, eddiesNoti: true, scoperto: false, haArretrati: false,
    puoPagare: true, pmqg: 80,
    migliorieVoci: [
      { chiave: "riduzione", nome: "Riduzione dell'affitto", nota: "Un terzo in meno.",
        costo: 40, attiva: false, alPrezzo: false },
      { chiave: "orto", nome: "Orto idroponico", nota: "Verdure fresche.",
        costo: 40, attiva: true, alPrezzo: false }
    ],
    storico: [], haStorico: false,
    ultimoTesto: "08/08/2077"
  },
  /* Con una miglioria che sconta, il totale non torna con le tabelle: la
     riga che lo dice deve esserci, altrimenti sembra un errore. */
  vistaCasaScontata: {
    vistaCasa: true, alloggio: "conapt", vitto: "generico", corporativo: false,
    _con: ["agent-riga-stato"],
    canone: 670, cibo: 400, totale: 1070, arretrati: 0, sconto: 430, haSconto: true,
    etichettaAlloggio: "Conapt", etichettaVitto: "Cibo generico",
    alloggi: [], vitti: [], eddies: 9000, eddiesNoti: true, scoperto: false,
    haArretrati: false, puoPagare: true, pmqg: 0,
    migliorieVoci: [{ chiave: "riduzione", nome: "Riduzione dell'affitto",
                      nota: "Un terzo in meno.", costo: 40, attiva: true, alPrezzo: false }],
    storico: [{ quando: "01/08", importo: -1070, controparte: "Padrone di casa" }],
    haStorico: true, ultimoTesto: "01/08/2077"
  },
  vistaCasaCorporativo: {
    vistaCasa: true, alloggio: "conaptCorp", vitto: "buono", corporativo: true,
    canone: 0, cibo: 0, totale: 0, arretrati: 0,
    etichettaAlloggio: "Conapt corporativo", etichettaVitto: "Cibo buono",
    alloggi: [{ chiave: "conaptCorp", etichetta: "Conapt corporativo", canone: 2000, scelto: true }],
    vitti: [{ chiave: "buono", etichetta: "Cibo buono", costo: 1000, scelto: true }],
    eddies: 500, eddiesNoti: true, scoperto: false, haArretrati: false,
    // Un Corporativo non sceglie dove vive e non paga: casa e vitto glieli
    // da' l'azienda. Il Quartier Generale invece resta — quello e' della
    // squadra, non del datore di lavoro.
    _senza: ['data-action="casaScegli"', 'data-action="casaPaga"'],
    _con: ['data-action="casaMiglioria"'],
    puoPagare: false, pmqg: 0, migliorieVoci: [{ chiave: "salotto", nome: "Salotto",
      nota: "Spazio comune.", costo: 40, attiva: false, alPrezzo: true }],
    storico: [], haStorico: false,
    ultimoTesto: "mai"
  },
  vistaCasaMoroso: {
    vistaCasa: true, alloggio: "cubicolo", vitto: "kibble", corporativo: false,
    canone: 200, cibo: 100, totale: 300, arretrati: 3,
    etichettaAlloggio: "Cubicolo", etichettaVitto: "Kibble",
    alloggi: [], vitti: [], eddies: 12, eddiesNoti: true,
    scoperto: true, haArretrati: true, ultimoTesto: "mai"
  },
  /* Affitto non automatico: la riga che lo dice, e un alloggio homebrew
     nell'elenco (arriva col suo nome, non con una chiave di lingua). */
  vistaCasaAMano: {
    vistaCasa: true, alloggio: "x-capsula", vitto: "generico", corporativo: false,
    mesiAuto: false,
    canone: 80, cibo: 500, totale: 580, arretrati: 0,
    etichettaAlloggio: "Hotel capsula", etichettaVitto: "Cibo generico",
    alloggi: [{ chiave: "x-capsula", etichetta: "Hotel capsula", canone: 80, scelto: true }],
    vitti: [{ chiave: "generico", etichetta: "Cibo generico", costo: 500, scelto: true }],
    eddies: 900, eddiesNoti: true, scoperto: false, haArretrati: false,
    ultimoTesto: "mai"
  },
  /* Il calendario. La griglia si prova piena: un mese che comincia di
     giovedi' ha caselle fuori mese in testa e in coda, ed e' li' che una
     griglia storta si vede. */
  vistaCalendario: {
    etichettaApp: "Calendario", iconaApp: "i", puoScrivere: true,
    oggiLungo: "lunedi' 3 gennaio 2045", oggiOra: "08:00", settimanaNumero: 1,
    intestazioneMese: "GENNAIO 2045",
    iniziali: ["L", "M", "M", "G", "V", "S", "D"],
    celle: [
      { chiave: "2044-12-29", numero: 29, fuori: true },
      { chiave: "2045-01-01", numero: 1, oggi: false, scelto: false, punto: true },
      { chiave: "2045-01-03", numero: 3, oggi: true, scelto: true, punto: false },
      { chiave: "2045-02-01", numero: 1, fuori: true }
    ],
    seguente: 1, precedente: -1, tornaOggi: false,
    giornoScelto: "2045-01-03", giornoLungo: "martedi' 3 gennaio",
    eventi: [{ id: "1", titolo: "Consegna a Watson", testo: "Al molo, mezzanotte." }],
    haEventi: true,
    prossimi: [{ id: "1", titolo: "Consegna a Watson", quando: "3 gen", oggi: true }],
    haProssimi: true,
    // Le scadenze non sono archiviate: il canone lo sa Casa, l'abbonamento
    // l'App che ce l'ha.
    scadenze: [
      { chiave: "casa", titolo: "Affitto e stile di vita", nota: "Conapt",
        quando: "1 feb", importo: -1500 },
      { chiave: "brainwasher", titolo: "Brainwasher", nota: "Abbonamento mensile",
        quando: "1 feb", importo: -50 }
    ],
    haScadenze: true,
    dtSettimana: 1, dtModulo: false, dtAttivita: [],
    dtVoce: { etichetta: "Officina", icona: "i", nota: "ripara la moto",
              chiuso: false, esito: "" },
    dtModificabile: true, dtStorico: [], dtHaStorico: false,
    _con: ['data-action="calGiorno"', 'data-action="dtApri"', 'data-action="dtRitira"',
           "agent-cal-scadenza", "app-calendario"],
    appCorrente: "calendario"
  },
  vistaCalendarioModulo: {
    vistaCalendario: true, etichettaApp: "Calendario", iconaApp: "i", puoScrivere: true,
    oggiLungo: "d", oggiOra: "08:00", settimanaNumero: 2, intestazioneMese: "M",
    iniziali: ["L"], celle: [], seguente: 1, precedente: -1, tornaOggi: true,
    giornoScelto: "2045-01-08", giornoLungo: "g", eventi: [], haEventi: false,
    prossimi: [], haProssimi: false,
    dtSettimana: 2, dtModulo: true,
    dtAttivita: [{ chiave: "riposo", etichetta: "Riposo", icona: "i", scelta: true }],
    dtVoce: null, dtModificabile: true, dtStorico: [], dtHaStorico: false,
    _con: ['name="dtAttivita"', 'name="dtNota"', 'data-action="dtSalva"']
  },
  /* Chiusa dal master: niente tasti per cambiarla, e l'esito si legge. */
  vistaCalendarioChiusa: {
    vistaCalendario: true, etichettaApp: "Calendario", iconaApp: "i", puoScrivere: true,
    oggiLungo: "d", oggiOra: "08:00", settimanaNumero: 3, intestazioneMese: "M",
    iniziali: [], celle: [], seguente: 1, precedente: -1, tornaOggi: false,
    giornoScelto: "2045-01-15", giornoLungo: "g", eventi: [], haEventi: false,
    prossimi: [], haProssimi: false,
    dtSettimana: 3, dtModulo: false, dtAttivita: [],
    dtVoce: { etichetta: "Allenamento", icona: "i", nota: "",
              chiuso: true, esito: "Due giorni persi, un contatto in piu'." },
    dtModificabile: false,
    dtStorico: [{ settimana: 2, etichetta: "Riposo", icona: "i", esito: "", chiuso: true }],
    dtHaStorico: true,
    _senza: ['data-action="dtApri"', 'data-action="dtRitira"']
  },
  vistaHome: {
    scanlines: true,
    pagina: 0, paginaQuadro: true, pista: "translateX(-0%)",
    pagine: [{ indice: 0, attiva: true }, { indice: 1, attiva: false }, { indice: 2, attiva: false }],
    dataLunga: "VEN 08 AGO", handle: "Zero", nomeSotto: "Anastasia Laskowska",
    modelloAgent: "AGENT · POCKET",
    specifiche: [
      { etichetta: "Numero collegato", valore: "555-0142", acceso: true },
      { etichetta: "Numero di serie", valore: "CR-A1B-2C3" },
      { etichetta: "Lavori aperti", valore: 3 }
    ],
    haNotifiche: true,
    notifiche: [
      { genere: "persa", icona: "i", titolo: "Rogue", testo: "Chiamata persa",
        ora: "01:52", app: "messaggi", numero: "555-0001",
        azione: "apriConversazione", nuovo: true },
      { genere: "entrata", icona: "i", titolo: "Accreditati 2400 eb",
        testo: "Lavoro Watson", ora: "00:41", app: "banca", azione: "apriApp" },
      { genere: "master", icona: "i", titolo: "Recupero dati", testo: "Lavori",
        ora: "IERI", app: "lavori", azione: "apriApp" }
    ],
    nonLetti: 3, quanteApp: 8,
    app: [{ chiave: "contatti", icona: "i", etichetta: "Contatti", conteggio: 2 }],
    installate: [{ chiave: "ncpd", icona: "i", etichetta: "NCPD" }],
    numeroSistema: "555-0142", agentInterno: true,
    archivio: 42, archivioLimite: 300, archivioPercento: 14,
    registro: [{ ora: "02:04", allarme: false, testo: "messaggio in entrata" }], haRegistro: true
  },
  vistaHomeApp: {
    vistaHome: true, scanlines: false,
    pagina: 1, paginaApp: true, pista: "translateX(-33.3333%)",
    pagine: [{ indice: 0, attiva: false }, { indice: 1, attiva: true }, { indice: 2, attiva: false }],
    specifiche: [], nonLetti: 0, quanteApp: 2,
    app: [{ chiave: "messaggi", icona: "i", etichetta: "Messaggi", conteggio: 0 }],
    installate: [{ chiave: "ziggurat", icona: "i", etichetta: "Ziggurat" }],
    registro: [], haRegistro: false, notifiche: [], haNotifiche: false
  },
  vistaHomeSistema: {
    vistaHome: true, scanlines: true,
    pagina: 2, paginaSistema: true, pista: "translateX(-66.6666%)",
    pagine: [{ indice: 0, attiva: false }, { indice: 1, attiva: false }, { indice: 2, attiva: true }],
    specifiche: [], nonLetti: 0, quanteApp: 0, app: [], installate: [],
    numeroSistema: "555-0142", agentInterno: false, gps: true,
    archivio: 300, archivioLimite: 300, archivioPercento: 100,
    registro: [
      { ora: "02:04", allarme: false, testo: "messaggio in entrata" },
      { ora: "01:31", allarme: true, testo: "chiamata in uscita" }
    ],
    haRegistro: true, notifiche: [], haNotifiche: false
  },
  vistaDistrutto: { prezzoAgent: 100, eddies: 500, puoRiparare: true },
  vistaChiamata: {
    _con: ['data-action="rispondiChiamata"', 'agent-chiamata-tondo'],
    chiamata: {
      nome: "Rogue", numero: "555-0001", etichettaNumero: "555-0001",
      iniziali: "RO", inCorso: false, daRispondere: true,
      etichettaStato: "In arrivo", etichettaChiudi: "Rifiuta", durataTesto: "00:00"
    }
  },
  vistaChiamataCoperta: {
    _vietato: ["555-0001"],
    vistaChiamata: true,
    chiamata: {
      nome: "???", numero: "555-0001", etichettaNumero: "",
      iniziali: "??", coperto: true, inCorso: true, daRispondere: false,
      etichettaStato: "In linea", etichettaChiudi: "Riaggancia", durataTesto: "01:12"
    },
    // A chiamata aperta si puo' aggiungere gente e mandarla in secondo piano.
    puoAggiungere: true,
    _con: ['data-action="chiamataSfondo"', 'data-action="chiamataAggiungi"']
  },
  /* Una chiamata a piu' capi: chi c'e' dentro e chi sta ancora squillando. */
  vistaChiamataGruppo: {
    vistaChiamata: true,
    _con: ['agent-chiamata-gente', 'data-action="chiamataInvita"', 'name="invita-555-0003"'],
    chiamata: {
      nome: "La banda", gruppo: true, etichettaNumero: "", iniziali: "LA",
      inCorso: true, daRispondere: false,
      etichettaStato: "In linea", etichettaChiudi: "Riaggancia", durataTesto: "02:41",
      partecipanti: [
        { numero: "555-0001", nome: "Rogue", inLinea: true, squilla: false },
        { numero: "555-0002", nome: "Kiwi", inLinea: false, squilla: true }
      ]
    },
    puoAggiungere: true,
    invito: true, haInvitabili: true,
    invitabili: [{ numero: "555-0003", nome: "Falco" }]
  },
  /* La chiamata in secondo piano: la striscia in cima e il telefono usabile. */
  vistaHomeConChiamata: {
    vistaHome: true,
    _con: ['data-action="chiamataApri"', "agent-chiamata-striscia"],
    chiamataBarra: { nome: "Rogue", gruppo: false, quanti: 2, durataTesto: "01:04" },
    pagina: 0, paginaQuadro: true, paginaApp: false, paginaSistema: false,
    pista: "translateX(-0%)", pagine: [{ indice: 0, attiva: true }],
    dataLunga: "VEN 08 AGO", handle: "Zero", nomeSotto: "Anastasia",
    dispositivo: [], notifiche: [], haNotifiche: false, nonLetti: 0,
    app: [], installate: [], quanteApp: 0,
    numeroSistema: "555-0142", agentInterno: false, archivio: 0,
    archivioLimite: 300, archivioPercento: 0, registro: [], haRegistro: false
  },
  vistaMessaggi: {
    // Il campo del numero nuovo e' chiuso: si apre col tasto in fondo.
    _con: ['data-action="compositore"', "agent-cerca", 'data-action="filtroMsg"', "agent-punto"],
    _senza: ['data-action="gruppoNuovo"'],
    vuoto: false,
    ricerca: "",
    compositore: false,
    filtriMsg: [
      { chiave: "tutti", etichetta: "Tutte", attiva: true },
      { chiave: "nuovi", etichetta: "Non lette", attiva: false }
    ],
    conversazioni: [
      { numero: "555-0001", nome: "Rogue", iniziale: "R", nonLetti: 2, anteprima: "ciao",
        uscente: false, quando: "21:04" },
      { numero: "g:abc123", gruppo: true, nome: "La banda", iniziale: "LB", nonLetti: 1,
        anteprima: "Rogue: si parte", uscente: false, quando: "12/03" }
    ]
  },
  vistaMessaggiCompositore: {
    _con: ['data-action="gruppoNuovo"', 'name="composto"'],
    vistaMessaggi: true,
    vuoto: true,
    ricerca: "",
    compositore: true,
    filtriMsg: [{ chiave: "tutti", etichetta: "Tutte", attiva: true }],
    conversazioni: []
  },
  vistaConversazione: {
    numeroAltro: "555-0001", chiaveFilo: "555-0001",
    raggiungibile: true, inRubrica: false, vuoto: false, coperto: false,
    voci: [{ uscente: true, chiamata: false, testo: "ciao", ora: "21:04" }]
  },
  vistaConversazioneCoperta: {
    _vietato: ["555-0001"],
    _senza: ['data-action="salvaContatto"'],
    vistaConversazione: true,
    numeroAltro: "555-0001", chiaveFilo: "555-0001",
    raggiungibile: true, inRubrica: false, vuoto: false, coperto: true,
    voci: [{ uscente: false, chiamata: true, testo: "??? sta chiamando Zero.", ora: "03:12" }]
  },
  // In un gruppo non c'e' niente da chiamare e niente da salvare in rubrica:
  // c'e' l'uscita. Le bolle degli altri portano il nome di chi ha parlato.
  vistaConversazioneGruppo: {
    _con: ['data-action="gruppoEsci"', 'agent-bolla-mittente', 'agent-gruppo-membri'],
    _senza: ['data-action="chiama"', 'data-action="salvaContatto"'],
    vistaConversazione: true,
    gruppo: true, chiaveFilo: "g:abc123", numeroAltro: "",
    etichettaApp: "La banda", raggiungibile: true, vuoto: false, coperto: false,
    membriTesto: "Tu, Rogue, Kiwi", quantiMembri: 3,
    membri: [
      { numero: "555-0142", io: true, nome: "Tu" },
      { numero: "555-0001", io: false, nome: "Rogue" }
    ],
    voci: [
      { uscente: false, chiamata: false, mittente: "Rogue", testo: "si parte", ora: "21:04" },
      { uscente: true, chiamata: false, mittente: "", testo: "arrivo", ora: "21:05" }
    ]
  },
  vistaNuovoGruppo: {
    _con: ['data-action="gruppoCrea"', 'name="gruppoM-555-0001"'],
    candidati: [
      { numero: "555-0001", nome: "Rogue", nascosto: false },
      { numero: "555-0003", nome: "Kiwi", nascosto: false }
    ],
    haCandidati: true,
    esclusi: ["Fixer"], haEsclusi: true
  },
  vistaNuovoGruppoSenzaRubrica: {
    vistaNuovoGruppo: true,
    candidati: [], haCandidati: false, esclusi: [], haEsclusi: false
  },
  /* Phone: una sola App, tre linguette. Il tastierino e' quello che si apre
     per primo, e le lettere sotto le cifre ci devono essere. */
  vistaTelefono: {
    _con: ['data-action="cifra"', "agent-tasto-lettere", 'data-action="telefonoScheda"'],
    schedaTastierino: true, schedaRecenti: false, schedaContatti: false,
    telefonoScheda: "tastierino",
    telefonoSchede: [
      { chiave: "tastierino", icona: "i", etichetta: "Tastierino", attiva: true },
      { chiave: "recenti", icona: "i", etichetta: "Recenti", attiva: false, conteggio: 2 },
      { chiave: "contatti", icona: "i", etichetta: "Contatti", attiva: false }
    ],
    composto: "5550001",
    tasti: [{ cifra: "1", lettere: "" }, { cifra: "2", lettere: "ABC" }]
  },
  /* Nei recenti un numero coperto non si scrive, come in ogni altra vista. */
  vistaTelefonoRecenti: {
    vistaTelefono: true,
    _vietato: ["555-0002"],
    _senza: ["agent-tastierino"],
    schedaTastierino: false, schedaRecenti: true, schedaContatti: false,
    telefonoScheda: "recenti", telefonoSchede: [],
    recenti: [
      { idChiamata: "a", numero: "555-0001", nome: "Rogue", etichettaNumero: "555-0001",
        esito: "fatta", persa: false, gruppo: false, icona: "i", quando: "08/08 · 21:04" },
      { idChiamata: "b", numero: "555-0002", nome: "???", etichettaNumero: "",
        coperto: true, esito: "persa", persa: true, gruppo: false, icona: "i", quando: "08/08 · 03:12" }
    ],
    haRecenti: true
  },
  vistaTelefonoRecentiVuoti: {
    vistaTelefono: true,
    schedaTastierino: false, schedaRecenti: true, schedaContatti: false,
    telefonoScheda: "recenti", telefonoSchede: [], recenti: [], haRecenti: false
  },
  /* La rubrica dentro Phone: la ricerca, il tasto per aggiungere, e un
     numero coperto che non compare da nessuna parte. */
  vistaTelefonoContatti: {
    vistaTelefono: true,
    _vietato: ["555-0002"],
    _con: ['data-action="nuovo"', 'data-app="contatti"', "agent-cerca", 'data-action="apriContatto"'],
    schedaTastierino: false, schedaRecenti: false, schedaContatti: true,
    telefonoScheda: "contatti", telefonoSchede: [], mostraRubrica: true,
    soloPreferiti: false, ricerca: "", vuotoRubrica: "Rubrica vuota.",
    rubrica: [
      { id: "1", nome: "Rogue", iniziale: "R", numero: "555-0001", sotto: "555-0001", chiamabile: true, coperto: false },
      { id: "2", nome: "???", iniziale: "?", numero: "555-0002", sotto: "", chiamabile: true, coperto: true }
    ],
    haRubrica: true
  },
  /* I preferiti sono la stessa lista filtrata: niente ricerca, niente
     tasto per aggiungere — un preferito si marca da una scheda. */
  vistaTelefonoPreferiti: {
    vistaTelefono: true,
    _senza: ["agent-cerca", 'data-action="nuovo"'],
    schedaTastierino: false, schedaRecenti: false, schedaContatti: false,
    schedaPreferiti: true, telefonoScheda: "preferiti", telefonoSchede: [],
    mostraRubrica: true, soloPreferiti: true, ricerca: "",
    vuotoRubrica: "Nessun preferito.",
    rubrica: [
      { id: "1", nome: "Rogue", iniziale: "R", numero: "555-0001", sotto: "555-0001",
        chiamabile: true, coperto: false, preferito: true }
    ],
    haRubrica: true
  },
  vistaTelefonoPreferitiVuoti: {
    vistaTelefono: true,
    schedaPreferiti: true, telefonoScheda: "preferiti", telefonoSchede: [],
    mostraRubrica: true, soloPreferiti: true, ricerca: "",
    vuotoRubrica: "Nessun preferito.", rubrica: [], haRubrica: false
  },
  /* La scheda di un contatto: i tre comandi tondi, i dati, la cronologia.
     Su un contatto gia' in rubrica il tasto e' «modifica», non «salva». */
  vistaTelefonoScheda: {
    vistaTelefono: true,
    _con: ['data-action="chiudiContatto"', 'data-action="contattoPreferito"',
           'data-action="modifica"', "agent-contatto-comandi"],
    schedaContatto: true, telefonoScheda: "contatti", telefonoSchede: [],
    contatto: {
      numero: "555-0001", coperto: false, nome: "Rogue", iniziale: "R",
      sotto: "Fixer", note: "Non chiamare di giorno.", id: "1",
      inRubrica: true, preferito: true,
      righe: [{ etichetta: "Numero", valore: "555-0001" }],
      storico: [{ esito: "persa", persa: true, icona: "i", etichetta: "Chiamata persa", quando: "08/08 · 03:12" }],
      haStorico: true
    }
  },
  /* Su un numero coperto la scheda non scrive la cifra, non offre di
     salvarlo in rubrica e non ha la stella. */
  vistaTelefonoSchedaCoperta: {
    vistaTelefono: true,
    _vietato: ["555-0002"],
    _senza: ['data-action="salvaContatto"', 'data-action="contattoPreferito"'],
    schedaContatto: true, telefonoScheda: "recenti", telefonoSchede: [],
    contatto: {
      numero: "555-0002", coperto: true, nome: "???", iniziale: "?",
      sotto: "", note: "", id: "", inRubrica: false, preferito: false,
      righe: [], storico: [], haStorico: false
    }
  },
  vistaGladiator: {
    appCorrente: "gladiator", _con: ["app-gladiator"],
    composto: "", posta: "", agentInterno: true,
    gladiatore: null, candidati: [], haCandidati: false,
    bilancio: { duelli: 0, vinti: 0, persi: 0 }, haStorico: false, storico: [],
    sfida: { inArrivo: true, nome: "Rogue", amichevole: false,
             etichettaModo: "Classificata", posta: "" }
  },
  vistaGladiatorSenzaSfida: {
    vistaGladiator: true, composto: "", posta: "", agentInterno: false, sfida: null,
    gladiatore: { id: "g", nome: "Ronin", immagine: "r.png",
                  ferite: 40, armatura: 11, ref: 8, corpo: 8 },
    candidati: [{ id: "g", nome: "Ronin", scelto: true }], haCandidati: true,
    bilancio: { duelli: 4, vinti: 3, persi: 1 }, haStorico: true,
    storico: [{ id: "1", avversario: "Kiwi", vinto: true, round: 5,
                etichettaModo: "Classificata", quando: "08/08" }]
  },
  vistaGladiatorSenzaScheda: {
    vistaGladiator: true, composto: "", posta: "", agentInterno: false, sfida: null,
    gladiatore: null, candidati: [{ id: "g", nome: "Ronin", scelto: false }],
    haCandidati: true, bilancio: { duelli: 0, vinti: 0, persi: 0 },
    haStorico: false, storico: [],
    _senza: ['data-action="sfida"']
  },
  vistaFortify: {
    appCorrente: "fortify", _con: ["app-fortify"],
    bersaglio: "", marcatura: { bersaglio: "muretto", quando: "21:04" }
  },

  /* --- le App del DLC «Tutto sugli Agent» -------------------------- */

  vistaAlex: {
    appCorrente: "alex", _con: ["app-alex", "agent-cerca", 'data-action="alexTira"'],
    vistaAlex: true, ricerca: "watson", alexBonus: 3, alexGrande: true,
    alexHaDb: true, alexCercato: true, alexQuante: 2, alexFonti: "Locali · Zone",
    alexRisultati: [
      { nome: "Afterlife", riga: "Locali · Watson", testo: "Il bar dei solitari." },
      { nome: "Watson", riga: "Zone", testo: "Distretto nord." }
    ],
    alexTroppi: false
  },
  vistaAlexSenzaDb: {
    appCorrente: "alex", vistaAlex: true, ricerca: "",
    alexBonus: 2, alexHaDb: false, alexCercato: false,
    alexQuante: 0, alexFonti: "", alexRisultati: [], alexTroppi: false
  },
  vistaZpost: {
    appCorrente: "zpost", _con: ["app-zpost", 'data-action="zpostApri"', 'data-action="zpostInvia"'],
    vistaZpost: true, zpostScritte: false, composto: "",
    zpostLinguette: [
      { chiave: "ricevute", etichetta: "In arrivo", attiva: true },
      { chiave: "inviate", etichetta: "Inviate", attiva: false }
    ],
    zpostVuoto: false,
    zpostElenco: [
      { idVoce: "a", chi: "Wakako", iniziale: "W", oggetto: "Contratto",
        anteprima: "Allegato il percorso.", quando: "08/08 01:12" }
    ]
  },
  /* Una email aperta: si legge, si risponde, e il numero non ci va scritto. */
  vistaZpostAperta: {
    appCorrente: "zpost", _con: ['data-action="zpostRispondi"'],
    _senza: ['data-action="zpostApri"'],
    vistaZpost: true,
    zpostAperta: {
      idVoce: "a", oggetto: "Contratto", testo: "Ci vediamo alle due.",
      mittente: "Wakako", numero: "555-0001", coperto: false,
      uscente: false, quando: "08/08 01:12"
    }
  },
  vistaZpostVuoto: {
    appCorrente: "zpost", vistaZpost: true, zpostScritte: true, composto: "",
    zpostLinguette: [], zpostVuoto: true, zpostElenco: []
  },
  vistaGarden: {
    appCorrente: "garden", _con: ["app-garden", 'data-action="gardenCuore"', 'data-action="gardenPubblica"'],
    vistaGarden: true, gardenPuoScrivere: true, gardenVuoto: false,
    gardenVoci: [
      { id: "1", autore: "EZ-8", iniziale: "E", testo: "Stasera all'Atlantis.",
        quando: "08/08 01:12", cuori: 3, mio: true }
    ]
  },
  vistaGardenVuoto: {
    appCorrente: "garden", vistaGarden: true, gardenPuoScrivere: false,
    gardenVuoto: true, gardenVoci: []
  },
  vistaBangme: {
    appCorrente: "bangme", _con: ["app-bangme", 'data-action="bangImporto"', 'data-action="bangInvia"'],
    vistaBangme: true, eddies: 4000, eddiesNoti: true, bangImporto: 200,
    bangImporti: [
      { valore: 50, etichetta: "50", scelto: false },
      { valore: 200, etichetta: "200", scelto: true }
    ],
    bangDestinatari: [
      { numero: "555-0001", coperto: false, nome: "Rogue", iniziale: "R",
        sotto: "555-0001", scelto: true }
    ],
    bangVuoto: false, bersaglio: "555-0001", bangPronto: true,
    bangEtichetta: "Invia 200 eb"
  },
  vistaHustool: {
    appCorrente: "hustool", _con: ["app-hustool", 'data-action="husLavoretto"'],
    vistaHustool: true, husPaga: 10, husMinuti: 30, husVuoto: false, husTotale: 20,
    husStorico: [
      { titolo: "Lavoretto concluso", quando: "08/08 11:04", pagaTesto: "+10", male: false, guai: false },
      { titolo: "Lavoretto andato male", quando: "07/08 09:00", pagaTesto: "0", male: true, guai: false }
    ]
  },
  vistaHustoolVuoto: {
    appCorrente: "hustool", vistaHustool: true, husPaga: 10, husMinuti: 30,
    husVuoto: true, husTotale: 0, husStorico: []
  },
  vistaRoach: {
    appCorrente: "roachrace", _con: ["app-roachrace", 'data-action="roachGioca"'],
    vistaRoach: true, roachRecord: 1840, roachPartite: 6, roachUltima: 1200,
    roachGiocato: true, roachHaClassifica: true,
    roachClassifica: [
      { nome: "Zero", record: 1840, io: true },
      { nome: "Riffstorm", record: 900, io: false }
    ]
  },
  vistaRoachVergine: {
    appCorrente: "roachrace", vistaRoach: true, roachRecord: 0, roachPartite: 0,
    roachUltima: 0, roachGiocato: false, roachHaClassifica: false, roachClassifica: []
  },
  vistaWatchbox: {
    appCorrente: "watchbox", _con: ["app-watchbox", 'data-action="watchAvvia"'],
    vistaWatchbox: true, watchInterno: false, watchLato: 20, watchVd: 13,
    watchMinuti: 5, watchStanza: "", watchAttivo: false, watch: null
  },
  vistaWatchboxAttiva: {
    appCorrente: "watchbox", _con: ['data-action="watchSpegni"'],
    _senza: ['data-action="watchAvvia"'],
    vistaWatchbox: true, watchInterno: false, watchLato: 20, watchVd: 13,
    watchMinuti: 5, watchStanza: "", watchAttivo: true,
    watch: { stanza: "Retro del bar", quando: "08/08 01:12" }
  },
  /* Con un Agent interno WatchBox non parte: il tasto non c'e' proprio. */
  vistaWatchboxInterno: {
    appCorrente: "watchbox", _senza: ['data-action="watchAvvia"'],
    vistaWatchbox: true, watchInterno: true, watchLato: 20, watchVd: 13,
    watchMinuti: 5, watchStanza: "", watchAttivo: false, watch: null
  },
  vistaBrainwasher: {
    appCorrente: "brainwasher", _con: ["app-brainwasher", 'data-action="bwSessione"'],
    vistaBrainwasher: true, bwGiorni: 7, bwFatte: 4, bwPercento: 57,
    bwCompleto: false, bwOggiFatta: false, bwEsito: null, bwPrima: false,
    bwSessioni: [
      { numero: 1, fatta: true, oggi: false },
      { numero: 5, fatta: false, oggi: true },
      { numero: 6, fatta: false, oggi: false }
    ]
  },
  vistaBrainwasherCompleto: {
    appCorrente: "brainwasher", _con: ['data-action="bwChiudi"'],
    _senza: ['data-action="bwSessione"'],
    vistaBrainwasher: true, bwGiorni: 7, bwFatte: 7, bwPercento: 100,
    bwCompleto: true, bwOggiFatta: true, bwEsito: "prima", bwPrima: true,
    bwSessioni: [{ numero: 1, fatta: true, oggi: false }]
  },
  vistaElflines: {
    appCorrente: "elflines", _con: ["app-elflines", 'data-action="elfModifica"'],
    vistaElflines: true, elfCollegato: true, elfModulo: false,
    elf: {
      nome: "Zeroblade", livello: "34", gilda: "Valle di Smeraldo", server: "NC-3",
      stat: [
        { chiave: "forza", etichetta: "Forza", valore: "14", campo: "14" },
        { chiave: "magia", etichetta: "Magia", valore: "22", campo: "22" }
      ]
    }
  },
  vistaElflinesModulo: {
    appCorrente: "elflines", _con: ['data-action="elfSalva"'],
    _senza: ['data-action="elfModifica"'],
    vistaElflines: true, elfCollegato: true, elfModulo: true,
    elf: {
      nome: "Zeroblade", livello: "34", gilda: "", server: "",
      stat: [{ chiave: "forza", etichetta: "Forza", valore: "14", campo: "14" }]
    }
  },
  vistaElflinesVuoto: {
    appCorrente: "elflines", vistaElflines: true, elfCollegato: false,
    elfModulo: false,
    elf: { nome: "", livello: "", gilda: "", server: "", stat: [] }
  },
  vistaBigIaaa: {
    appCorrente: "bigiaaa", _con: ["app-bigiaaa", 'data-action="iaaaCommuta"'],
    vistaBigIaaa: true, iaaaAcceso: true, iaaaBonus: 3, iaaaBase: 2, iaaaGrande: 3
  },
  /* Sentinel: i due VD del manuale, i nodi, il riavvio. */
  vistaSentinel: {
    appCorrente: "sentinel",
    _con: ["app-sentinel", 'data-action="sentScansiona"', 'data-action="sentRiavvia"',
           'data-action="sentQualita"'],
    vistaSentinel: true, sentQualita: "standard", sentQualitaNome: "Qualita' standard",
    sentVdRemoto: 21, sentVdDiretto: 17,
    sentQualitaScelte: [
      { chiave: "bassa", etichetta: "Bassa", scelta: false },
      { chiave: "standard", etichetta: "Standard", scelta: true }
    ],
    sentNodi: [
      { nome: "Questo Agent", meta: "Un Breacher a 20 m lo apre con VD 21", sicuro: false, stato: "Esposto" },
      { nome: "Big IAAA", meta: "Trasmissione continua", sicuro: false, stato: "Esposto" }
    ],
    sentPulito: false, sentEsposti: 2, sentRiavvio: "08/08 01:12", sentMinuti: 5,
    sentRegistro: [{ quando: "08/08 01:12", testo: "controscansione: 19", buono: false }],
    sentHaRegistro: true
  },
  /* Un Agent interno non si hackera col Breacher: il perimetro e' pulito e
     il registro non c'e' ancora. */
  vistaSentinelPulito: {
    appCorrente: "sentinel", vistaSentinel: true,
    sentQualita: "alta", sentQualitaNome: "Alta qualita'",
    sentVdRemoto: 24, sentVdDiretto: 21, sentQualitaScelte: [],
    sentNodi: [{ nome: "Questo Agent", meta: "Interno", sicuro: true, stato: "Sicuro" }],
    sentPulito: true, sentEsposti: 0, sentRiavvio: "", sentMinuti: 5,
    sentRegistro: [], sentHaRegistro: false
  },
  /* Patch Pro: le bozze hanno i tasti pubblica ed elimina, le altre no. */
  vistaPatchpro: {
    appCorrente: "patchpro",
    _con: ["app-patchpro", 'data-action="patchScheda"', 'data-action="patchBozza"',
           'data-action="patchPubblica"', "agent-istogramma"],
    vistaPatchpro: true, patchScheda: "bozze", patchInBozze: true, patchPuoScrivere: true,
    patchSchede: [
      { chiave: "bozze", etichetta: "Bozze", attiva: true },
      { chiave: "pubblicate", etichetta: "Pubblicate", attiva: false }
    ],
    patchPost: 3, patchCuori: 7, patchBozze: 1,
    patchSettimana: [{ etichetta: "LUN", quanti: 2, altezza: 100 }, { etichetta: "MAR", quanti: 0, altezza: 0 }],
    patchElenco: [{ id: "1", titolo: "Convoglio a Watson", testo: "Sei ore.", meta: "08/08 01:12", bozza: true }],
    patchVuoto: false
  },
  vistaPatchproVuoto: {
    appCorrente: "patchpro", vistaPatchpro: true, patchScheda: "analisi",
    patchInBozze: false, patchPuoScrivere: true,
    _senza: ['data-action="patchBozza"', 'data-action="patchPubblica"'],
    patchSchede: [], patchPost: 0, patchCuori: 0, patchBozze: 0,
    patchSettimana: [], patchElenco: [], patchVuoto: true
  },
  vistaFortifySenza: { vistaFortify: true, bersaglio: "x", marcatura: null },
  // L'App NCPD non scrive piu': nessun tasto di scrittura, in nessun caso,
  // nemmeno per un GM. Si scheda dalla console del master.
  vistaNcpd: {
    appCorrente: "ncpd", _con: ['app-ncpd'],
    _senza: ['data-action="fascicoloNuovo"', 'data-action="fascicoloSalva"',
             'data-action="fascicoloElimina"', 'name="schedaNome"'],
    vuoto: false,
    voci: [{ id: "1", nome: "Rogue", riga: "R · 5000 eb" }]
  },
  vistaNcpdFascicolo: {
    vistaNcpd: true, vuoto: false, voci: [],
    _senza: ['data-action="fascicoloSalva"', 'name="schedaNome"'],
    scheda: { id: "1", nome: "Rogue", alias: "R",
              taglia: "5000", mandati: "M", precedenti: "P" }
  },
  vistaNcpdVuoto: { vistaNcpd: true, vuoto: true, voci: [], scheda: null },
  vistaMedscan: {
    appCorrente: "medscan", _con: ["app-medscan"],
    composto: "", eddies: 900, eddiesNoti: true, abbonato: false,
    livelli: [
      { chiave: "pronto", etichetta: "Pronto soccorso", usi: "+1 a Pronto Soccorso.",
        prezzo: 100, bonus: 1, ore: 1, troppoCaro: false },
      { chiave: "chirurgia", etichetta: "Chirurgia", usi: "+1 a Chirurgia.",
        prezzo: 500, bonus: 1, ore: 4, troppoCaro: true }
    ],
    consulto: { etichetta: "Pronto soccorso", usi: "+1 a Pronto Soccorso.",
                bonus: 1, per: "Zero", restano: 45 }
  },
  vistaMedscanAbbonato: {
    vistaMedscan: true, composto: "", eddies: 0, eddiesNoti: true, abbonato: true,
    livelli: [{ chiave: "pronto", etichetta: "Pronto soccorso", usi: "+1.",
                prezzo: 0, bonus: 1, ore: 1, troppoCaro: false }],
    consulto: null
  },
  vistaZiggurat: {
    appCorrente: "ziggurat", _con: ["app-ziggurat"],
    citta: "Night City", bonus: 2, attiva: true, ricerca: "", filtroAttivo: false,
    categorie: [{ chiave: "locali", etichetta: "Locali", attiva: false, conteggio: 2 }],
    voci: [{ id: "1", nome: "Afterlife", categoria: "Locali", zona: "Watson",
             testo: "Il bar dei Solo." }],
    vuoto: false, dbVuoto: false
  },
  vistaZigguratVuoto: {
    vistaZiggurat: true, citta: "", bonus: 2, attiva: false, ricerca: "",
    filtroAttivo: false, categorie: [], voci: [], vuoto: true, dbVuoto: true
  },
  vistaReputazione: {
    appCorrente: "reputazione", etichettaApp: "StreetWire", iconaApp: "i",
    repNota: true, repValore: 6, repLivello: "Ti conoscono in citta'",
    repPubblica: true, repPortata: "Il tuo nome gira da solo.",
    repScala: [
      { etichetta: "Nessuno in particolare", da: 0, qui: false },
      { etichetta: "Ti conoscono in citta'", da: 5, qui: true }
    ],
    repRegistro: [
      { testo: "Reputation increased by 2 to 6", motivo: "Ha tenuto testa a un Solo dei Maelstrom." }
    ],
    repHaRegistro: true,
    _con: ['app-reputazione', 'agent-rep-gradino qui']
  },
  /* Una scheda che la reputazione non ce l'ha: un avviso, e nient'altro. */
  vistaReputazioneMuta: {
    vistaReputazione: true, appCorrente: "reputazione",
    etichettaApp: "StreetWire", iconaApp: "i",
    repNota: false, repValore: null, repLivello: "", repPubblica: false,
    repPortata: "", repScala: [], repRegistro: [], repHaRegistro: false,
    _senza: ['agent-rep-scala', 'agent-conto-cifra']
  },
  vistaNegozioBanco: {
    vistaNegozio: true, appCorrente: "negozio",
    _con: ['data-action="scegliCategoria"'],
    _senza: ['data-action="scegliSotto"'],
    categorie: [
      { tipo: "gear", etichetta: "Equipaggiamento", conteggio: 120, attiva: false },
      { tipo: "cyberware", etichetta: "Cyberware", conteggio: 88, attiva: false }
    ],
    sottocategorie: [], haSotto: false, categoriaAperta: null, alBanco: true,
    sottoAperta: null, ricerca: "", soloAbbordabili: false,
    eddies: 100, eddiesNoti: true, quantiMostrati: 0, totale: 0,
    articoli: [], troncato: false, vuoto: false
  },
  vistaNegozio: {
    appCorrente: "negozio", _con: ["app-negozio", "agent-briciola", "agent-articolo-foto", "agent-articolo-scorta"],
    categorie: [{ tipo: "gear", etichetta: "Equip", conteggio: 3, attiva: true }],
    sottocategorie: [{ valore: "v", etichetta: "V", conteggio: 1, attiva: false }],
    haSotto: true, categoriaAperta: "Equip", alBanco: false, sottoAperta: "V",
    ricerca: "", quantiMostrati: 1, totale: 1,
    soloAbbordabili: false, eddies: 100, eddiesNoti: true,
    articoli: [{ uuid: "u", nome: "N", immagine: "i.png", etichettaTipo: "T", fonte: "F",
                 disponibilita: "D", prezzoTesto: "10 eb", troppoCaro: false, acquistabile: true }],
    troncato: true, vuoto: false
  },
  vistaAppStore: {
    ricerca: "", vuoto: false,
    fasce: [{ chiave: "tutte", etichetta: "Tutte", attiva: true }],
    appCorrente: "appstore", _con: ['app-appstore', "agent-store-serie"],
    // Due righe senza tasto per due ragioni diverse: di serie e fornita
    // dall'azienda. Il tasto d'acquisto resta solo sulla terza.
    _senza: ['data-chiave="corp"'],
    eddies: 100, eddiesNoti: true,
    catalogo: [{ chiave: "ncpd", nome: "NCPD", produttore: "P", icona: "i", prezzo: 500,
                 disponibilita: "D", descrizione: "d", posseduta: true, installata: false, troppoCara: false },
               { chiave: "garden", nome: "Garden", produttore: "Ziggurat", icona: "i", prezzo: 0,
                 disponibilita: "D", descrizione: "d", posseduta: true, installata: true,
                 diSerie: true, gratuita: true, troppoCara: false },
               // Corp Link resta in catalogo — e' li' che si legge cosa fa —
               // ma il tasto per scaricarla ce l'ha solo il master.
               { chiave: "corp", nome: "Corp Link", produttore: "Corporate", icona: "i", prezzo: 0,
                 disponibilita: "D", descrizione: "d", posseduta: false, installata: false,
                 soloMaster: true, gratuita: true, troppoCara: false }]
  },
  vistaInstallata: {},
  /* Lo sfondo si sceglie da una lista chiusa: nessun campo dove scrivere
     un percorso, nessun selettore di file. */
  vistaImpostazioni: {
    _con: ['data-action="sfondo"', 'data-sfondo="arasaka"', 'data-action="blocca"', 'agent-identita-scheda',
           'data-action="ripristina"'],
    _senza: ['name="sfondoPercorso"', "FilePicker"],
    temi: [{ chiave: "notte", etichetta: "Notte", attivo: true }],
    accento: "#fff", handle: "Zero", nomeVero: "Anastasia Laskowska", salutoHandle: true,
    iniziale: "ZE", identitaNome: "Zero", identitaRiga: "AGENT · POCKET · Il tuo numero 555-0142",
    numero: "555-0142", agentInterno: true, gps: false,
    sfondoScelto: "arasaka", sfondoNome: "ARASAKA",
    sfondi: [
      { chiave: "", etichetta: "Nessuno", url: "", scelto: false },
      { chiave: "arasaka", etichetta: "ARASAKA", url: "a.jpg", scelto: true }
    ]
  },
  /* Senza sfondo scelto il velo non si rende: e' quello che tiene in piedi
     la home dei tavoli che lo sfondo non lo vogliono. */
  vistaHomeSenzaSfondo: {
    vistaHome: true, sfondo: "", sfondoVisibile: false,
    _senza: ["agent-sfondo-velo"],
    dataLunga: "MER 08 AGO", handle: "Zero", nomeSotto: "Anastasia",
    conteggi: [], notifiche: [], haNotifiche: false, nonLetti: 0,
    pagina: 0, paginaQuadro: true, pista: "translateX(0%)",
    pagine: [{ indice: 0, attiva: true }], app: [], installate: [], quanteApp: 0,
    numeroSistema: "555-0142", archivio: 0, archivioLimite: 300, archivioPercento: 0,
    registro: [], haRegistro: false, dispositivo: []
  },
  /* Incarichi: una scheda per lavoro, coi filtri e lo stato che tinge. */
  vistaLavori: {
    _con: ['data-action="filtroGig"', "agent-gig-scheda", "stato-corso"],
    etichettaApp: "Lavori", iconaApp: "i", vuoto: false,
    filtriGig: [
      { chiave: "aperti", etichetta: "Attivi", attiva: true },
      { chiave: "chiusi", etichetta: "Completati", attiva: false }
    ],
    lavori: [{
      id: "1", titolo: "Recupero dati", committente: "Regina Jones \u00b7 Watson",
      iniziale: "R", dettagli: "Estrarre uno shard dai server di Corpo Plaza.",
      ricompensa: "12000 eb", stato: "corso", etichettaStato: "In corso",
      avanzamento: 55, daMaster: true
    }]
  },
  vistaLavoriVuoto: {
    vistaLavori: true, etichettaApp: "Lavori", iconaApp: "i", vuoto: true,
    filtriGig: [], lavori: []
  },
  vistaLista: {
    _vietato: ["555-0002"],
    _con: ['data-action="nuovo"'],
    etichettaNuovo: "+ Nuova nota",
    _senza: ['data-action="modifica" data-id="2"'],
    vuoto: false,
    voci: [
      { id: "1", titolo: "T", sottotitolo: "s", corpo: "corpo lungo", quando: "08 AGO",
        stato: "corso", daMaster: true, numero: "555-0001", coperto: false },
      { id: "2", titolo: "???", sottotitolo: "", numero: "555-0002", coperto: true }
    ]
  },
  vistaForm: {
    nuovo: true,
    campi: [
      { chiave: "nome", etichetta: "Nome", richiesto: true, valore: "x", eTesto: true, opzioni: [] },
      { chiave: "nascosto", etichetta: "Nascondi", eCheck: true, acceso: true, opzioni: [] },
      { chiave: "stato", etichetta: "Stato", eSelect: true,
        opzioni: [{ valore: "a", etichetta: "A", selezionato: true }] }
    ]
  }
};

/**
 * Un numero coperto puo' stare in un `data-numero` — serve a instradare — ma
 * mai in qualcosa che l'utente legge. Si toglie l'attributo dalla resa e si
 * cerca il numero in quello che resta: se salta fuori, e' un testo.
 */
function senzaInstradamento(html) {
  return html.replace(/data-numero="[^"]*"/g, "");
}

/* La console del master ha un template suo: stesse regole, stesso giro. */
const modelloMaster = Handlebars.compile(
  fs.readFileSync(path.join(RADICE, "templates/master.hbs"), "utf8"));

const schede = (a) => ["banca", "ncpd", "posta", "ziggurat", "arena", "tempo", "stati", "tavolo"]
  .map(c => ({ chiave: c, etichetta: c, icona: "i", attiva: c === a }));

/* Quello che sta fuori dalle viste — scocca, barra di stato, testata — legge
   solo da qui, come sull'Agent. Se manca, la console si rende senza marca. */
const baseMaster = {
  appCorrente: "console", etichettaScheda: "Banca", iconaScheda: "i",
  nomeMaster: "Fixer", numeroMaster: "555-9000", haIdentita: true, scanlines: true
};

const visteMaster = {
  vistaMasterBanca: {
    _con: ['data-orologio', 'agent-console-testata', '>GM<'],
    appCorrente: "banca", etichettaScheda: "Banca",
    schede: schede("banca"), vuoto: false,
    giocatori: [{ id: "1", nome: "Zero", numero: "555-0142", eddies: 999280, eddiesNoti: true }]
  },
  // Console senza numero libero: al posto del numero, la barra lo dice.
  vistaMasterBancaSenzaIdentita: {
    vistaMasterBanca: true, schede: schede("banca"), vuoto: true, giocatori: [],
    nomeMaster: "", numeroMaster: "", haIdentita: false
  },
  /* Alloggi e vitto: una riga del manuale riprezzata (col prezzo di serie
     accanto) e una homebrew, che si modifica nel nome e si toglie. */
  vistaMasterBancaCasa: {
    vistaMasterBanca: true, schede: schede("banca"), vuoto: true, giocatori: [],
    _con: ['data-action="casaSalvaVoce"', 'data-action="casaAggiungi"', 'name="nomeNuovo"'],
    casaGruppi: [
      {
        chiave: "alloggi", titolo: "Alloggio", segnaposto: "Nuovo alloggio",
        voci: [
          { chiave: "conapt", nome: "Conapt", costo: 1200, base: 1000,
            cambiato: true, homebrew: false, rimovibile: true },
          { chiave: "x-capsula", nome: "Hotel capsula", costo: 80,
            cambiato: false, homebrew: true, rimovibile: true }
        ]
      },
      {
        chiave: "vitti", titolo: "Vitto", segnaposto: "Nuovo vitto",
        voci: [
          { chiave: "kibble", nome: "Kibble", costo: 100, base: 100,
            cambiato: false, homebrew: false, rimovibile: false }
        ]
      }
    ]
  },
  vistaMasterBancaVuota: {
    vistaMasterBanca: true, schede: schede("banca"), vuoto: true, giocatori: []
  },
  vistaMasterNcpd: {
    schede: schede("ncpd"), vuoto: false, scheda: null,
    voci: [{ id: "1", nome: "Rogue", riga: "R · 5000 eb" }]
  },
  vistaMasterNcpdModifica: {
    vistaMasterNcpd: true, schede: schede("ncpd"), vuoto: false, voci: [],
    scheda: { nuova: false, id: "1", nome: "Rogue", alias: "R",
              taglia: "5000", mandati: "M", precedenti: "P" }
  },
  vistaMasterNcpdNuova: {
    vistaMasterNcpd: true, schede: schede("ncpd"), vuoto: true, voci: [],
    _senza: ['data-action="fascicoloElimina"'],
    scheda: { nuova: true, id: "", nome: "", alias: "", taglia: "", mandati: "", precedenti: "" }
  },
  vistaMasterPosta: {
    _con: ['data-action="scriviTutti"', 'data-action="scriviGruppo"',
           'name="mdest-555-0142"', 'name="gruppoNomeMaster"'],
    schede: schede("posta"), nome: "Fixer", numero: "555-9000", configurata: true,
    bersaglio: "", haFili: true, immagine: "foto.png",
    haDestinatari: true, gruppoNome: "",
    destinatari: [{ numero: "555-0142", nome: "Zero", scelto: true }],
    fili: [{ chiave: "555-0142", gruppo: false, nome: "Zero", anteprima: "ok", aperto: true }],
    conversazione: {
      chiave: "555-0142", gruppo: false, nome: "Zero", membriTesto: "",
      voci: [{ uscente: true, mittente: "", testo: "ci sei?", ora: "21:04" }]
    }
  },
  // Il filo di gruppo del master: la riga dei membri e il nome di chi parla.
  vistaMasterPostaGruppo: {
    _con: ['agent-gruppo-membri', 'agent-bolla-mittente', 'data-chiave="g:abc123"'],
    vistaMasterPosta: true,
    schede: schede("posta"), nome: "Fixer", numero: "555-9000", configurata: true,
    bersaglio: "", haFili: true, immagine: "", gruppoNome: "La banda",
    haDestinatari: true,
    destinatari: [{ numero: "555-0142", nome: "Zero", scelto: false }],
    fili: [{ chiave: "g:abc123", gruppo: true, nome: "La banda", anteprima: "si parte", aperto: true }],
    conversazione: {
      chiave: "g:abc123", gruppo: true, nome: "La banda",
      membriTesto: "Fixer, Zero, Rogue",
      voci: [{ uscente: false, mittente: "Rogue", testo: "si parte", ora: "21:04" }]
    }
  },
  vistaMasterPostaSpenta: {
    vistaMasterPosta: true, schede: schede("posta"), nome: "", numero: "",
    configurata: false, bersaglio: "", fili: [], haFili: false, conversazione: null,
    destinatari: [], haDestinatari: false, gruppoNome: ""
  },
  vistaMasterZiggurat: {
    schede: schede("ziggurat"), vuoto: false, scheda: null,
    voci: [{ id: "1", nome: "Afterlife", riga: "Locali · Night City · Watson" }]
  },
  vistaMasterZigguratModifica: {
    vistaMasterZiggurat: true, schede: schede("ziggurat"), vuoto: false, voci: [],
    scheda: {
      nuova: false, id: "1", nome: "Afterlife", citta: "Night City",
      zona: "Watson", testo: "Il bar dei Solo.",
      categorie: [{ chiave: "locali", etichetta: "Locali", scelta: true },
                  { chiave: "eventi", etichetta: "Eventi", scelta: false }]
    }
  },
  /* La bacheca aziendale: elenco degli avvisi e badge del tavolo. */
  /* Il badge si assegna da qui, e da qui si installa l'App: nel telefono
     del giocatore non c'e' un tasto che faccia nessuna delle due cose. */
  vistaMasterCorp: {
    schede: schede("corp"), vuoto: false, scheda: null,
    _con: ['data-action="corpSospendi"', 'data-action="corpAvvisoElimina"',
           'data-action="corpAssegna"', 'data-action="corpApp"', 'name="corpQuale"'],
    voci: [{ id: "1", titolo: "Protocollo di sicurezza", riga: "Bacheca · Arasaka · OBBLIGO · 12/08" }],
    badge: [{
      attore: "a1", nome: "Zero", corp: "Arasaka", haCorp: true, numero: "774-A",
      attivo: true, haApp: true, nomeLibero: "",
      corporazioni: [{ chiave: "", nome: "Nessuna Corporazione", scelta: false },
                     { chiave: "arasaka", nome: "Arasaka", scelta: true }],
      livelli: [{ valore: 1, scelto: false }, { valore: 2, scelto: true }]
    }],
    haBadge: true
  },
  /* Chi non ha un badge sta in elenco lo stesso: e' li' che glielo si da'.
     Senza Corporazione non c'e' niente da sospendere. */
  vistaMasterCorpSenzaBadge: {
    vistaMasterCorp: true, schede: schede("corp"), vuoto: true, voci: [], scheda: null,
    _con: ['data-action="corpAssegna"', 'data-action="corpApp"'],
    _senza: ['data-action="corpSospendi"'],
    badge: [{
      attore: "a2", nome: "Riffstorm", corp: "", haCorp: false, numero: "112-C",
      attivo: true, haApp: false, nomeLibero: "",
      corporazioni: [{ chiave: "", nome: "Nessuna Corporazione", scelta: true }],
      livelli: [{ valore: 2, scelto: false }]
    }],
    haBadge: true
  },
  vistaMasterCorpModifica: {
    vistaMasterCorp: true, schede: schede("corp"), vuoto: false, voci: [],
    badge: [], haBadge: false,
    _con: ['name="corpTitolo"', 'name="corpDestinataria"', 'name="corpTipo"',
           'name="corpLivelloArea"', 'name="corpImporto"'],
    scheda: {
      nuova: false, id: "1", titolo: "Archivio dati riservati",
      testo: "Serve l'autorizzazione del responsabile.", tag: "", livello: 4, importo: 0,
      tipi: [{ chiave: "avviso", etichetta: "Bacheca", scelto: false },
             { chiave: "accesso", etichetta: "Accessi", scelto: true }],
      corporazioni: [{ chiave: "*", nome: "Tutte le Corporazioni", scelta: false },
                     { chiave: "arasaka", nome: "Arasaka", scelta: true }]
    }
  },
  vistaMasterArena: {
    schede: schede("arena"), vuoto: false, danno: "2d6",
    righe: [
      { id: "1", nome: "Zero", gladiatore: "Ronin", haGladiatore: true,
        distrutto: true, duelli: 4, vinti: 3, persi: 1 },
      { id: "2", nome: "Rogue", gladiatore: "", haGladiatore: false,
        distrutto: false, duelli: 0, vinti: 0, persi: 0 }
    ]
  },
  vistaMasterTempo: {
    schede: schede("tempo"), dataLunga: "lunedi' 1 gennaio 2045", oraDelMondo: "00:00",
    settimanaNumero: 1, mesiAuto: true, rubricaVuota: false, scheda: null, vuoto: false,
    giornoOra: "2045-01-01", orarioOra: "00:00",
    salti: [{ chiave: "giorno", secondi: 86400, etichetta: "1 giorno" }],
    voci: [{ id: "1", titolo: "Consegna a Watson", riga: "3 gennaio 2045" }],
    coda: [{ attore: "a1", id: "d1", nome: "Zero", settimana: 1,
             etichetta: "Officina", icona: "i", nota: "ripara la moto" }],
    codaVuota: false,
    _con: ['data-action="tempoAvanza"', 'data-action="tempoMese"',
           'data-action="tempoImposta"', 'name="tempoGiorno"', 'name="tempoOrario"',
           'data-action="dtChiudi"', 'name="dtEsito-d1"']
  },
  vistaMasterTempoEvento: {
    vistaMasterTempo: true, schede: schede("tempo"), dataLunga: "d", oraDelMondo: "00:00",
    settimanaNumero: 1, mesiAuto: false, rubricaVuota: true, vuoto: true, voci: [],
    giornoOra: "2045-01-01", orarioOra: "00:00",
    salti: [], coda: [], codaVuota: true,
    scheda: { nuova: true, id: "", titolo: "", giorno: "2045-01-01", testo: "" },
    _senza: ['data-action="calElimina"']
  },
  vistaMasterStati: {
    schede: schede("stati"), vuoto: false,
    _con: ['data-action="revocaStato"', 'data-flag="medscan"', 'data-id="1"'],
    righe: [{
      id: "1", nome: "Zero",
      stati: [
        { flag: "medscan", nome: "MedScan", testo: "Pronto soccorso",
          scaduto: false, nota: "restano 45 min" },
        { flag: "fortify", nome: "4Tify", testo: "muretto",
          nota: "dado di danno in piu' non ancora speso" },
        { flag: "ziggurat", nome: "Ziggurat", testo: "Night City", nota: "non scade", fisso: true }
      ]
    }]
  },
  vistaMasterStatiScaduto: {
    vistaMasterStati: true, schede: schede("stati"), vuoto: false,
    righe: [{
      id: "2", nome: "Rogue",
      stati: [{ flag: "medscan", nome: "MedScan", testo: "Chirurgia",
                scaduto: true, nota: "gia' scaduto" }]
    }]
  },
  vistaMasterStatiVuoto: {
    vistaMasterStati: true, schede: schede("stati"), vuoto: true, righe: []
  },
  vistaMasterTavolo: {
    schede: schede("tavolo"), vuoto: false,
    giocatori: [
      { id: "1", nome: "Zero", numero: "555-0142",
        repNota: true, rep: 6, repLivello: "Ti conoscono in citta'" },
      // Una scheda senza reputazione leggibile: niente tasti, solo l'avviso.
      { id: "2", nome: "Rogue", numero: "555-0001", repNota: false, rep: null, repLivello: "" }
    ],
    candidati: [{ id: "3", nome: "Kiwi", numero: "555-0002" }],
    _con: ['data-action="repMuovi"', 'data-quanto="-1"', 'name="repMotivo-1"'],
    _senza: ['name="repMotivo-2"']
  }
};

let errori = 0;

for (const [nome, dati] of Object.entries(visteMaster)) {
  try {
    const { _senza = [], _con = [], ...contesto } = dati;
    const html = modelloMaster({ ...baseMaster, [nome]: true, ...contesto });
    if (!html.includes("agent-console")) throw new Error("resa vuota");
    // La marca sta sulla scocca: se qualcuno toglie `app-{{appCorrente}}`
    // dalla console, saltano tutti i casi insieme.
    if (!/agent-console app-\w+/.test(html)) throw new Error("scocca senza marca");
    for (const pezzo of _senza) {
      if (html.includes(pezzo)) throw new Error(`presente ma non dovrebbe: ${pezzo}`);
    }
    for (const pezzo of _con) {
      if (!html.includes(pezzo)) throw new Error(`manca dalla resa: ${pezzo}`);
    }
    console.log(`ok   ${nome}`);
  } catch (errore) {
    errori += 1;
    console.log(`ROTTA ${nome}: ${errore.message}`);
  }
}

for (const [nome, dati] of Object.entries(viste)) {
  try {
    const { _vietato = [], _senza = [], _con = [], ...contesto } = dati;
    const html = modello({ ...base, [nome]: true, ...contesto });
    if (!html.includes("agent-scocca")) throw new Error("resa vuota");

    const leggibile = senzaInstradamento(html);
    for (const numero of _vietato) {
      if (leggibile.includes(numero)) throw new Error(`numero coperto reso: ${numero}`);
    }
    for (const pezzo of _senza) {
      if (html.includes(pezzo)) throw new Error(`presente ma non dovrebbe: ${pezzo}`);
    }
    for (const pezzo of _con) {
      if (!html.includes(pezzo)) throw new Error(`manca dalla resa: ${pezzo}`);
    }

    console.log(`ok   ${nome}`);
  } catch (errore) {
    errori += 1;
    console.log(`ROTTA ${nome}: ${errore.message}`);
  }
}

if (mancanti.size) {
  console.log("\nchiavi di lingua mancanti:");
  for (const chiave of [...mancanti].sort()) console.log("  " + chiave);
  errori += mancanti.size;
}

process.exit(errori ? 1 : 0);
