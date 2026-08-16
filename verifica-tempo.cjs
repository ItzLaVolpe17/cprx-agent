/**
 * Prova l'aritmetica del calendario fuori da Foundry.
 *
 * Le funzioni **non sono ricopiate qui**: si estraggono da `agent.js` e si
 * eseguono quelle. Una copia si sarebbe scollata dal codice vero al primo
 * ritocco, e una prova che passa mentre il modulo e' rotto e' peggio di
 * nessuna prova.
 *
 * Si estrae solo il blocco delle funzioni pure — quelle che toccano solo
 * `Date` e un'impostazione. Il resto del modulo non viene caricato: qui non
 * c'e' Foundry, e non serve.
 *
 *     node verifica-tempo.cjs
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sorgente = fs.readFileSync(path.join(__dirname, "scripts/agent.js"), "utf8");

/**
 * Le funzioni da provare, prese per nome dal sorgente. Si taglia dalla
 * riga della dichiarazione fino alla graffa in colonna zero che la chiude:
 * nel file le funzioni di primo livello sono indentate cosi', sempre.
 */
function estrai(nome) {
  const inizio = sorgente.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`verifica-tempo: ${nome}() non c'e' piu' in agent.js`);
  const fine = sorgente.indexOf("\n}\n", inizio);
  if (fine < 0) throw new Error(`verifica-tempo: ${nome}() non si chiude`);
  return sorgente.slice(inizio, fine + 3);
}

const NOMI = [
  "dataZero", "istante", "chiaveGiorno", "daChiaveGiorno",
  "settimanaDiGioco", "settimanaDellAnno", "etichettaSettimana",
  "grigliaMese", "secondiAlMeseProssimo", "mesiScavalcati", "tempoDaData"
];

/* Le costanti dei tempi, sempre dal sorgente: se qualcuno cambia SETTIMANA
   la prova deve cambiare con lui, non restare indietro. */
const costanti = ["ORA", "GIORNO", "SETTIMANA"]
  .map(n => {
    const riga = new RegExp(`^const ${n} = .*;$`, "m").exec(sorgente);
    if (!riga) throw new Error(`verifica-tempo: la costante ${n} non c'e' piu'`);
    return riga[0];
  })
  .join("\n");

/* Il mondo finto: l'orologio e l'unica impostazione che queste funzioni
   leggono. Niente altro di Foundry serve. */
const scatola = {
  console,
  game: {
    time: { worldTime: 0 },
    settings: { get: (_modulo, chiave) => (chiave === "dataZero" ? scatola.ZERO : undefined) }
  },
  ZERO: "2045-01-01"
};

vm.createContext(scatola);

/* `const` dentro la scatola resta lessicale e non diventa una sua
   proprieta': per tirare fuori le funzioni il codice si chiude con un
   oggetto, e si prende quello che `runInContext` restituisce. */
const estratte = vm.runInContext(`
  const MODULO = "cprx-agent";
  ${costanti}
  ${NOMI.map(estrai).join("\n")}
  ({ ${[...NOMI, "ORA", "GIORNO", "SETTIMANA"].join(", ")} });
`, scatola);

const {
  istante, chiaveGiorno, daChiaveGiorno, settimanaDiGioco, settimanaDellAnno,
  etichettaSettimana, grigliaMese, secondiAlMeseProssimo, mesiScavalcati,
  tempoDaData, ORA, GIORNO, SETTIMANA
} = estratte;

/* ---------------------------------------------------------------------- */

let falliti = 0;
const eq = (nome, avuto, atteso) => {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  if (!ok) falliti += 1;
  console.log(`${ok ? "ok  " : "ROTTO"} ${nome}${ok ? ""
    : ` — avuto ${JSON.stringify(avuto)}, atteso ${JSON.stringify(atteso)}`}`);
};

/* --- le costanti --- */
eq("un'ora e' 3600", ORA, 3600);
eq("un giorno e' 86400", GIORNO, 86400);
eq("una settimana e' sette giorni", SETTIMANA, 7 * GIORNO);

/* --- la data di partenza --- */
eq("worldTime 0 e' il giorno zero", chiaveGiorno(istante(0)), "2045-01-01");
eq("un giorno dopo", chiaveGiorno(istante(GIORNO)), "2045-01-02");
eq("31 giorni dopo e' febbraio", chiaveGiorno(istante(31 * GIORNO)), "2045-02-01");
eq("mezzogiorno e' ancora lo stesso giorno", chiaveGiorno(istante(12 * ORA)), "2045-01-01");

/* --- i bisestili --- */
scatola.ZERO = "2048-02-28";
eq("2048 ha il 29 febbraio", chiaveGiorno(istante(GIORNO)), "2048-02-29");
scatola.ZERO = "2045-02-28";
eq("2045 salta al primo marzo", chiaveGiorno(istante(GIORNO)), "2045-03-01");
scatola.ZERO = "2045-01-01";

/* --- una data d'inizio scritta male non deve buttare giu' niente --- */
scatola.ZERO = "non una data";
eq("una data storta ripiega sul 2045", chiaveGiorno(istante(0)), "2045-01-01");
scatola.ZERO = "";
eq("vuota ripiega uguale", chiaveGiorno(istante(0)), "2045-01-01");
scatola.ZERO = "2045-1-5";
eq("mese e giorno a una cifra vanno bene", chiaveGiorno(istante(0)), "2045-01-05");
scatola.ZERO = "2045-01-01";

/* --- andata e ritorno delle chiavi --- */
eq("la chiave torna indietro", chiaveGiorno(daChiaveGiorno("2045-07-04")), "2045-07-04");
eq("una chiave storta da' null", daChiaveGiorno("quattro luglio"), null);
eq("una chiave vuota da' null", daChiaveGiorno(""), null);

/* --- le settimane di gioco --- */
eq("settimana 1 al giorno zero", settimanaDiGioco(0), 1);
eq("settimana 1 al sesto giorno", settimanaDiGioco(6 * GIORNO), 1);
eq("settimana 2 al settimo", settimanaDiGioco(7 * GIORNO), 2);
eq("settimana 3 al quattordicesimo", settimanaDiGioco(14 * GIORNO), 3);

/* --- la settimana dell'anno: e' il numero che l'utente legge --- */
const sett = (a, m, g) => settimanaDellAnno(new Date(Date.UTC(a, m - 1, g)));
// Il 2045 comincia di domenica: il 1 gennaio appartiene alla settimana 52
// del 2044, e la settimana 1 del 2045 parte il 2.
eq("1/1/2045 e' l'ultima settimana del 2044", sett(2045, 1, 1), 52);
eq("2/1/2045 e' la settimana 1", sett(2045, 1, 2), 1);
eq("8/1/2045 e' la settimana 2", sett(2045, 1, 9), 2);
// Il 2048 comincia di mercoledi': il primo gennaio e' gia' settimana 1.
eq("1/1/2048 e' la settimana 1", sett(2048, 1, 1), 1);
// Il 31 dicembre 2045 e' domenica: il giovedi' della sua settimana e' il 28,
// che dista 51 settimane dal primo giovedi' dell'anno. Fa 52, non 53.
eq("31/12/2045 e' la settimana 52", sett(2045, 12, 31), 52);
// Gli anni ISO lunghi esistono e devono uscire: fra il 2040 e il 2080 ce ne
// sono, e in quelli il 31 dicembre o il 28 dicembre tocca la 53.
eq("qualche anno arriva alla 53", (() => {
  let lunghi = 0;
  for (let a = 2040; a <= 2080; a += 1) if (sett(a, 12, 28) === 53) lunghi += 1;
  return lunghi > 0;
})(), true);
eq("resta sempre fra 1 e 53", (() => {
  let fuori = 0;
  for (let a = 2040; a <= 2080; a += 1) {
    for (let m = 1; m <= 12; m += 1) {
      for (const g of [1, 15, 28]) {
        const n = sett(a, m, g);
        if (!(n >= 1 && n <= 53)) fuori += 1;
      }
    }
  }
  return fuori;
})(), 0);

// Il numero mostrato non deve mai essere la chiave: in un mondo con
// l'orologio gia' avanti la chiave vale migliaia, il numero no.
const chiaveLontana = settimanaDiGioco(3321216427);
eq("la chiave di una settimana lontana e' grande", chiaveLontana > 5000, true);
eq("ma l'etichetta resta leggibile",
   etichettaSettimana(chiaveLontana) >= 1 && etichettaSettimana(chiaveLontana) <= 53, true);

/* --- i mesi scavalcati: e' quello che decide chi paga l'affitto --- */
eq("nessun mese in un giorno", mesiScavalcati(0, GIORNO), 0);
eq("nessun mese dal 1 al 31", mesiScavalcati(0, 30 * GIORNO), 0);
eq("un mese dal 31/1 al 1/2", mesiScavalcati(30 * GIORNO, 31 * GIORNO), 1);
eq("tre mesi in un colpo", mesiScavalcati(0, 90 * GIORNO), 3);
eq("dodici mesi sono un anno", mesiScavalcati(0, 365 * GIORNO), 12);
eq("indietro da' negativo", mesiScavalcati(31 * GIORNO, 0), -1);

/* --- la griglia del mese --- */
const gennaio = grigliaMese(0, istante(0));
eq("gennaio 2045 ha 31 giorni", gennaio.giorniNelMese, 31);
eq("la griglia e' rettangolare", gennaio.celle.length % 7, 0);
eq("i giorni del mese ci sono tutti", gennaio.celle.filter(c => !c.fuori).length, 31);
// Il 1 gennaio 2045 e' una domenica: con la settimana che parte di lunedi'
// deve avere sei caselle spente davanti.
eq("1/1/2045 e' domenica", new Date(Date.UTC(2045, 0, 1)).getUTCDay(), 0);
eq("sei caselle prima", gennaio.primaCasella, 6);
eq("la prima casella e' il 26 dicembre", gennaio.celle[0].chiave, "2044-12-26");
eq("l'ultima chiude la riga", gennaio.celle[gennaio.celle.length - 1].chiave, "2045-02-05");
eq("le caselle di coda sono spente", gennaio.celle[gennaio.celle.length - 1].fuori, true);

const febbraio = grigliaMese(1, istante(0));
eq("febbraio 2045 ha 28 giorni", febbraio.giorniNelMese, 28);
eq("febbraio comincia il primo", chiaveGiorno(febbraio.primo), "2045-02-01");
eq("anche febbraio e' rettangolare", febbraio.celle.length % 7, 0);

eq("indietro va a dicembre 2044", chiaveGiorno(grigliaMese(-1, istante(0)).primo), "2044-12-01");
eq("scarto -13 e' dicembre 2043", chiaveGiorno(grigliaMese(-13, istante(0)).primo), "2043-12-01");
eq("scarto 12 e' gennaio 2046", chiaveGiorno(grigliaMese(12, istante(0)).primo), "2046-01-01");

scatola.ZERO = "2048-01-01";
eq("febbraio 2048 ha 29 giorni", grigliaMese(1, istante(0)).giorniNelMese, 29);
eq("e resta rettangolare", grigliaMese(1, istante(0)).celle.length % 7, 0);
scatola.ZERO = "2045-01-01";

// Ogni mese di due anni: nessuno deve perdere o inventare giorni.
let storti = 0;
for (let m = -12; m <= 12; m += 1) {
  const g = grigliaMese(m, istante(0));
  const dentro = g.celle.filter(c => !c.fuori);
  if (g.celle.length % 7 !== 0) storti += 1;
  if (dentro.length !== g.giorniNelMese) storti += 1;
  if (dentro[0].numero !== 1) storti += 1;
  if (dentro[dentro.length - 1].numero !== g.giorniNelMese) storti += 1;
}
eq("venticinque mesi di fila, nessuno storto", storti, 0);

/* --- la data messa a mano: e' l'inverso di `istante()` --- */
eq("il giorno zero e' worldTime zero", tempoDaData("2045-01-01"), 0);
eq("un giorno dopo", tempoDaData("2045-01-02"), GIORNO);
eq("con l'ora", tempoDaData("2045-01-01", "14:30"), 14 * ORA + 30 * 60);
eq("mezzanotte e' zero", tempoDaData("2045-01-01", "00:00"), 0);
eq("senza ora vale mezzanotte", tempoDaData("2045-01-02"), tempoDaData("2045-01-02", "00:00"));
// Indietro rispetto allo zero: un numero negativo e' legittimo, e' un
// mondo ambientato prima dell'inizio contato.
eq("prima dello zero da' negativo", tempoDaData("2044-12-31"), -GIORNO);
// L'anno che si vuole: 2045 e 2074 sono i due casi veri.
eq("andata e ritorno sul 2074",
   chiaveGiorno(istante(tempoDaData("2074-11-16", "20:00"))), "2074-11-16");
eq("e l'ora torna", istante(tempoDaData("2074-11-16", "20:00")).getUTCHours(), 20);
// Trent'anni di scarto: il numero e' grande ma il giro chiude lo stesso.
eq("trent'anni avanti e indietro",
   chiaveGiorno(istante(tempoDaData("2075-06-30"))), "2075-06-30");

// Le storture danno null, non un ripiego: un ripiego qui vorrebbe dire
// spostare la campagna a un anno che nessuno ha chiesto.
eq("data storta da' null", tempoDaData("il 3 di maggio"), null);
eq("data vuota da' null", tempoDaData(""), null);
eq("ora storta da' null", tempoDaData("2045-01-01", "25:00"), null);
eq("minuti storti danno null", tempoDaData("2045-01-01", "10:99"), null);
eq("ora senza senso ripiega su mezzanotte", tempoDaData("2045-01-01", "boh"), 0);

/* --- il salto al mese prossimo --- */
eq("dal 1/1 al 1/2 sono 31 giorni", secondiAlMeseProssimo(istante(0)), 31 * GIORNO);
eq("dal 31/1 al 1/2 e' un giorno", secondiAlMeseProssimo(istante(30 * GIORNO)), GIORNO);
eq("il salto scavalca sempre un mese, e uno solo",
   mesiScavalcati(0, secondiAlMeseProssimo(istante(0))), 1);
eq("anche partendo da meta' giornata",
   mesiScavalcati(12 * ORA, 12 * ORA + secondiAlMeseProssimo(istante(12 * ORA))), 1);
eq("dicembre passa all'anno dopo",
   chiaveGiorno(istante(334 * GIORNO + secondiAlMeseProssimo(istante(334 * GIORNO)))),
   "2046-01-01");

// Dodici salti di fila devono cadere sempre sul primo, e mai saltarne uno.
let t = 0;
let primi = 0;
let mesi = 0;
for (let i = 0; i < 12; i += 1) {
  const passo = secondiAlMeseProssimo(istante(t));
  mesi += mesiScavalcati(t, t + passo);
  t += passo;
  if (istante(t).getUTCDate() === 1) primi += 1;
}
eq("dodici salti cadono tutti sul primo", primi, 12);
eq("e valgono dodici mesi tondi", mesi, 12);
eq("dodici salti da gennaio 2045 arrivano a gennaio 2046",
   chiaveGiorno(istante(t)), "2046-01-01");

console.log(falliti === 0 ? "\ntutto a posto" : `\n${falliti} rotti`);
process.exit(falliti === 0 ? 0 : 1);
