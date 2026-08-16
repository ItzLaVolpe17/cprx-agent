# cprx-agent — note per chi lavora su questo modulo

Modulo Foundry VTT che aggiunge un Agent giocabile al sistema Cyberpunk RED:
contatti, lavori, note, una vetrina per comprare oggetti dai compendi e un
App Store per le App di Black Chrome.

Ogni Agent ha un **numero**. Da quello passano messaggi, chiamate e le App
che richiedono due persone: si scrive il numero di un altro personaggio e i
due Agent si parlano. Le App comprate non sono piu' schede da leggere, ognuna
ha una sua schermata che fa qualcosa.

La corrispondenza sta **solo dentro l'Agent**: in chat non compare niente e
non resta niente. Come ci arriva, se un giocatore non puo' scrivere sulla
scheda di un altro, e' spiegato in "L'ufficio postale".

## Ambiente verificato

- Foundry VTT **v12** (`compatibility.maximum` è fissato a 12 di proposito).
- Sistema `cyberpunk-red-core`.
- 63 compendi presenti nell'installazione di riferimento, tutti sotto
  l'identificativo `cyberpunk-red-core.*`.

## Struttura

```
module.json            manifest
scripts/agent.js       tutto il codice: schema app, rete, meccaniche,
                       finestra, console del master, catalogo, hook
templates/agent.hbs    template unico, un blocco {{#if}} per ogni vista
templates/master.hbs   la console del master, nove schede
styles/agent.css       temi e presentazione
lang/it.json           testi italiani
lang/en.json           testi inglesi
verifica.cjs           rende ogni vista fuori da Foundry, non viene caricato
verifica-tempo.cjs     prova l'aritmetica del calendario, sempre fuori
assets/sfondi/         gli sfondi: un elenco chiuso, niente FilePicker
```

## Chi apre cosa

**Senza l'Agent in inventario il tasto non compare.** L'Agent è un oggetto:
`haOggettoAgent()` cerca fra le cose dell'attore un oggetto il cui nome
contiene `agent`, e `puoAvereAgent()` decide chi passa. Sono filtrati tutti e
quattro gli ingressi — tasto flottante, barra dei token, intestazione della
scheda, menu contestuale della rubrica — più una guardia in `Agent.apri()`,
perché da macro ci si arriva comunque.

Il master non è mai vincolato: gli serve poter guardare dentro il telefono di
chiunque, anche di un NPC a cui non ha mai messo l'oggetto in tasca.
L'impostazione di mondo `richiediOggetto`, **di serie accesa**, toglie del
tutto il vincolo per i tavoli che l'Agent lo danno per scontato.

Il confronto sul nome è **volutamente largo** (`/agent/i`, non `\bagent\b`).
Il sistema traduce i compendi con babele, e nelle sue tabelle l'oggetto si
chiama `Agent`, `Agente`, `Agent Interno`, `Agente interno`,
`Internal Agent`, `Interner Agent`, `Agent wewnętrzny`: un confine di parola
avrebbe fatto sparire il tasto a ogni tavolo che gioca in italiano.
`haAgentInterno()` usa la stessa costante più `intern|impiant|wewn`.

Il tasto flottante dipende da chi hai selezionato e da cosa ha in tasca,
quindi si rifà su `controlToken` e su `createItem`/`deleteItem` di un oggetto
Agent: senza quegli hook resterebbe appeso allo stato di quando è comparso.

`apriAgentGiusto()` decide. Con un token selezionato (o un personaggio
assegnato all'utente) si apre l'Agent di quell'attore. Senza, un GM ottiene
la **console del master** — `AgentMaster`, template suo (`master.hbs`).
Un giocatore senza token riceve l'avviso di sempre: per lui non c'è niente da
aprire.

### La console è un Agent anche lei

Non è il telefono di nessuno, ma è **fatta come gli altri**: stessa scocca,
stessa barra di stato con l'orologio, stessa testata di marca, stesso tema e
stesso accento del tavolo (`applicaTemaA()`, la stessa funzione delle due
finestre). Il motivo è pratico: un master che passa dal proprio banco
all'Agent di un giocatore non deve chiedersi quale dei due ha in mano.

E per non chiederselo servono i segni che li distinguono, che sono tre e
stanno sempre nello stesso posto:

| | Agent di un personaggio | Console |
|---|---|---|
| titolo | `Agent — Zero` | `Agent — Console GM` |
| barra di stato | `NET`, verde | **`GM`, rosso**, più il numero libero |
| bordo alto | niente | filo rosso, in tutte le linguette |

Il rosso è `--console-rosso` sulla scocca, **non** `--app-tinta`: la tinta
cambia con la linguetta — dentro la banca è verde — e il segno che dice
«questa è la console» deve restare lo stesso in tutte e nove.

La marca invece cambia con la linguetta, come sull'Agent cambia con l'App:
`AgentMaster.MARCHE` mappa ogni scheda su una chiave `app-<chiave>` messa
sulla scocca, quindi la banca diventa verde NIGHT CITY TRUST e l'NCPD blu
senza una riga di CSS in più. Le linguette che sull'Agent non hanno marchio —
posta, tempo, effetti, tavolo — ricadono su `console`.

La testata sta **fuori** dai blocchi delle viste: è una sola per otto
linguette, e legge da `base` come la barra di stato. Vale la regola di
sempre — quello che si rende fuori da un `{{#if vista...}}` va messo nel
contesto comune. E siccome non è dentro `.agent-schermo`, le regole
dell'insegna non la raggiungono: `.agent-console-testata` se le rifà, senza i
margini negativi che lì servono ad annullare il padding dello schermo.

Nove linguette: banca, casellario NCPD, posta del numero libero, **Database
Urbano**, **arena**, **tempo**, **effetti attivi**, **Corp Link** e rubrica del
tavolo. NCPD, Ziggurat e l'archivio aziendale sono i tre archivi
condivisi — impostazioni di mondo, scritte solo da qui, lette da chiunque
abbia l'App. La scheda Corp Link governa **tutta** l'App: archivio, badge del
tavolo e installazione, perché nel telefono di un giocatore non c'è niente
di tutto questo. L'arena mostra chi ha un gladiatore collegato, come sta andando,
e rimette in funzione un Agent bruciato senza far pagare niente.

**Nessuno degli effetti delle App si spegne da solo in modo affidabile**, ed è
il motivo per cui la scheda «effetti attivi» esiste. Il consulto MedScan muore
quando `game.time.worldTime` supera la sua ora: se il tavolo non fa avanzare
l'orologio del mondo — e con `avanzaTempo` spento non avanza mai — quel `+1`
resta acceso per sempre. La marcatura 4Tify aspetta che si spenda il dado, e
la città di Ziggurat non scade affatto. Da lì il master li vede tutti, sa
quali sono già scaduti ma ancora scritti sulla scheda, e li spegne con un
tasto: possiede ogni scheda, quindi scrive diretto senza buste né client
eletti. Chi aggiunge un'App con uno stato persistente la aggiunga a
`#contestoStati()` e all'elenco bianco di `#onRevocaStato()`.

La console non è il telefono di nessuno. Per scrivere *come* qualcuno il
master ha due strade: **impersonare** un attore (apre il suo Agent vero, con
il suo numero — nessuna macchina nuova sotto) oppure il **numero libero**, che
non ha una scheda dietro. Il destinatario si sceglie dall'elenco del tavolo —
il master non deve ricordarsi i numeri dei suoi giocatori — e il campo libero
resta per chi nel tavolo non c'è. Quel numero vive nell'impostazione di mondo
`identitaMaster`, insieme al suo archivio: `#rotta()` lo riconosce e
restituisce `attoreAltro: null, aMaster: true`, e il postino ne scrive una
copia lì oltre che sulla scheda di chi riceve. È l'unico capo di corrispondenza
senza attore, e l'unico che scriva in un'impostazione invece che in un flag.

## La prima accensione

Un Agent appena tirato fuori dalla scatola non è il telefono di nessuno, e
prima di lasciarti entrare fa quello che fa un telefono vero: chiede. Cinque
passi (`SETUP_PASSI`) — chi sei, che faccia ha, dove vivi, com'è fatto il
dispositivo — e alla fine si apre già sbloccato: hai appena finito di averlo
in mano.

**Non chiede niente di nuovo.** Ogni passo è un pezzo di una schermata che
esiste già — Impostazioni e Casa — chiesto una volta invece che lasciato da
cercare. I tasti dei temi e degli sfondi sono quelli veri (`scegliTema`,
`sfondo`): scrivono subito, e il setup li mostra e basta.

Le due metà stanno in due posti diversi, e non è un dettaglio: il passo dove
sei è `this._setupPasso`, sull'istanza come `_pagina`, e muore con la
finestra; **le risposte vanno sulla scheda a ogni passo**, quindi chi chiude
a metà ritrova il setup dove l'aveva lasciato invece di ricominciare.

Il segno che è stato fatto è il flag `setup`, una chiave sola e non un conto
dei passi: mezzo setup non esiste. **Un Agent già in uso non lo rivede**: il
setup è arrivato dopo, e senza un controllo su questo il primo aggiornamento
avrebbe messo la schermata di benvenuto davanti a chi gioca con quel telefono
da mesi. Basta un segno di vita — un handle, una voce in rubrica, un
messaggio in archivio.

Quel controllo però vale **solo finché il flag non c'è**: appena il setup
comincia, decide il flag. Senza quel ramo il primo passo si sabotava da solo
— scrivi l'handle, l'euristica vede un telefono «già usato» e ti butta fuori
a metà giro. Sta **dopo** la chiamata in arrivo e prima
del vetro di blocco — un telefono che squilla si risponde comunque, ma un
telefono nuovo non ha un vetro da alzare finché non sa di chi è. Chi non
possiede la scheda non lo vede: non avrebbe modo di rispondere.

### Il ripristino

In fondo alle impostazioni, e riporta l'Agent alla prima accensione.
Cancella quello che sta **sul dispositivo** — identità, preferenze, rubrica,
note, incarichi, archivio, registro della banca, stato delle App —
l'elenco è `CHIAVI_RIPRISTINO`.

Non tocca due cose, per due ragioni diverse: eurodollari e reputazione stanno
sulla **scheda** e non sul telefono, e le App comprate sono **pagate** — un
ripristino non ripresenta il conto. Si riscaricano da sole, come dopo un
Agent bruciato. Nemmeno il numero se ne va: è la scheda SIM, non i dati.

La conferma non è cerimonia: rubrica, note e archivio non tornano.

## La schermata di blocco

L'Agent si apre bloccato: ora, data, chi sei, e l'impronta in fondo. Non è una
password — i permessi di Foundry già decidono chi può aprire cosa. È il gesto.
`this._sbloccato` sta sull'istanza e torna a `false` alla chiusura: mettere via
il telefono lo riblocca.

**Una chiamata che squilla scavalca il blocco.** Sta prima nel giro di
`_prepareContext`, perché un telefono che suona lo rispondi senza sbloccarlo.

## La banca

I soldi restano dove sono sempre stati: `system.wealth.value` sulla scheda,
attraverso `trovaEddies()`. La Banca **non tiene un secondo saldo** — sarebbe
una seconda verità destinata a divergere. Tiene il registro, nel flag `banca`.

`accredita(attore, importo)` muove il denaro: positivo accredita, negativo
addebita, e non scende mai sotto zero. `paga()` è ora un suo caso particolare.

Due strade, per lo stesso motivo di sempre — sulla scheda di un altro non
puoi scrivere:

- **Master → giocatore:** il master possiede ogni scheda, quindi scrive
  diretto. Nessuna busta.
- **Giocatore → giocatore:** il mittente si addebita da solo; l'accredito
  viaggia come `accredito: { su, importo, causale, controparte }` sulla busta,
  e lo applica il client eletto da `toccaAMe()`. Stessa strada di MedScan.

L'addebito viene prima: se fallisce non parte niente. Resta il buco già noto
degli acquisti — soldi tolti e messaggio mai partito — che senza transazioni
non si chiude.

## La schermata principale

Viene dal progetto Claude Design **"Agent Phone Cyberpunk"**
(`Agent Phone.dc.html`). Tre pagine affiancate dentro una pista che scorre in
orizzontale, dentro `vistaHome`:

| pagina | cosa c'e' |
|---|---|
| 0 · quadro | data, orologio grande, blocco identita', scheda del dispositivo ridotta a tre righe, **notifiche** — **non scorre**: quello che non ci sta viene tagliato |
| 1 · applicazioni | la griglia, App di serie e App comprate |
| 2 · rete e sistema | numero, riempimento dell'archivio, stato del dispositivo, registro del traffico |

Si cambia pagina in tre modi: i trattini sotto la pista (`data-action="pagina"`),
le frecce sinistra e destra, il trascinamento. Il trascinamento scrive la
trasformazione **direttamente sul nodo** e ridisegna una volta sola quando si
lascia: un render per movimento del dito rileggerebbe tutto il filo e
perderebbe il gesto a meta'.

La pagina sta in `this._pagina`, sull'istanza e non in `this.stato`: entrare in
un'App e tornare indietro deve riportarti dov'eri, e `#vai()` azzera `stato`.

### Le notifiche

`#contestoNotifiche()` mette insieme tre sorgenti e ordina per data: il filo
(messaggi, squilli, sfide — **solo in arrivo**), il registro della banca, e le
voci `daMaster` di contatti, lavori e note. Ne restano otto.

Ogni riga dice *cos'è successo*, non cosa c'è scritto: `Chiamata persa`,
`Accreditati 2400 eb`. Una chiamata è persa se nella sua catena non compare
mai `risposta`. Il bordo a sinistra codifica il genere — giallo la
corrispondenza, cyan i soldi in entrata e il master, rosso quello che è andato
storto — e `nuovo` marca il non letto con un punto d'accento.

Toccare una notifica porta **dove è successa la cosa**: con un numero apre
quel filo (`apriConversazione`), senza apre l'App (`apriApp`). L'azione sta
nel contesto, non nel template.

**La copertura vale anche qui:** il mittente passa da `#coperto()` come in
ogni altra vista, e un numero coperto resta `???` anche in notifica.

**Il quadro non scorre.** È una schermata, non una lista: `.agent-pagina.quadro`
è `overflow: hidden` e l'elenco delle notifiche prende lo spazio che avanza
(`flex: 1 1 auto; min-height: 0`) nascondendo quello che eccede, con una
sfumatura sull'ultima riga perché una riga mozzata a metà è peggio di una
riga in meno. Il `min-height: 0` non è decorativo: senza, un figlio flex non
si stringe sotto il proprio contenuto e la pagina cresce lo stesso.

Del mockup **non** sono state portate la scocca del telefono, la tacca e i
tasti laterali: la finestra di Foundry e' gia' il telefono, e disegnarne un
altro dentro voleva dire due cornici. Non sono stati portati nemmeno segnale,
batteria e i tre interruttori della pagina di sistema, che nel mockup erano
numeri inventati: al loro posto ci sono le uniche cose che l'Agent sa
davvero di se' — numero, archivio, dispositivo impiantato, e il registro e' il
filo vero. Le tacche di segnale nella barra di stato sono rimaste, ma sono
`aria-hidden`: sono decorazione dichiarata, non una misura.

`style-hover` nel `.dc.html` **non fa niente**: il runtime del formato non lo
implementa (in `support.js` la parola "hover" non compare). E' l'annotazione
del progettista, e diventa una regola `:hover` vera qui.

## La forma delle App

Le due lingue visive del progetto di design convivono di proposito, e la
regola è: **la home è il sistema, le App sono applicazioni.**

Fuori — quadro, griglia, pagina di sistema — contorni netti, spigoli vivi,
celle attaccate con un filo in mezzo. Dentro un'App tutto diventa una
**scheda tonda** (`--agent-raggio`, 16px) con le righe separate da
`--agent-separatore`, un filo più tenue di `--agent-linea`: dentro una scheda
quel contrasto disegnerebbe un reticolo invece di un elenco.

Cinque pezzi ricorrono ovunque e stanno in un posto solo, sotto «i pezzi che
ricorrono in ogni App»:

| classe | cos'è |
|---|---|
| `.agent-pillola` (e `.agent-linguetta`) | il filtro tondo. Acceso si **tinge**, non si riempie |
| `.agent-cerca` | la barra di ricerca a pillola; il campo dentro perde bordo e fondo |
| `.agent-eroe` / `.agent-sfida` | la scheda d'apertura, con la tinta dell'App in sfumatura |
| `.agent-tondo-iniziali` | il tondo con le iniziali — per i contatti non ci sono ritratti |
| `.agent-cta` | il tasto pieno in fondo. **Uno solo per vista** |
| `.agent-tasto-lungo` | la pillola scarica che chiude un elenco: «+ nuovo messaggio», «+ nuova nota» |
| `.agent-punto` | il pallino del non letto |

Il pieno è riservato al `.agent-cta`, ed è la ragione per cui i filtri
restano tinti: se se lo prendessero anche loro non si capirebbe più qual è il
comando della schermata. Il `.agent-tasto-lungo` non gli fa concorrenza
perché non è un comando: in fondo a un elenco di conversazioni non c'è niente
da confermare, c'è la cosa che si fa dopo aver letto.

**Il non letto è un punto, non un contatore.** Quante righe non hai letto non
cambia niente, che ce ne siano lo cambia — e un numero dentro una pastiglia
rossa in mezzo a un elenco tirava l'occhio più del nome di chi ha scritto.
`.agent-conta` resta per il dock e per l'icona, dove il numero invece serve.

`.agent-elenco` **è** la scheda: niente `gap`, niente riquadri impilati. Chi
scrive un elenco nuovo non deve fare niente, e chi vuole un filo colorato a
sinistra (lo stato di un lavoro, una riga NCPD) usa
`box-shadow: inset 3px 0 0` e non `border-left` — un bordo vero rientrerebbe
il contenuto solo sulle righe che ce l'hanno, e l'elenco sembrerebbe storto.

La testata porta la tinta in sfumatura diagonale, il marchio sotto il titolo
e una **spia di marca in basso a destra**. Il filo lungo tutto il bordo alto
è stato tolto: sotto la tacca del telefono era una seconda riga orizzontale a
due millimetri dalla barra di stato. La spia sta in basso e non a metà
altezza perché lì finirebbe sotto i tasti che diverse testate hanno a destra.

## Lo sfondo

Si vede in due posti — la home e il **vetro di blocco** — e in nessun altro:
dentro un'App c'è un'applicazione a schermo pieno, e una foto sotto un
estratto conto è rumore. Il controllo sta nel contesto (`sfondoVisibile`,
messo da `#contestoHome()` e `#contestoBlocco()`) e **non** nel CSS: diverse
App si ridisegnano il fondo dello schermo per conto loro, e ognuna
vincerebbe su una regola generica.

Sopra l'immagine c'è un velo a gradiente che si chiude verso il basso. Non è
decorazione: le foto sono immagini vere, e senza velo il testo bianco su un
cielo chiaro non si legge.

**Le immagini sono un elenco chiuso**, in `assets/sfondi/`, dichiarato in
`SFONDI`. Aggiungerne uno è il file più una riga. Lo sfondo scelto sta nel
flag `sfondo` dell'attore — non è un'impostazione client come il tema: il
tema è il gusto di chi ha il monitor davanti, lo sfondo è il telefono di un
personaggio, e due personaggi dello stesso giocatore ne hanno due.

Questo **non** riapre la porta chiusa dalla trappola 1: qui non si carica
niente. Non c'è nessun `FilePicker` nell'Agent e continua a non essercene.

## La griglia delle App

Quattro colonne, e la mattonella non è più un riquadro: è un **quadrato
tondo** con dentro l'icona, e il nome sta **fuori**, sotto. Sopra uno sfondo
il nome dentro la casella non si leggerebbe, e per questo si porta dietro la
propria ombra.

La tinta la prende da `app-<chiave>`, che il template mette sulla mattonella
**e** che la scocca porta quando l'App si apre: i due selettori stanno nello
stesso blocco, quindi il colore di un'App è scritto in un posto solo. Chi
aggiunge un'App di marca non deve fare niente in più.

### Cosa c'è già e cosa si scarica

Un Agent nuovo ha undici App: **Telefono, Messaggi, ZPost, Ask Alex Anything,
Garden, Note, Incarichi, Banca, Negozio, Impostazioni e App Store**. Tutto il
resto si compra da lì dentro — anche le App gratuite del DLC che non sono in
questo elenco.

Le tre della Ziggurat — Alex, ZPost, Garden — sono gratuite nel manuale e
stanno **in `APP_ACQUISTABILI` come tutte le altre**, con `diSerie: true`.
Non sono un secondo elenco: un'App definita in due posti è un'App che prima o
poi diverge. La regola vive in un punto solo, `appPossedute()` e
`appInstallate()`, che le riportano sempre — quindi la griglia, il dock e lo
Store le vedono senza sapere niente di tutto questo. In catalogo compaiono
con la scritta «di serie» e nessun tasto: non c'è niente da comprare e niente
da togliere, e `#onDisinstallaApp()` rifiuta comunque, perché da macro ci si
arriva.

Casa e Calendario non sono in quell'elenco e restano lo stesso sulla griglia:
non sono App di Black Chrome, sono due meccaniche del modulo — l'affitto e il
tempo morto — e non hanno un prezzo da mettere in vetrina.

## Il quadro

Sotto l'identità ci sono **tre cifre** — rubrica, lavori aperti, street cred —
e non più la scheda del dispositivo. Modello e seriale non cambiano mai e si
leggono comunque nella pagina di sistema: nel quadro rubavano righe alle
notifiche, che sono la cosa che si guarda davvero. La reputazione non è una
copia: `trovaReputazione()` legge il ledger del sistema, come StreetWire.

La pagina di sistema ha in più due scorciatoie che su un telefono ci sono
sempre — le impostazioni per intero e il blocco (`data-action="blocca"`, che
rimette `_sbloccato` a `false` e torna alla prima pagina) — e la scheda del
dispositivo che veniva dal quadro. Il blocco sta **anche** in fondo alle
impostazioni, dov'è nel prototipo: è lo stesso `data-action`, non un secondo
meccanismo.

## Messaggi

L'elenco è quello del prototipo: tondo con le iniziali, nome e ora sulla
prima riga, anteprima e pallino del non letto sulla seconda. L'ora è
`etichettaQuando()` — l'orario se è di oggi, la data corta se è di prima: un
orario secco su una riga di tre settimane fa non dice niente, e una data
completa su una riga di stamattina ruba lo spazio al nome.

**Il campo del numero nuovo non è sempre aperto.** Lo apre la pillola in
fondo (`data-action="compositore"`), e lo stato sta in `this._compositore`
sull'istanza come `_pagina`: entrare in un filo e tornare indietro non deve
lasciarlo aperto, e `#vai()` lo azzera. Prima era una riga di modulo — campo,
due bottoni — in mezzo a un elenco di conversazioni, e la cosa che si fa
entrando nei messaggi è leggere quelli che ci sono, non scriverne uno nuovo.

La barra di scrittura di un filo ha il campo a pillola e l'invio in un tondo
pieno con la tinta dell'App: era l'ultimo spigolo rimasto sotto un filo di
bolle tonde.

## Phone

**Una sola App.** Contatti non ha più un'icona sua: `APP.contatti` porta
`dentro: "telefono"`, che la toglie dalla griglia della home e dice dove
tornare dopo aver salvato una voce (`#tornaDentro()`). Su un telefono la
rubrica non è un'applicazione a parte, ed era l'unica ragione per cui qui ce
n'erano due.

Dentro, quattro linguette in basso — `stato.telefonoScheda`, di serie
`tastierino`:

| linguetta | cosa c'è |
|---|---|
| preferiti | la stessa rubrica filtrata su `preferito` |
| recenti | lo storico delle chiamate, con l'esito |
| contatti | la rubrica, con la ricerca, chiama e il tasto per aggiungerne |
| tastierino | display, dodici tasti tondi con le lettere sotto le cifre, tasto verde |

I preferiti **non sono una seconda lista**: sono il campo `preferito` su una
voce di rubrica, e `#contestoRubrica(soloPreferiti)` è la stessa funzione.
Una lista di numeri a parte sarebbe stata una seconda verità da tenere
allineata alla prima.

### La scheda di un contatto

Sopra le quattro linguette ce n'è una quinta che non è una linguetta:
`stato.contattoNumero`. Prende tutto lo schermo, la barra delle linguette
resta, e toccarne una chiude la scheda — restare aperti su un contatto mentre
in fondo si accende «recenti» non vorrebbe dire niente.

**Si apre da un numero, non da un identificativo di rubrica.** Così funziona
anche per chi in rubrica non c'è: se la voce esiste si prendono ruolo, handle
e note, altrimenti resta il numero e il tasto «salva in rubrica».

La copertura vale qui come ovunque: di un numero coperto non si scrive la
cifra, non si offre di salvarlo e non compare la stella. Chiamare e scrivere
funzionano lo stesso, perché il collegamento passa da `data-numero`, che non
si legge.

**Le ricerche non guardano mai il numero** — né in rubrica, né nei messaggi,
né negli elenchi generici. Cercare per numero farebbe emergere un numero
coperto da quale riga resta in elenco: la copertura si perderebbe senza che
la cifra compaia mai da nessuna parte.

Il modulo dei contatti è quello generico di sempre: `nuovo` e `modifica`
accettano un `data-app`, e da lì aprono il modulo di un'altra App senza che
serva un elenco da cui partire.

**Lo storico delle chiamate sta qui, non nei messaggi.** `chiamateRecenti()`
accorpa per `idChiamata` e ricava l'esito dalla catena — persa se non c'è mai
stata una risposta. Il pallino sull'icona conta le perse non ancora guardate
(`chiamatePerse()`, flag `chiamateViste`).

**`conversazioni()` continua a leggere anche le chiamate**, e non è una
dimenticanza: è lì che si conta la copertura, e uno squillo anonimo è una
presentazione (`vocePresenta()`). Toglierle da quella funzione aprirebbe un
filo coperto. Si filtra dove si mostra, in `conversazioniSms()`.

### Chiamate a più capi

Una chiamata di gruppo è la stessa voce `TIPO.CHIAMATA` con dentro `membri` e
`aAttori` — le stesse due chiavi dei messaggi di gruppo, già gestite da
`consegna()` e `giacenza()`. Nessun registro nuovo: i partecipanti sono i
`membri` dell'ultima voce che li porta, e chi si aggiunge in corsa manda una
voce con l'elenco allargato.

Lo stato di ognuno si legge dalle sue voci: chi ha risposto, chi ha
rifiutato, chi ha riagganciato. Chi non compare sta ancora squillando, e chi
ha aperto la chiamata è in linea dal primo squillo. **`connesso` non è
`mioStato`**: chi chiama è «in linea» per definizione, ma finché non risponde
nessuno la sua schermata deve dire *sto chiamando* — e da `connesso` dipende
anche il permesso di mandare la chiamata in secondo piano.

`persa` vale per tutta la chiamata, non per un capo solo: la scrive chi
annulla uno squillo a cui non ha risposto nessuno, e da lì la telefonata è
finita per tutti. Senza quel controllo, una chiamata annullata di ieri
tornava a squillare all'apertura dell'Agent.

Chi riaggancia in un gruppo esce solo lui: gli altri restano, e la chiamata
finisce quando non ne resta nessuno. Chi è uscito sparisce dall'elenco dei
partecipanti, e il nome «Gruppo · N» conta chi c'è adesso.

### La chiamata in secondo piano

`this._chiamataSfondo` sta sull'istanza e non in `stato`, come `_pagina`:
`#vai()` azzera `stato`, e girare fra le App non deve far ripartire la
schermata a schermo intero. Ci va **solo una chiamata già risposta** — uno
squillo in arrivo prende sempre lo schermo.

Ne resta la striscia in cima, che sta in `base` perché si rende fuori dalle
viste. `#avviaCronometro()` scrive con `querySelectorAll("[data-durata]")`:
è la stessa trappola degli orologi.

## La scocca e il dock

La finestra dell'Agent **non ha cornice** (`window.frame: false`): il telefono
è disegnato dentro — guscio, tacca, tasti laterali, barretta — e due cornici
una dentro l'altra erano il motivo per cui il corpo del telefono non era mai
stato portato dal mockup.

Il prezzo è che trascinamento e chiusura non li dà più Foundry:

- il **manico** è la targhetta sopra il telefono (`data-manico`,
  `#agganciaTrascinamento()`), che scrive con `setPosition()` — funziona anche
  senza cornice;
- la **chiusura** è il suo tasto, con l'azione `close` di ApplicationV2, che
  vale anche a finestra senza cornice;
- gli ascoltatori del trascinamento stanno su `window` e vanno staccati alla
  chiusura, come quelli delle frecce;
- niente `resizable`: la maniglia sta sulla cornice, e un telefono ha la sua
  misura.

Il **dock** è l'altro pezzo del mockup che mancava: quattro tessere fisse
sotto lo schermo — Phone, Messaggi, Banca, Incarichi. Sta in `base`, come la
barra di stato. La rubrica non ci va: sta dentro Phone, a un tocco.

**Sul vetro di blocco, dentro una chiamata e su un Agent bruciato il dock non
c'è**: quelle tre viste coprono tutto lo schermo, e ci si arriva passando
`dock: null` nel loro contesto — è l'unico modo per spegnere una cosa che
sta in `base`.

Il telefono disegnato ha cambiato due dettagli che prima avevano senso: la
barra di stato non ha più fondo né riga sotto (su un telefono sta *sullo*
schermo, non sopra), e il filo d'accento in cima alla scocca è sparito —
era una cornice dentro un'altra. Il dock segue gli angoli smussati dello
schermo e non ha reticolo fra le tessere.

La console del master resta **con la cornice**: è un banco, non un telefono in
tasca.

## La Vetrina

Le righe sono quelle del prototipo: riquadro dell'immagine a sinistra, nome e
provenienza in mezzo, prezzo e disponibilità incolonnati a destra. Il
riquadro è **sempre quadrato e sempre della stessa misura**, anche quando
l'oggetto non ha un'immagine: un elenco dove le righe con l'icona rientrano e
le altre no sembra storto. Chi non ce l'ha mostra il tratteggio e la scritta
`IMG`, come nel mockup.

Resta invece la struttura a due schermate — banco delle categorie, poi la
merce con la briciola per tornare — che il prototipo non ha. Lì le categorie
sono una fila di pillole, e con sessanta compendi indicizzati quella fila
sarebbe stata sei righe di pillole prima di vedere il primo oggetto.

«Solo abbordabili» è diventato due pillole invece di un interruttore a icona:
`#onAbbordabili()` legge `data-tutti` per sapere quale delle due ha premuto.

## Casa e vitto

L'App **House** tiene dove vivi e quanto ti costa: alloggio (cubicolo, conapt,
conapt corporativo, villa, per strada) e vitto (kibble, generico, buono). Il
totale è il canone mensile.

Il **Corporativo** non paga: casa e vitto glieli dà l'azienda. Si riconosce
dal ruolo sulla scheda (`type === "role"` col nome che contiene
`corporate|corporativo|corpo`), e l'impostazione `corpGratis` spegne
l'automatismo per chi preferisce assegnare a mano. Un Corporativo non può
nemmeno cambiare alloggio dall'App: non è casa sua.

**Il canone scatta col calendario, e c'è voluto il calendario per farlo.**
Prima lo faceva partire solo il tasto del master, di proposito: appenderlo
all'orologio del mondo era lo stesso meccanismo che teneva il consulto MedScan
acceso all'infinito — se il tempo non avanza, non succede mai. Adesso il tempo
lo fa avanzare la console, quindi l'automatismo ha su cosa appoggiarsi.
`riscuotiMese()` sta fuori dalla console perché ha due chiamanti: il tasto e
l'hook del tempo. Chi non ha i soldi **non va sotto zero**: gli si segna un
mese di arretrato, e cosa succede a chi non paga l'affitto a Night City lo
decide il master. L'impostazione `mesiAuto`, di serie accesa, spegne
l'automatismo; il tasto resta in tutti e due i casi, e con l'automatismo
spento lo dicono tutte e due le parti — una riga sotto la levetta nella
console e una nota dentro House, perché una levetta da sola non dice in che
stato sei.

### Alloggi e vitto homebrew

`ALLOGGI` e `VITTO` restano le tabelle del manuale, ma non sono più l'unica
verità: l'impostazione di mondo `casaExtra` tiene le voci aggiunte dal master
e gli scostamenti sui canoni di serie.

```js
{ alloggi: [{ chiave, nome, canone }], vitti: [...], canoni: { conapt: 1200 } }
```

**Nessuno legge più `ALLOGGI` e `VITTO` direttamente.** Si passa da
`alloggi()` e `vitti()`, altrimenti un canone cambiato dal master vale in una
schermata e non nell'altra. Una voce del manuale porta `etichetta` (chiave di
lingua), una homebrew porta `nome` (testo scritto dal master):
`etichettaCasa()` risolve i due casi e nessun chiamante deve sapere quale ha
in mano.

Si scrive dalla console, scheda **Banca**: le righe del manuale hanno il
canone modificabile col prezzo di serie scritto accanto, le homebrew si
aggiungono in fondo. Il tasto di ripristino toglie una voce homebrew o rimette
il prezzo di serie — su una riga mai toccata non compare.

### Pagare il mese da soli

Il tasto `casaPaga` scala il totale e scrive la riga nel registro, con la
stessa strada della Banca: `accredita()` col segno meno più `segnaMovimento()`.
Serve in due casi — con `mesiAuto` spento è l'unico modo, e con l'automatismo
acceso salda un arretrato. Se un arretrato c'è, paga quello: chi deve un mese
non sta pagando in anticipo il prossimo.

**Lo storico dei pagamenti non è archiviato.** Sono le righe della banca che
portano la causale del canone, filtrate. Un secondo registro sarebbe una
seconda verità, la stessa ragione per cui la Banca non tiene un saldo suo.

Alloggio e vitto sono **pillole** e non più due menu a tendina: sono quattro
voci per uno, e una tendina per quattro voci nasconde la scelta dietro un clic
in più. Si premono e basta (`casaScegli`), come i temi — il tasto «salva» non
c'è più e con lui è sparito `#onCasaSalva`.

### Il Quartier Generale

Dal DLC «Non c'è Posto Come Casa»: quattro migliorie (`MIGLIORIE_QG`), 40
Punti Miglioria l'una. Due toccano il conto del mese — la riduzione
dell'affitto (un terzo) e l'orto idroponico (un quinto sul vitto) — e due
sono finzione: un'infermeria e un salotto non cambiano una cifra, cambiano
dove succedono le cose.

Gli sconti sono **percentuali** di proposito: «una fascia in meno» non si può
scrivere in una tabella dove il master ha aggiunto alloggi suoi. E si
arrotondano prima di sottrarre, perché un totale che non torna con le due
righe che lo compongono è un totale che nessuno crede — quando uno sconto c'è,
la scheda lo dice.

**I punti li dà il master**, dalla scheda Banca della console, a dieci per
volta: sono quello che la squadra si è costruita, non una cosa che si compra
col portafogli. Il giocatore li spende dall'App. Smontare una miglioria
restituisce i punti per intero: al tavolo vuol dire che nessuno resta
incastrato in una scelta.

## La reputazione

`cyberpunk-red-core` ce l'ha già, e messa bene: `system.reputation` è un
**ledger**, stessa forma di `wealth` — `value` più `transactions`, coppie
`[frase, motivo]`. E c'è l'API per muoverla:
`attore.deltaLedgerProperty("reputation", ±n, motivo)` aggiorna il valore
**e** scrive la riga, con la frase già tradotta nella lingua del tavolo.

Quindi l'Agent **non tiene niente**. Nessun secondo numero, nessun secondo
registro: sarebbero due verità destinate a divergere, la stessa ragione per
cui la Banca non tiene un saldo suo. L'App è una lente — se il master cambia
la REP dalla scheda, in StreetWire si vede subito, e viceversa. Provato: il
tasto della console scrive, e la scheda del personaggio dice lo stesso numero.

Il percorso non è indovinato: sta in
`modules/datamodels/actor/mixins/common-schema.js` e lo usa
`_createFacedownRoll()` per tirare COOL + REP.

**Chi non ce l'ha non rompe niente.** `trovaReputazione()` torna
`{valore: null}` su un attore che non ha quel campo — un `blackIce`, per dire
— e l'App mostra un avviso invece della schermata. Nella console quella riga
perde i tasti.

`LIVELLI_REP` è la tabella del manuale e sta in codice: chi gioca con numeri
diversi cambia quelle righe. La soglia oltre la quale «il nome gira da solo»
è invece l'impostazione `repPubblica` (di serie 5), perché lì è il tavolo che
decide quanto pesa la fama.

**Il motivo non è un optional.** Nel registro del sistema la colonna c'è, e
una riga senza motivo fra sei mesi non dice niente a nessuno. Il campo sta
accanto ai tasti nella scheda «Tavolo» della console — una riga per persona,
non una linguetta intera per un `+1`.

Quello che StreetWire **non** fa è cercare la reputazione degli altri: la
scelta è stata di tenere l'App sulla propria, e la soglia serve a dire quanto
lontano arriva il tuo nome, non a filtrare una ricerca che non c'è. Se un
giorno la ricerca si aggiunge, la regola è già scritta: sopra soglia ti trova
chiunque, sotto solo chi ti ha in rubrica.

## Il calendario e il tempo morto

`worldTime` è un contatore di secondi senza data: Foundry v12 non ha un
calendario. La data la fa `agent.js`, mettendo quello zero su un giorno vero —
l'impostazione **`dataZero`**, di serie `2045-01-01`.

I conti si fanno **in UTC**, e non è pignoleria: con l'ora locale un mondo
giocato a cavallo del cambio dell'ora legale sposta la mezzanotte di
sessanta minuti e i giorni cominciano a scivolare. `Date.UTC` più i `getUTC*`
tengono i giorni larghi esattamente 86400 secondi. Quanti giorni ha febbraio,
i bisestili, che giorno della settimana era: lo sa già `Date`. **Non c'è
nessuna aritmetica di calendario scritta a mano**, ed è voluto — è il genere
di codice che sembra giusto per anni e poi sbaglia un anno su quattro.

**Se `worldTime` non parte da zero, `dataZero` va spostato.** Basta che un
modulo di calendario sia passato di lì una volta e `worldTime` vale miliardi:
con lo zero al 2045 la data letta finisce nel 2150. Nel mondo di prova
`worldTime` era un timestamp Unix, e `dataZero: "1970-01-01"` rimette la data
sul 2075.

Detto questo, **`dataZero` non è il modo di scegliere l'ambientazione**: per
quello c'è «metti la data» nella console, che scrive dove vuoi stare e ci va.
`dataZero` è solo l'ancora fra il contatore di Foundry e il calendario, e la
si tocca una volta o mai.

### Mettere la data a mano

`tempoDaData()` è l'inverso di `istante()`: da una data e un'ora scritte
torna il `worldTime` corrispondente. Se la data non sta in piedi torna
`null` invece di ripiegare — un ripiego silenzioso qui vorrebbe dire spostare
la campagna a un anno che nessuno ha chiesto.

**Il salto non fa scattare niente**, e senza quello non funzionerebbe:
spostare la campagna dal 2075 al 2045 sono trent'anni, e l'hook conterebbe
trecentosessanta primi del mese scalando dodici canoni a gente che non ha
ancora giocato un turno. Impostare la data è configurazione, non tempo che
passa.

Il modo è la costante `SALTO_MANUALE`, passata nelle opzioni di
`game.time.advance(secondi, opzioni)`. Foundry le porta fino all'hook su
**tutti** i client: `ClientSettings#setWorld` le gira a `Setting#update`, e
`Setting._onUpdate` chiama `onChange(value, options, userId)` — che per
`core.time` è `GameTime#onUpdateWorldTime`, che a sua volta le passa come
terzo argomento di `updateWorldTime`. Verificato leggendo i sorgenti, non
supposto.

Indietro si torna, con una conferma: quello che è già successo resta
successo, e riavanzando il mese riscatta.

**I numeri di settimana sono due, e per lo stesso motivo.**
`settimanaDiGioco()` conta le settimane dallo zero dell'orologio ed è la
**chiave** con cui una dichiarazione di downtime si aggancia alla sua
settimana: stabile, mai mostrata. `settimanaDellAnno()` è la settimana ISO
dell'anno, sta sempre fra 1 e 53, e **è quella che si mostra** — in un mondo
con l'orologio già avanti la chiave vale cinquemila, e «settimana 5492» non
dice niente a nessuno. `etichettaSettimana()` traduce una chiave archiviata
nel numero da mostrare. Chi ordina una lista di settimane ordina per chiave,
mai per etichetta: due settimane di anni diversi hanno lo stesso numero.

### Chi fa scattare le conseguenze

L'hook è **`updateWorldTime`**, non i tasti della console: così le conseguenze
scattano anche quando l'orologio lo muove qualcos'altro — la barra di Foundry,
una macro, un altro modulo. `tempoAvanzato()` fa passare **un GM solo**, lo
stesso eletto che fa il postino (`sonoIlPostino()`): con tre GM collegati
l'affitto si pagherebbe tre volte.

**Solo in avanti.** Se il master riporta indietro l'orologio non succede
niente, e riavanzando il mese **riscatta**. Rimettere indietro il tempo è una
correzione, e correggere non deve svuotare i portafogli.

Quanti canoni: `mesiScavalcati()` conta i primi del mese attraversati, con un
tetto di dodici (`MESI_MASSIMI_IN_UN_COLPO`). Il tasto «al mese prossimo» non
salta trenta giorni fissi ma calcola i secondi che mancano davvero
(`secondiAlMeseProssimo()`): trenta giorni fissi fanno scivolare la data di
qualche giorno all'anno, e dopo un po' il primo del mese non cade più il primo
del mese.

### Le notifiche del tempo

Gli avvisi «nuova settimana» e «nuovo mese» non passano dal filo — non sono
corrispondenza, non hanno un mittente e non si risponde — quindi stanno nel
flag `calendario` dell'attore, che è la **quarta sorgente** di
`#contestoNotifiche()`. Il genere è sempre `master`: l'addebito del canone la
sua riga ce l'ha già dal registro della banca, e ripeterla la raddoppierebbe.

`calendario` e `casa` sono nell'elenco delle chiavi zitte di `updateActor`:
quando il tempo avanza il modulo scrive su tutte le schede del tavolo in un
colpo, e senza quello un mese che scatta seppellisce il tavolo di finestrelle.

### Il tempo morto

Le attività (`ATTIVITA`) sono **etichette, non meccaniche**. Il giocatore
dichiara cosa fa della settimana, il master legge, decide, scrive l'esito e
chiude. Il modulo non tira niente e non tocca la scheda.

È deliberato. Automatizzare la cura, gli IP o la paga voleva dire indovinare
dove stanno sulla scheda — la trappola già pagata con gli effetti, dove un
campo rinominato rompe tutto senza dirlo. Qui non c'è niente che possa
rompersi in silenzio, perché non c'è niente di automatico.

Una dichiarazione per settimana, nel flag `downtime` dell'attore. Finché il
master non l'ha chiusa resta modificabile dal giocatore; chiusa, non si tocca
più. La coda della console gira su **tutti** gli attori, non sulla rubrica:
chi ha dichiarato ha diritto a una risposta anche se dal tavolo l'hanno tolto.

Il calendario condiviso (`calendario`, impostazione di mondo) lo compila il
master dalla console: titolo, giorno, testo. È l'unica cosa del calendario che
non sta sui flag, come l'NCPD e Ziggurat.

## Gli effetti sulla scheda

MedScan e Ziggurat creano un **ActiveEffect** vero, con icona e durata: si
vede sul token e nella lista effetti, non solo dentro l'App.

**Il `+1` si somma davvero**, e i percorsi non sono indovinati:
`cyberpunk-red-core` espone le abilità agli ActiveEffect come
`bonuses.<abilità>`, con `mode: 2` (ADD). Le chiavi usate qui vengono dai
sorgenti del sistema (`grep -roh 'bonuses\.[a-zA-Z]*'`), e la forma è la
stessa degli effetti scritti a mano che già girano nel mondo di prova:

```json
{"key": "bonuses.paramedic", "value": "1", "mode": 2, "priority": null}
```

| Effetto | Chiavi |
|---|---|
| MedScan 100 E$ | `bonuses.firstAid`, `bonuses.paramedic` |
| MedScan 500 E$ | `bonuses.surgery`, `bonuses.medicalTechSkill` |
| Ziggurat | `bonuses.localExpert` (+2) |

**Un `change` senza il flag del sistema fa sparire l'effetto dalla scheda.**
`CPRMod` (in `rolls/cpr-modifiers.js`) legge:

```js
this.category = effect.flags[game.system.id].changes.cats?.[index];
```

L'optional chaining è su `.cats?.`, **non** su `flags[...]?.changes`: un effetto
con dei `changes` ma senza `flags["cyberpunk-red-core"].changes` lancia un
`TypeError` dentro `getAllModifiers()`, e quello porta giù l'intera lista degli
effetti della scheda. Non "appare sbagliato": sparisce tutto, e sembra che
l'effetto non venga più creato. `situational` va riempito per **ogni** indice,
perché lì il chaining si ferma prima di `.isSituational`.

`flagCambiamentiCpr()` costruisce il flag nella forma che usano gli effetti
scritti a mano nel sistema:

```json
{"cats": {"0": "skill"},
 "situational": {"0": {"isSituational": false, "onByDefault": false}}}
```

Nota di contorno: un effetto con `changes: []` finisce comunque fra i
Permanent (c'è un ramo apposta nella scheda), ed è il motivo per cui prima —
quando gli effetti non avevano modificatori — si vedevano lo stesso.

**L'effetto si costruisce sempre nel codice.** Non c'è nessun Item-modello da
cui copiare e nessun compendio: `accendiEffetto()` mette insieme icona, nome,
durata e `changes` e li scrive sulla scheda. Chi deve cambiare un bonus cambia
`MEDSCAN_LIVELLI` o `EFFETTI[chiave].modifiche()` in `agent.js`, e basta.

C'era una strada dei modelli — un Item del mondo per effetto, i `changes`
scritti dal master, un tasto nella console — nata quando il modulo non sapeva
dove stava il bonus sulla scheda. Ora lo sa: le chiavi `bonuses.*` sono
verificate contro i sorgenti del sistema e funzionano. Il modello era un
secondo posto da tenere allineato per un problema che non c'è più, quindi è
stato tolto — codice, impostazione `modelliEffetti`, template e chiavi di
lingua. Chi ha ancora gli Item-modello nel mondo li può cancellare a mano:
non li legge più nessuno.

**Resta il rischio del rinominamento.** Se un aggiornamento del sistema
cambiasse una di quelle chiavi, l'effetto smetterebbe di sommare **senza dire
niente** — è il modo peggiore in cui una cosa si rompe. Il segnale è la
scheda: se un effetto compare fra i Permanent ma nel tiro il `+1` non c'è, la
chiave è morta. Si riscrive qui.

| Effetto | Durata | Si spegne dalla console? |
|---|---|---|
| MedScan | 1 o 4 ore di mondo | Sì |
| Ziggurat | nessuna | **No** — è l'App comprata, non un buff |

`EFFETTI[chiave].revocabile` è il posto unico dove sta questa regola, e
`spegniEffetto()` la rispetta senza che il chiamante debba saperla.

## L'identità delle App

Ogni App ha il suo colore, e sono quelli del progetto Claude Design — **le
App di sistema comprese**. Prima Telefono, Messaggi, Incarichi, Note e
Impostazioni seguivano l'accento del tema; adesso no, e la ragione è la
stessa per cui il marchio non cambia col tema: su un telefono vero il verde
è la cornetta e l'azzurro sono i messaggi, e quel colore è dell'App, non
del gusto di chi ha il monitor davanti. L'accento del tema resta per quello
che App non è — home, vetro di blocco, chiamata.

La chiave dell'App aperta finisce **sulla scocca** (`app-<chiave>`, da
`appCorrente` in `base`): tutto quello che sta sotto eredita, quindi bastano
le variabili — non c'è una regola per ogni elemento di ogni App.

| App | Tinta | Marchio |
|---|---|---|
| Telefono | verde `#5ef2a0` | LINEA VOCALE |
| Messaggi | ciano `#35d0e0` | CANALE CIFRATO |
| Incarichi | ambra `#ffc93a` | GIG BOARD |
| Note | ghiaccio `#e0e6f0` | ARCHIVIO LOCALE |
| Impostazioni | grigio `#c9d1de` | CONFIGURAZIONE DISPOSITIVO |
| Banca | acido `#d9f43a` | NIGHT CITY TRUST |
| NCPD | blu `#2e8bff` | NCPD · RECORDS DIVISION |
| MedScan | rosa `#ff2e6e` | TRAUMA TEAM · TRIAGE |
| Digital Gladiator | arancione `#ff7a1a` | SEGOTARI ARENA |
| 4Tify | verdeacqua `#4ad9b5` | SECSYSTEMS 4TIFY |
| Ziggurat | ardesia `#8fa8c8` | ZIGGURAT · CITY GRID |
| StreetWire | magenta `#ff4f9a` | NIGHT CITY WIRE |
| Negozio | fucsia `#e04ba0` | STREETWARE |
| House | azzurro `#8ec5ff` | ALLOGGIO E SPESE |
| Calendario | rosso corallo `#ff6b6b` | AGENDA E SCADENZE |
| Corp Link | rosso corp `#e03b3b` | PORTALE DIPENDENTI |
| App Store | viola `#9b6cff` | BLACK CHROME |
| Netwatch Sentinel | viola `#9b6cff` | NETWATCH · DIFESA DI RETE |
| Patch Pro | verde `#6ee7a8` | ZIGGURAT · STUDIO CREATORI |
| Console GM | rosso `#ff3b52` | NIGHT CITY CONTROL · GM |

Le dieci App del DLC hanno le loro, e sono quelle del prototipo: Alex
`#5ad1ff`, ZPost `#c98cff`, Garden `#6ee7a8`, BangMe! `#ffb02e`, HusTool
`#ff8a3d`, Roach Race `#ff5f9e`, WatchBox `#4ad9b5`, Brainwasher `#a0b6ff`,
Elftracker `#8ef0d0`, Big IAAA `#ffe45e`.

App Store e Sentinel hanno **lo stesso viola**, e viene dal prototipo: sono
due cose diverse ma non si vedono mai nella stessa schermata.

Un'App di marca ridefinisce `--agent-accento` per tutto il proprio schermo,
così bottoni, icone, bordi e cifre la seguono senza altre regole. Il marchio
sta in `content: var(--app-marchio)` su `::after` della testata: chi non ce
l'ha rende la stringa vuota, e il template non sa niente di tutto questo.

**La testata arriva a filo dei bordi** con margini negativi che annullano il
padding di `.agent-schermo` (`1.15rem` in alto, `0.75rem` ai lati). Se quel
padding cambia, vanno cambiati anche quelli.

Oltre alla tinta, alcune App hanno una forma propria: la Banca è un estratto
conto (righe zebrate, cifre tabellari, nessuna cornice), l'NCPD è un terminale
di polizia (tutto monospaziato, fascicolo a righe diagonali), il Gladiator ha
l'alone dell'arena, 4Tify una griglia tattica di fondo. Le tre App di elenco
perdono le cornici e diventano righe con separatore, e un lavoro mostra lo
stato nel filo colorato a sinistra.

## Architettura

La finestra è una `ApplicationV2` con `HandlebarsApplicationMixin`, una sola
PART. La navigazione è tenuta in `this.stato`:

```js
{ app, modifica, categoria, sotto, ricerca, soloAbbordabili, mostraCategorie,
  conversazione, composto, bersaglio, foto, nota }
```

`_prepareContext` smista su `this.stato.app` e ogni vista ha il suo metodo
privato `#contestoQualcosa()`. Il template accende un solo blocco per volta.

Due viste scavalcano tutto, in quest'ordine, prima ancora di guardare
`this.stato.app`:

1. **Agent distrutto** — un duello perso brucia il dispositivo e non resta
   niente da usare.
2. **Chiamata in corso** — un telefono che squilla ha la precedenza su
   qualunque cosa tu stessi facendo.

Le azioni sono dichiarate in `DEFAULT_OPTIONS.actions` e agganciate nel
template con `data-action`. I valori dei moduli si leggono direttamente dal
DOM con `querySelector('[name="..."]')`: la gestione form di ApplicationV2 non
è usata, di proposito, per avere una cosa in meno che si rompe negli
aggiornamenti.

## Dove stanno i dati

Tutto nei flag dell'attore, sotto `flags["cprx-agent"]`:

| chiave | contenuto |
|---|---|
| `contatti`, `lavori`, `note` | array di voci, ognuna con `id` e `creato` |
| `handle`, `nomeVero` | le due identita'; `saluto` sceglie quale usa l'Agent |
| `banca` | registro dei movimenti — **non** il saldo, che sta sulla scheda |
| `gps` | tracciamento acceso, spia nella barra di stato |
| `numero` | numero di rete, `555-0142` |
| `filo` | l'archivio: messaggi, chiamate, sfide e servizi di questo Agent |
| `letti` | `{ chiaveFilo: quando }` — un numero, o `g:<id>` per un gruppo; serve solo ai pallini dei non letti |
| `chiamateViste` | quando hai aperto i recenti l'ultima volta: spegne il pallino delle perse |
| `appPossedute` | `[chiave]` — App comprate, per sempre |
| `appInstallate` | `[chiave]` — App attualmente sulla schermata |
| `agentDistrutto` | `true` dopo un duello perso |
| `agentInterno` | l'Agent è impiantato, non tascabile |
| `fortify`, `medscan`, `ziggurat` | stato delle App corrispondenti |
| `watchbox`, `brainwasher`, `bigiaaa` | stato delle App del DLC |
| `hustool`, `roachrace`, `elflines` | storico dei lavoretti, record, account dell'elfo |
| `downtime` | le settimane dichiarate, con l'esito scritto dal master |
| `casa` | alloggio, vitto, arretrati, migliorie del QG e Punti Miglioria |
| `sentinel`, `patchpro` | qualità del dispositivo e controscansioni, bozze della Patch |
| `sfondo` | quale sfondo, fra quelli che il modulo si porta dietro |
| `calendario` | `{ avvisi }` — settimane e mesi passati, per le notifiche |
| `setup` | `{ fatto, quando }` — la prima accensione è stata fatta |
| `corp` | per chi lavori: Corporazione, livello del badge, sospensione |

Una voce di `contatti` porta anche `nascosto`: verso quella persona, e solo
verso quella, il proprio numero esce coperto.

Scelta deliberata: i flag sull'attore danno gratis i permessi (il giocatore
possiede il proprio personaggio, il GM possiede tutto) e la propagazione a
tutti i client, senza socket. Il prezzo è che un array dentro un flag va
riscritto per intero a ogni modifica — irrilevante sotto le centinaia di voci.
Il `filo` è capato dall'impostazione `limiteFilo`, di serie 300 voci.

Fuori dai flag stanno gli archivi che non appartengono a nessun personaggio:
il casellario dell'NCPD (`ncpdSchedario`), il Database Urbano di Ziggurat, la
archivio aziendale di Corp Link (`corpArchivio`), il calendario del tavolo
(`calendario`) e la bacheca di Garden (`gardenPatch`).
Sono impostazioni di mondo. Su tutte tranne una scrive solo il GM; su Garden scrive
chiunque abbia l'App, ma non direttamente — il post passa dalla busta e lo
deposita il postino, che è un GM.

## L'ufficio postale

Il `filo` è l'archivio, ma un giocatore non può scrivere sulla scheda di un
altro: il messaggio ha bisogno di un mezzo per attraversare il tavolo. Quel
mezzo è un `ChatMessage` nascosto — una **busta** — che vive il tempo di
essere consegnata:

1. chi scrive crea la busta (`invia()`), sussurrata ai coinvolti e ai GM;
2. il **postino** — un GM solo, il primo collegato in ordine di id — la
   raccoglie, ne scrive una copia nel `filo` di tutti e due gli Agent (il GM
   possiede ogni scheda) e poi **la cancella**;
3. la finestra si aggiorna da sola, perché `updateActor` propaga il flag.

In chat non compare mai niente: la busta è nascosta dal foglio di stile e
dall'hook su `renderChatMessage`, e comunque dopo un istante non esiste più.

Se nessun GM è collegato la busta resta **in giacenza**, invisibile, finché
non ne arriva uno: `consegnaArretrati()` gira su `ready` e su `userConnected`.
Nel frattempo `traffico()` legge il `filo` e la giacenza insieme, senza
doppioni (`idVoce`), quindi il giro funziona lo stesso — cambia solo che la
posta non è ancora stata archiviata.

Una busta ha due capi, o più: `daAttore` e `aAttore` per la corrispondenza a
due, `aAttori` per un gruppo — il postino scrive una copia su ognuna di quelle
schede. Vedi «I gruppi».

Nel filo finisce solo la corrispondenza — `sms`, `chiamata`, `sfida`
(`TIPI_DA_ARCHIVIARE`). `esito` e `servizio` sono ordini di servizio: portano
una conseguenza, si consumano e spariscono. Un consulto MedScan lascia il suo
segno nel flag `medscan`, non serve anche la ricevuta nel filo.

Gli stati non sono scritti da nessuna parte: si ricavano leggendo la catena di
voci con lo stesso `idChiamata` o `idSfida`. Uno squillo senza risposta scade
da solo dopo 45 secondi, un invito a duello dopo dieci minuti, una chiamata
aperta dopo mezz'ora — senza timer da fermare quando si chiude la finestra.

## I gruppi

Un gruppo **non ha un registro**. Non c'è un'impostazione dei gruppi, non c'è
un flag `gruppi`: esiste nelle voci. Ogni SMS di gruppo porta `idGruppo`,
`nomeGruppo` e `membri` (i numeri), e il filo si ricava leggendoli — la stessa
strada con cui una chiamata ricava il suo stato dalla catena di messaggi.

Nel filo un gruppo si indirizza con una **chiave** `g:<id>` invece che con un
numero. `stato.conversazione` e la mappa `letti` accettano tutte e due le
forme, perché per loro sono solo stringhe; `chiaveGruppo()`, `eChiaveGruppo()`
e `idGruppoDa()` sono l'unico posto dove quella forma è scritta.

**Una busta sola, N copie.** `spedisciAlGruppo()` manda un `ChatMessage` con
`aAttori: [id...]`, e il postino ne scrive una copia sulla scheda di ognuno.
`consegna()` cicla su `[daAttore, aAttore, ...aAttori]` e `giacenza()` guarda
anche lì dentro, quindi un gruppo funziona anche mentre nessun GM è collegato.

L'elenco dei membri è quello dell'**ultima voce**. Da lì viene tutto il resto:
uscire da un gruppo è mandare una riga con l'elenco accorciato
(`#onGruppoEsci`), e da quel momento le voci nuove non ti nominano più e non ti
arrivano. Quelle vecchie restano sulla tua scheda, come in un telefono vero.

**In un gruppo il numero non si copre**, ed è una regola, non una svista:
`invia()` forza `anonimo: false` quando c'è un `idGruppo`. Un `???` in mezzo a
sei persone non sarebbe copertura, sarebbe un buco nell'elenco dei membri. Da
qui discende l'altra metà: chi nasconde il proprio numero verso qualcuno **non
lo può mettere nel gruppo** — i candidati coperti non compaiono nell'elenco, e
`#onGruppoCrea()` rifiuta anche se il numero lo si scrive a mano.

Nel filo di un gruppo non c'è il tasto chiama e non c'è salva-contatto: si
chiama una persona, non sei, e in rubrica ci va un numero, non un elenco. Ogni
bolla porta il nome di chi ha parlato (`agent-bolla-mittente`) — senza, un filo
a sei voci è illeggibile.

### I due modi del master

Sono due cose diverse, e per questo sono due tasti e non un'opzione dentro allo
stesso:

| tasto | cosa fa |
|---|---|
| **A ognuno, separati** | la stessa riga in fili separati, uno per destinatario: nessuno sa degli altri |
| **Al gruppo, insieme** | un filo solo col master dentro: si vedono tutti e rispondono a tutti |

I destinatari si spuntano nell'elenco del tavolo (`mdest-<numero>`), più il
campo libero per chi nel tavolo non c'è. Il gruppo del master ha il numero
libero fra i membri: `spedisciAlGruppo()` riconosce quel numero, marca
`aMaster` e il postino ne archivia la copia nell'impostazione di mondo, come
per la corrispondenza a due.

## Numero coperto

Si nasconde **per contatto**, non in blocco: la spunta sta sulla voce della
rubrica (`nascosto`), e vale solo verso quella persona. `nascondoCon()` la
legge al momento dell'invio e marca `anonimo: true` sulla busta. Chi non è in
rubrica riceve il numero in chiaro.

Chi riceve non vede niente: al posto del nome un `???`, nessun recapito,
nessuna informazione, e **il numero non compare da nessuna parte** — né nel
filo, né nella schermata di chiamata, né richiamando indietro. Il collegamento
però resta, e passa dal numero: rispondere e richiamare funzionano lo stesso.

**In rubrica non ci va.** Un numero coperto non si salva fra i contatti: il
tasto non compare e `#onSalvaContatto` rifiuta comunque, perché una voce di
rubrica porta il numero scritto per esteso ed è esattamente quello che la
copertura deve impedire. Chi ha ancora contatti salvati da prima li vede
`???` e non li può aprire in modifica.

Una conversazione è coperta finché **ogni voce che apre un contatto** è
anonima. Sono voci che aprono un contatto solo gli SMS e lo squillo di una
chiamata (`vocePresenta()`): risposta, chiusura e rifiuto sono contabilità,
arrivano anche da me e non scoprono niente. Il conto si fa sulle voci grezze
in `conversazioni()`, **prima** che la catena di una chiamata si accorpi in
una riga sola. Se l'altro si presenta una volta in chiaro, il filo si scopre e
resta scoperto. `numeriCoperti()` riporta la copertura anche nell'elenco dei
contatti e nelle chiamate in uscita: richiamare un filo coperto non scrive il
numero sul display.

Il GM è coperto come tutti gli altri: la posta la smista lo stesso — è codice,
non interfaccia. L'impostazione di mondo `gmVedeCoperti`, **di serie spenta**,
la riapre per chi vuole tenere il tavolo sotto controllo. Il controllo sta in
un posto solo, `vedoInChiaro()`, e lato finestra passa tutto da `#coperto()`.

**È una convenzione da tavolo, non un lucchetto.** Il numero vero resta nella
voce, e la voce sta sulla scheda di chi la riceve: chi apre la console lo
trova. Serve a far giocare «numero sconosciuto», non a reggere contro un
giocatore che vuole barare.

Detto questo, la regola che vale è: **il numero coperto non finisce mai in
qualcosa che l'utente legge.** Nei `data-numero` sì — servono a instradare —
ma mai in un testo reso, e mai dentro un campo di modulo. Per questo i
recenti del telefono aprono il filo invece di riempire il display: scriverci
dentro il numero sarebbe stato mostrarlo. `verifica.cjs` controlla proprio
questo: toglie gli attributi `data-numero` dalla resa e cerca il numero in
quello che resta (`_vietato`).

Vale anche per la busta, che pure dura un istante: con `anonimo` l'alias del
`ChatMessage` è `AGENT` e basta, e `cartaChat()` mette `???` al posto del
mittente. Il contenuto della busta arriva a tutti i client comunque.

## Cancellare una chat

`cancellaChat` filtra il `filo` togliendo le voci con quel numero all'altro
capo — o, se la chiave è `g:<id>`, quelle di quel gruppo e solo quelle.
Sparisce solo dalla propria scheda: la copia dell'altro resta dov'è,
come in un telefono vero. Se qualche busta era ancora in giacenza, quelle
righe tornano quando il postino le consegna — è un caso di bordo, capita solo
cancellando mentre nessun GM è collegato.

## Chi applica le conseguenze

Le App applicano gli effetti da sole, ma l'effetto va scritto sulla scheda di
chi lo subisce e solo un suo proprietario può farlo. Il messaggio arriva a
tutti i client, quindi `applicanteDi()` ne elegge uno — il primo giocatore
collegato, altrimenti il primo GM — e `toccaAMe()` fa passare solo quello.
Tutti gli altri client ignorano.

Due strade, entrambe dentro l'hook `createChatMessage`:

- `perdente` sul messaggio di esito → il client eletto per quella scheda
  chiama `bruciaAgent()`.
- `applica: { su, flag, valore }` → il client eletto scrive quel flag. È la
  via generica per gli effetti a distanza: la usa MedScan per attivare un
  consulto pagato sull'Agent di un altro.

**Eurodollari:** `system.wealth.value` nell'installazione di riferimento.
`trovaEddies()` prova sei percorsi noti, poi ripiega sugli oggetti di tipo
contante. C'è un'impostazione di mondo per forzare il percorso a mano.

## Trappole già pagate — non ripeterle

1. **Non c'è nessun `FilePicker`.** L'Agent non è un canale per mettere
   immagini nel mondo: l'NCPD non ha le foto per questo, e lo sfondo si
   sceglie da un **elenco chiuso** che il modulo si porta dietro — non da un
   percorso che scrivi tu. Le due cose sembrano la stessa e non lo sono: una
   lista non carica niente. Se qualcuno rimette un `FilePicker` sappia che è
   dichiarata con `class` e vive nell'ambiente lessicale globale: va
   referenziata nuda, protetta da `typeof`, perché `globalThis.FilePicker`
   restituisce `undefined`.
2. **`.agent-schermo` è una colonna flessibile.** Un bottone con `flex: 1` non
   si allarga: si allunga in verticale fino a riempire lo schermo.
3. **`:has(> i:only-child)` non fa quello che sembra.** I nodi di testo non
   contano come figli, quindi matcha anche i bottoni con icona *e* scritta. I
   bottoni quadrati sono marcati a mano con `.agent-solo-icona`.
4. **I selettori di Foundry pesano quanto i tuoi.** A parità di specificità
   vince il suo foglio di stile. Le regole sui bottoni passano da
   `.cprx-agent .agent-scocca button` per guadagnare peso; quelle sul tasto
   esterno usano l'identificativo `#cprx-agent-tasto`.
5. **Le classi dei temi valgono sull'elemento radice.** Applicarle a un figlio
   non fa niente: le macchie colorate nelle impostazioni hanno regole proprie
   (`.macchia-notte` e simili). Ci passano tutte e due le finestre, da
   `applicaTemaA()`: una finestra nuova che non la chiama resta col tema di
   serie e si vede subito che è un'altra cosa — è quello che faceva la
   console prima.
6. **`getSceneControlButtons` riceve un array in v12** e un oggetto dalla v13.
   È il primo punto che si romperà aggiornando.
7. **`getIndex({fields})` accetta percorsi annidati.** Le sottocategorie sono
   ricavate indicizzando sette campi candidati e scegliendo, per ogni
   categoria aperta, quello che produce più gruppi distinti. Non c'è un campo
   fisso: il sistema non lo documenta.
8. **Mai attaccare `rolls` a una busta.** Il getter `visible` di
   `ChatMessage` lascia passare i tiri anche quando c'è un `whisper`: una
   busta in giacenza finirebbe sotto gli occhi di tutto il tavolo. I tiri
   pubblici passano da `annuncia()`, che è un'altra cosa e può usare `rolls`
   perché quelle carte sono pubbliche di proposito.
9. **Le carte in chat vivono fuori da `.cprx-agent`.** Non vedono le variabili
   del tema, che stanno sull'elemento radice della finestra: `.cprx-carta` si
   porta dietro le proprie.
10. **Una chiamata si chiude con un messaggio, e quel messaggio può non
    arrivare mai.** Chi chiude il browser a metà telefonata lascerebbe la
    schermata di chiamata incollata sull'Agent: il tetto di mezz'ora in
    `chiamataCorrente()` è quello che ripulisce da solo. Vale per ogni stato
    che si ricava da una catena di messaggi.
11. **Il tastierino rilegge sempre il campo prima di aggiungere una cifra.**
    Altrimenti un numero scritto a mano viene cancellato dal primo tasto
    premuto, perché `stato.composto` non lo conosce.
12. **Il postino consegna per ultimo.** Nell'hook `createChatMessage` la
    cancellazione della busta viene dopo l'applicazione delle conseguenze e
    dopo l'avviso al destinatario: l'ordine degli eventi è garantito per
    client, ma leggere i dati da `f` — una copia dei flag, non il documento —
    è quello che rende la cosa a prova di corsa.
13. **`updateActor` scatta a ogni messaggio, adesso.** Il postino riscrive il
    `filo` di due schede per ogni riga di chat, quindi l'avviso «Agent
    aggiornato» va zittito quando i cambi toccano solo `filo` e `letti`,
    altrimenti il tavolo annega nelle notifiche doppie.
14. **Il casellario NCPD è un'impostazione di mondo, non un flag.** Ci scrive
    solo il GM: `scriviSchedario()` chiamata da un client giocatore fallisce
    in silenzio. Per questo i tasti di scrittura stanno **solo** nella console
    del master, e l'App NCPD dentro un Agent non ne ha nessuno — nemmeno
    quando è un GM a tenerlo in mano. Un Agent è il telefono di un
    personaggio, e da un telefono non si mette gente nel casellario della
    polizia. In `AgentMaster` la linguetta aperta sta in `stato.scheda` e la
    scheda NCPD in lavorazione in `stato.fascicolo`: due cose diverse, due
    chiavi diverse, e confonderle apre il form ogni volta che cambi tab.
15. **La riga accorpata di una chiamata non dice chi ha chiamato.**
    `conversazioni()` tiene una riga sola per `idChiamata`, quella con lo
    stato più recente — e l'evento più recente spesso è mio (la risposta, la
    chiusura). Quindi `daNome`, `da` e `anonimo` di quella riga sono i miei,
    non di chi ha chiamato. Leggerli lì scopriva il filo a ogni telefonata:
    la copertura si conta sulle voci grezze, e il testo della bolla ricava i
    capi dal numero del filo (`#testoChiamata()`), non dalla voce.
16. **Gli orologi sono due.** Quello della barra di stato e quello grande del
    quadro portano tutti e due `data-orologio`: `#avviaOrologio()` scrive con
    `querySelectorAll`, perche' con `querySelector` il secondo restava fermo
    su `--:--` per sempre. Vale per qualunque cosa si aggiorni nel DOM senza
    ridisegnare.
17. **La home non ha `.agent-schermo`.** Ha `.agent-vetrino` (che non scorre
    mai) e tre `.agent-pagina` (che scorrono per conto loro). Chi cerca il
    contenitore da scorrere deve prendere `.agent-pagina.attiva` e ripiegare
    su `.agent-schermo`, come fa il ripristino dello scorrimento.
18. **Quello che serve alla barra di stato va in `base`.** La barra sta fuori
    da ogni blocco `{{#if vista...}}`, quindi legge solo dal contesto comune:
    `gps` messo nel contesto della pagina di sistema lasciava l'interruttore
    spento per sempre e la spia invisibile, anche col flag acceso. Vale per
    qualunque cosa si renda fuori dalle viste.
    E **la barra deve anche stare sopra**: la scocca ha quattro figli
    posizionati che la coprono — sfondo, velo, riflesso del vetro, spazzata —
    e un elemento statico finisce sotto anche a `z-index: 0`. `.agent-stato`
    porta `position: relative; z-index: 11`. Senza, l'ora e la rete
    sparivano su home e vetro di blocco, le uniche due viste dove lo sfondo
    si vede — e da nessun'altra parte, il che rendeva il difetto illeggibile.
19. **L'ascoltatore delle frecce sta su `window`.** Va staccato uscendo dalla
    home e alla chiusura, altrimenti resta appeso e ridisegna a vuoto mentre
    sei dentro un'App. Se ne occupa `#staccaTasti()`.
20. **La regola generica sugli input colpisce anche le checkbox.**
    `.cprx-agent input` dava bordo, fondo e padding a *qualunque* input: la
    checkbox disegnava la sua casella nativa dentro quel riquadro — due
    riquadri annidati, e il padding scentrava quello interno. Le caselle
    adesso sono `appearance: none` e diventano `.agent-leva`, la stessa
    levetta della pagina di sistema. Chi aggiunge un input di tipo nuovo
    (`range`, `color`, `file`) trovera' la stessa trappola.
21. **I nomi dei compendi passano da babele.** I pack del sistema sono in
    inglese, ma al tavolo l'oggetto si chiama come l'ha tradotto babele.
    Qualunque confronto sul nome di un oggetto va provato contro le tabelle
    in `systems/cyberpunk-red-core/babele/`, non contro il pack: `\bagent\b`
    sembrava giusto e non prendeva «Agente».
22. **Le sottocategorie della Vetrina si scelgono per copertura, non per
    numero di gruppi.** Un pugno di cyberware sono anche armi e portano un
    `system.weaponType`: quel campo vale per dieci pezzi su ottanta, ma con
    dieci valori diversi vinceva su `system.type` — e il Cyberware finiva
    diviso in «Lanciagranate» e «Corpo a corpo pesante».
    `assePerCategoria()` guarda prima `CAMPI_PREFERITI`, poi sceglie il
    campo che **copre più articoli**, e scarta chi ne copre meno di metà.
23. **Il selettore di file c'è solo nella console del master.** Il master può
    già caricare file ovunque in Foundry, quindi non gli si sta dando niente
    di nuovo; dall'Agent di un giocatore non si carica niente, e la regola
    del progetto resta in piedi dove conta. Vale sempre la trappola di
    `FilePicker`: dichiarata con `class`, va referenziata nuda e protetta da
    `typeof`, perché `globalThis.FilePicker` è `undefined`.
24. **Un ActiveEffect con `changes` ha bisogno del flag di
    `cyberpunk-red-core`.** Senza, `CPRMod` lancia e la scheda smette di
    mostrare **tutti** gli effetti, non solo il tuo. Passa da
    `flagCambiamentiCpr()`. Vedi «Gli effetti sulla scheda».
25. **Il saluto sta nell'accensione, non nella barra di stato.** Lì veniva
    troncato dopo tre parole. `.agent-avvio` però compare solo alla prima
    apertura della finestra (`_avviato`), non a ogni ridisegno: se serve
    rivederlo, si chiude e si riapre l'Agent.
26. **`worldTime` non parte da zero, e non puoi contarci.** In un mondo dove
    qualcuno ha già toccato l'orologio vale miliardi: il numero di settimana
    contato da lì fa 5492, e con `dataZero` al 2045 la data finisce nel 2150.
    Qualunque numero ricavato da `worldTime` e mostrato all'utente va ancorato
    al **calendario**, non al contatore — vedi i due numeri di settimana.
27. **Le conseguenze del tempo stanno nell'hook, non nei tasti.**
    `updateWorldTime` scatta anche se l'orologio lo muove un altro modulo o
    una macro; un tasto no. E devono passare da un GM solo: con tre GM
    collegati l'affitto si paga tre volte. Chi aggiunge un modo di muovere
    l'orologio che **non** deve avere conseguenze passi `SALTO_MANUALE` nelle
    opzioni, come fa «metti la data».
    Nota per chi prova a mano: `game.time.advance()` è relativo e
    asincrono. Due chiamate sovrapposte si calcolano tutte e due sul
    `worldTime` di partenza e il risultato non è la somma — in una sessione
    di prove è il modo più facile di leggere un bug che non c'è. Si aspetta
    che una finisca prima di lanciare l'altra, o si ricarica la pagina.
28. **Quello che il sistema tiene già, l'Agent lo legge — non lo ricopia.**
    `system.wealth` e `system.reputation` sono ledger suoi, con la loro API
    (`deltaLedgerProperty`). Tenerne una copia nei flag darebbe due verità
    destinate a divergere, e il giorno che divergono nessuno sa quale sia
    quella buona. Vale per qualunque cosa il sistema modelli già.
29. **Senza cornice non c'è più niente di gratis.** Con `window.frame: false`
    Foundry non dà trascinamento, chiusura, `bringToFront()` sul clic né
    `position: absolute`: vanno rifatti tutti e quattro a mano
    (`#agganciaTrascinamento()`, l'azione `close`, la regola
    `.cprx-agent.cprx-agent-telefono`). Il `setPosition()` invece funziona
    lo stesso — non dipende dalla cornice.
30. **La regola generica nasconde ogni checkbox.** `.cprx-agent
    input[type="checkbox"]` la porta a `opacity: 0`, `position: absolute` e
    larghezza zero, perché di serie le caselle qui diventano levette con un
    `.agent-leva` accanto. Una lista da spuntare — i membri di un gruppo, i
    destinatari del master — non è una fila di interruttori: `.agent-scelta
    input[type="checkbox"]` la rimette visibile, e vanno rimessi **anche**
    `position` e `opacity`, non solo le misure.
31. **Una cella di calendario è un bottone, e i bottoni della scocca hanno
    già delle regole.** `.agent-cal-cella` azzera padding e bordo e riparte:
    senza, la griglia diventa una colonna di rettangoli alti. Vale per
    qualunque cosa si disegni con dei bottoni invece che con dei `div`.
32. **Foundry porta i bottoni a larghezza piena, e in un contenitore flex
    quella larghezza diventa la base.** Due pillole affiancate finivano una
    sotto l'altra, larghe quanto lo schermo, e due `.agent-cta` sulla stessa
    riga sbordavano. `flex: 0 0 auto` non basta: va scritto anche
    `width: auto`. La regola che lo rimette deve pesare almeno quanto
    `.cprx-agent .agent-scocca button.<classe>`, altrimenti perde.
33. **`overflow-y: auto` accende anche l'altro asse.** Per le regole del CSS
    `overflow-x` smette di valere `visible` e diventa `auto` lui pure: due
    pixel di troppo bastavano a far comparire una barra di scorrimento
    orizzontale in fondo allo schermo. `.agent-schermo` porta
    `overflow-x: hidden` — un telefono non scorre di lato.
34. **In una colonna flessibile un figlio si stringe sotto il proprio
    contenuto.** È la trappola 2 vista dall'altro verso: lì un bottone si
    allungava, qui la carta della banca si schiacciava e tagliava la cifra a
    metà. Le schede che devono tenere la propria altezza portano
    `flex: 0 0 auto`, e l'elenco sotto «i pezzi che ricorrono in ogni App» è
    il posto dove aggiungerne una nuova.
35. **I margini negativi della barra in fondo non sono quelli della
    testata.** `.agent-schermo` ha `1.15rem` di padding in alto e `0.85rem`
    in basso: `.agent-linguette-basso` con `-1.15rem` sporgeva di cinque
    pixel oltre lo schermo e ci faceva comparire la barra di scorrimento.
36. **`button.attiva` è già presa.** La regola generica riempie di accento
    qualunque bottone con quella classe, ed è giusto per una pillola. Su una
    riga d'elenco larga tutto lo schermo diventa una fascia colorata col
    titolo dentro, illeggibile: la miglioria del Quartier Generale usa
    `costruita`, non `attiva`. Chi marca una riga d'elenco scelga una parola
    sua e la tinga da sé.
37. **Un passo di setup può essere più alto dello schermo.** Quello
    dell'aspetto — sei temi e nove sfondi — lo è: `.agent-setup-fondo` è
    `sticky`, altrimenti «avanti» finisce sotto la piega e per uscire dal
    setup bisogna indovinare che si scorre. Il `bottom` negativo annulla il
    padding basso dello schermo, ed è la stessa misura della trappola 35.
38. **Il tempo del mondo non è un timestamp.** `new Date(worldTime * 1000)`
    finisce nel 1970: la data è il contatore **più** `dataZero`, e l'unico
    modo di ottenerla è `istante()`. È lo stesso errore della trappola 26,
    visto dal lato di chi costruisce una data invece di leggerne una.

## Cosa fanno le App

Le App di Black Chrome e quelle del DLC **«Tutto sugli Agent»** hanno una
schermata propria. Le regole sono quelle del manuale, l'automazione applica
anche le conseguenze.

| App | Cosa fa |
|---|---|
| Digital Gladiator | Colleghi la **scheda del tuo gladiatore** — un attore vero del mondo, il Solitario di Grado 4 del manuale — e sfidi un numero. Due modi: **amichevole**, che non brucia niente, e **classificata**, all'ultimo sangue. Il duello gira a round: iniziativa, colpi, armatura che assorbe, fino a che uno resta a zero. Chi perde una classificata si ritrova l'Agent distrutto, e se è interno anche la commozione cerebrale. Ogni duello lascia una riga nel curriculum. |
| 4Tify | Scandisci una copertura, cinque minuti. Se chi agisce è un GM l'orologio del mondo avanza davvero. La marcatura resta sulla scheda finché non spendi il dado di danno in più, che l'App tira e mette in chat. |
| NCPD | Terminale di sola consultazione. Sfogli l'elenco e apri il fascicolo; **schedare qualcuno si fa dalla console del master**, non da qui. Niente ricerche, niente foto, niente richieste: se una faccia non è in elenco, non è schedata. |
| MedScan | Uno specialista Trauma Team in linea. 100 E$ per un'ora: **+1 a Pronto Soccorso e Paramedico** per Stabilizzare o fare un Trattamento Rapido. 500 E$ per quattro ore: **+1 a Chirurgia o Tecnologia Medica**. Un abbonato **Trauma Team Executive** non paga. L'App dice a cosa serve il consulto, non solo quanto dura, e si può attivare sull'Agent di un altro. |
| Ziggurat | Il **Database Urbano**: lo sportello unico della città, dai locali ai concerti ai servizi. Lo compila il master dalla console, chi ha l'App lo sfoglia per categoria e ci cerca dentro. Resta il tasto di consulto, che tira la prova di conoscenza della zona più il bonus della guida. |
| StreetWire | Il tuo nome sulla strada: la REP della scheda, il livello del manuale, quanto lontano arriva il nome, e il registro di come ci sei arrivato — che è quello del sistema, non una copia. La muove il master dalla console, con un motivo scritto. |

### Le App del DLC «Tutto sugli Agent»

Dieci App, prezzo e disponibilità dalla tabella del manuale. Sono tutte in
`APP_ACQUISTABILI` come le altre: si comprano dall'App Store e non c'è
niente di diverso nel giro dell'acquisto.

| App | Costo | Cosa fa |
|---|---|---|
| Ask Alex Anything | 0 (gratuita) | «Cerca ed esamina informazioni sulla CitiNet locale.» La CitiNet locale **è il Database Urbano di Ziggurat**: Alex non tiene un secondo archivio, cerca in quello. Il riassunto è il conto delle voci e delle categorie che le hanno prodotte — non un testo generato. Il tasto tira una prova di **Archivistica** vera: STAT + abilità + il bonus dell'Agent |
| ZPost | 0 | La posta. Corrispondenza come gli SMS — stesso filo, stesso ufficio postale — ma con **oggetto** e testo lungo, e per questo `TIPO.EMAIL` la tiene separata: in Messaggi non compare, e nemmeno il contrario |
| Garden | 0 | Il Data Pool locale: la bacheca del tavolo. È l'**unico archivio condiviso su cui scrivono anche i giocatori**, quindi i post viaggiano come buste e li deposita il postino. Il cuore è per numero, non un contatore: sta nell'elenco di chi l'ha messo |
| BangMe! | 10 E$ | «Trasferire denaro tra due Agent con l'App installata.» I soldi sono quelli della scheda e la strada è quella della Banca — addebito diretto, accredito sulla busta. Cambia il gesto: importi pronti e i destinatari presi dalla rubrica |
| HusTool | 20 E$ | «Voglio il cash»: mezz'ora, dieci eurodollari, un 1d10. Con **1** va male e non prendi niente; con **10** finisce ma ci sono guai e il master tira sulla tabella degli incontri. I soldi si accreditano davvero, il tempo avanza se a premere è un GM |
| Roach Race | 20 E$ | Un platform non ci sta dentro un Agent di Foundry. Quello che ci sta è il punteggio: si tira, si tiene il record, e la classifica del tavolo mette in fila chi ha l'App. Il manuale non dà numeri per un platform, quindi non ne sono stati inventati |
| WatchBox | 50 E$ | Cinque minuti per mappare la stanza, poi l'Agent resta lì e suona. Due limiti veri: **non funziona con un Agent Interno** — va lasciato in mezzo alla stanza — e si elude con **Furtività VD 13** |
| Brainwasher | 50 E$/mese | Un'ora al giorno per una settimana, poi 1d10: **pari**, la terapia dura un giorno di meno; **dispari**, uno di più. Il conto è di **giorni di mondo**: due sessioni nello stesso giorno non contano due volte, altrimenti il ciclo di una settimana si chiude in tre secondi |
| Elflines Elftracker | 50 E$ | L'account: STAT dell'elfo, gilda, server. Le scrive il giocatore e il modulo non ci tira niente sopra — è un tracker, non un secondo personaggio |
| Big IAAA | 100 E$ | Porta il bonus ad Archivistica da +2 a +3, con un ActiveEffect vero. E manda i dati alla Ziggurat: sta nel manuale, sta nella schermata, **e non si può spegnere** |

**BabelChat non c'è**, ed è deliberato: è l'App Messaggi, che l'Agent ha già
di serie. Aggiungerla sarebbe stata una seconda icona per la stessa cosa —
lo stesso errore che Contatti e Telefono facevano prima.

Tre cose da sapere prima di toccarle:

- **Il `+1` di Big IAAA è una differenza, non un totale.** Il +2 di serie ce
  l'ha già chi ha un Agent in mano, e non lo mette questo modulo: sommare 3
  sull'effetto vorrebbe dire +5 al tavolo. La chiave è `bonuses.librarySearch`,
  verificata contro i sorgenti del sistema come le altre.
- **`traffico()` torna le voci grezze**, senza `uscente`: lo calcola chi le
  usa. `conversazioni()` lo fa per gli SMS, `#contestoZpost()` per la posta —
  chi se lo dimentica trova la casella «inviate» sempre vuota.
- **Un post di Garden si firma con l'handle**, non col nome della scheda:
  su una bacheca pubblica ci va il nome di strada. E si firma, punto — chi
  vuole restare coperto non pubblica.

WatchBox e Brainwasher lasciano uno stato sulla scheda e quindi stanno in
`#contestoStati()` della console, con il tasto per spegnerli. Big IAAA c'è
anche lui ma **senza tasto**: è l'App comprata, come Ziggurat.

### Le due App che il manuale non ha

Vengono dal prototipo, non dal DLC. Non sono state inventate dal niente: per
una le regole ci sono già, per l'altra c'era dove appoggiarsi.

**Netwatch Sentinel** (500 E$) è il giro dell'hacking del DLC visto dalla
parte di chi lo subisce. Il manuale dice tutto: si hackera un Agent con un
**Breacher** entro 20 metri e linea di vista, prova di Elettronica e
Sicurezza contro VD **17 / 21 / 24** secondo la qualità del dispositivo —
**15 / 17 / 21** se l'Agent ce l'hai in mano — e chi sospetta tira lui,
contro il risultato dell'hacker. Sentinel mostra quei due VD, tira la
controscansione (Elettronica e Sicurezza vera, STAT + abilità) e mette il
totale in chat: quel numero il modulo non può confrontarlo da solo, perché
il tiro dell'hacker lo sa il master.

I **nodi** non sono un elenco inventato: sono le cose dell'Agent che parlano
davvero verso fuori, e ognuna ci sta per una ragione scritta. L'Agent stesso
è esposto quanto dice il suo VD, ma **se è interno non lo è affatto** — il
Breacher non lo raggiunge, lo dice il manuale. Il GPS acceso manda fuori la
posizione. Big IAAA trasmette in continuazione e non si può spegnere.
WatchBox tiene dei sensori accesi in una stanza. Chi aggiunge un'App che
parla verso l'esterno la aggiunga lì.

Il **riavvio** sono i cinque minuti del manuale: il Breacher si stacca, ogni
comando installato sparisce, e non scopri chi era. Non tocca la scheda —
quello che pulisce sta nella finzione.

**Ziggurat Patch Pro** (100 E$) è lo studio dietro Garden, e non tiene un
archivio suo: le bozze stanno in un flag, tutto il resto lo legge dalla
bacheca filtrando sul proprio numero. Pubblicare una bozza è pubblicare su
Garden — stessa busta, stesso postino. Gli iscritti del prototipo non ci
sono: al loro posto ci sono i post e i cuori veri, e l'istogramma conta le
pubblicazioni degli ultimi sette giorni con la colonna più alta come scala —
senza, con due post la prima riempirebbe il grafico e sembrerebbe un record.

### Corp Link

Il portale dipendenti, e la terza App che il manuale non ha: viene dal
prototipo. Sta in `APP_ACQUISTABILI` come tutte le altre, perché la regola
del tavolo è che di serie ci sono undici App e il resto si scarica — ma è
l'unica con `soloMaster: true`.

**Corp Link si governa tutta dalla console, e nell'App non c'è un solo tasto
di scrittura.** È la stessa regola del casellario NCPD, per la stessa
ragione: da un telefono non ti dai un badge di Arasaka, come non ti metti
nella lista della polizia. Tre cose che il giocatore non fa:

| cosa | chi |
|---|---|
| scaricare l'App | il master (`soloMaster`: niente tasto nello Store, e `#onCompraApp` rifiuta comunque) |
| scegliere la Corporazione e il livello | il master, dalla scheda badge della console |
| scrivere avvisi, accessi, incarichi | il master, nell'archivio aziendale |

Senza badge l'App non è vuota: dice che non risulti dipendente di nessuno, e
al master dice dove si assegna.

**L'App si chiama come la Corporazione.** Sul telefono di un dipendente
Arasaka l'icona dice «Arasaka» e la testata pure — `nomeAppPer()` è il posto
unico dove sta questa regola, e ci passano griglia e testata. In vetrina
resta «Corp Link»: lì stai guardando cosa scarichi, non cosa hai.

Le dieci Corporazioni del manuale stanno in `CORPORAZIONI`, e il master può
scriverne una sua con nome e colore. `statoCorp()` risolve i due casi e
nessun chiamante deve sapere quale ha in mano — la stessa regola di alloggi
e vitti. Nomi propri e cifre stanno in chiaro nella tabella perché non si
traducono; quello che è una frase — settore, uffici, note, quartier generale
— passa da una chiave di lingua, altrimenti un tavolo inglese si ritrova
«SICUREZZA CORPORATIVA» sullo schermo.

**Le quattro linguette:**

| linguetta | da dove viene |
|---|---|
| bacheca | le voci `avviso` dell'archivio aziendale |
| accessi | le voci `accesso`, ognuna con la sua soglia; aperto se il badge ci arriva |
| incarichi | le voci `incarico`, con la loro paga |
| benefit | **non è archiviato**: casa corporativa, abbonamento Trauma Team, livello del badge |

I benefit restano derivati di proposito: quei tre dati stanno già da qualche
parte, e una lista scritta a mano sarebbe stata una seconda verità.

Gli accessi hanno un ripiego: **finché il master non ne ha scritto nessuno
valgono le cinque aree di serie** (`AREE_CORP`). Un'App che si apre vuota non
dice cos'è, e un master che deve scrivere cinque righe prima di far vedere
qualcosa non la usa.

L'archivio è il **terzo archivio condiviso** dopo il casellario NCPD e il
Database Urbano, ed è uno solo per tutti e tre i generi (`corpArchivio`,
campo `tipo`): tre impostazioni separate volevano dire tre volte lo stesso
codice. `livello` lo legge solo un accesso e `importo` solo un incarico —
una chiave in più su una voce che non la usa costa meno di tre archivi da
tenere allineati. Una voce con `corp: "*"` vale per tutte le Corporazioni.

Il **badge sospeso** non apre più niente: è il senso di sospenderlo, e lo fa
l'azienda — che al tavolo è il master.

L'App è l'unica che prende la tinta della testata da un **dato** e non dal
foglio di stile: `--corp-tinta` porta il colore della Corporazione, e di
serie ricade sulla tinta dell'App — un badge senza colore sarebbe stato un
badge grigio, che non è un badge.

### L'arena

Il gladiatore è un **attore del mondo**, non dei campi nell'Agent: il flag
`gladiatore` tiene il suo id e basta. I conti del Pacchetto Completo — 62
punti STAT, 86 di Abilità, 2.550 E$ — li fa la scheda del sistema, che è già
capace; l'App non li valida e non deve.

`risolviDuello()` gira per round: iniziativa su REF, poi ognuno tira REF
contro la REF dell'altro, e chi passa fa danno meno l'armatura. Si ferma
quando uno arriva a zero, o dopo `ARENA_ROUND_MASSIMI` (20) — due gladiatori
corazzati e sfortunati girerebbero all'infinito.

**Non è il combattimento di Cyberpunk RED, ed è deliberato.** Armi e abilità
vere stanno sulla scheda in posti che il sistema decide in codice, e leggerle
a tentativi sarebbe un modo elaborato di sbagliare. `trovaNumero()` prova
qualche percorso per ferite e SP e poi ripiega su 40 e 11. Il danno è
l'impostazione `dannoArena` (di serie `2d6`): è la taratura dello scontro,
non l'arma del gladiatore. Chi vuole il combattimento vero fa combattere i
due al tavolo e usa la console.

**L'amichevole non brucia niente.** La posta è un accordo scritto nella
sfida: l'App la annuncia in chat e la applica il master — non muove né soldi
né oggetti, per la stessa ragione per cui non c'è un `FilePicker`.

Un Agent distrutto non fa più niente. Il GM lo rimette in funzione gratis, il
giocatore ne compra uno nuovo al prezzo dell'impostazione: le App comprate si
riscaricano da sole.

## Prestazioni

Il catalogo della Vetrina indicizza tutti i compendi di oggetti e resta in
memoria per la sessione (`CATALOGO`). Sessanta compendi richiedono qualche
secondo alla prima apertura. `api.svuotaCatalogo()` lo ricostruisce.

## Limiti noti

- **L'acquisto non è atomico.** Scalare i soldi e creare l'oggetto sono due
  operazioni: se la seconda fallisce i soldi tornano indietro, ma un crollo nel
  mezzo esatto li perde. Foundry non ha transazioni.
- Le note sono testo semplice, non testo formattato: ProseMirror triplicava il
  codice.
- Le App sono definite nel codice (`APP_ACQUISTABILI`), non in un compendio.
  Aggiungerne una è una voce nell'oggetto più due chiavi nei file di lingua.
- **Le buste, finché esistono, arrivano a tutti i client.** Foundry filtra
  solo la resa, non la trasmissione. Vivono un istante, ma in quell'istante
  chi ha la console aperta le vede. Vale lo stesso per il numero coperto e per
  il `filo` archiviato: è privacy da tavolo, non da rete.
- **Senza un GM collegato la posta non si archivia.** Funziona lo stesso — la
  giacenza si legge insieme al filo — ma finché non entra un GM le buste
  restano nel mondo, invisibili, e non c'è nessuno che le cancelli.
- **Si può scrivere solo a numeri che esistono.** Il destinatario deve essere
  un attore del mondo con un numero assegnato; non ci sono numeri di servizio
  senza attore dietro. Per un fixer che non è un personaggio, basta creargli
  un attore e aprire il suo Agent una volta.
- **Le voci vecchie cadono.** Oltre `limiteFilo` (300 di serie) l'archivio
  taglia le più vecchie: non è un registro perpetuo.
- **Le carte in chat si dipingono da sole.** `.cprx-carta` non eredita fondo
  e colore del testo: fuori dalla finestra dell'Agent li decide il tema di
  Foundry, e in scuro finiva testo scuro su fondo scuro.
- **I due caratteri del tema `acido` arrivano da Google Fonts.** Sono l'unica
  cosa che il modulo chiama dalla rete, con un `@import` in cima ad
  `agent.css`. Senza internet le pile di ripiego reggono: cambia il
  carattere, non l'impaginazione. Togliere quella riga è una modifica
  legittima, ed è il motivo per cui il progetto non dipende da quei font per
  nessuna misura.
- **La copertura è sull'interfaccia, non sui dati.** Il numero vero resta
  nella voce archiviata e la voce sta sulla scheda di chi la riceve: chi apre
  la console lo trova, GM o no. `gmVedeCoperti` cambia solo cosa mostra
  l'Agent.

## Come estendere

- **Nuova app con elenco** (tipo contatti o note): una voce in `APP` con i suoi
  `campi`. Elenco, modulo, salvataggio e cancellazione sono generici. I tipi
  di campo sono `text`, `number`, `textarea`, `select` e `check`; un campo con
  `numero: true` viene normalizzato al salvataggio; con `contattabile` la voce
  prende i tasti chiama e scrivi nell'elenco.
- **Identità di una nuova App:** un blocco `.cprx-agent .agent-scocca.app-<chiave>`
  in `agent.css` con `--app-tinta`, `--app-su-tinta` e `--app-marchio`, più
  la chiave nell'elenco delle App di marca che ridefiniscono `--agent-accento`.
  Senza quel blocco l'App segue il tema, che per un'App di sistema è giusto.
- **Nuova app acquistabile:** una voce in `APP_ACQUISTABILI` con nome,
  produttore, prezzo, disponibilità, icona e chiave di descrizione. Se le dai
  anche `vista: "nome"`, servono tre cose in più: un `#contestoNome()`, la
  riga corrispondente nella mappa dei costruttori dentro `_prepareContext`, e
  un blocco `{{#if vistaNome}}` nel template. Senza `vista` l'App mostra solo
  la sua scheda.
- **Nuovo tipo di traffico:** una voce in `TIPO`, e la decisione se sta in
  `TIPI_DA_ARCHIVIARE` (resta nel filo) o se è un ordine di servizio che si
  consuma. Poi un `case` in `cartaChat()` e la lettura in chi lo consuma. Se
  deve toccare la scheda di un altro, passa da `applica: { su, flag, valore }`
  invece di scrivere direttamente.
- **Nuovo tema:** un blocco di variabili in `agent.css` sotto `.tema-<nome>`,
  una voce in `TEMI`, una regola `.macchia-<nome>` per il colore nelle
  impostazioni. Le variabili sono otto piu' due: `--agent-secondo` e
  `--agent-critico` servono al quadro della home e stanno di serie nel
  blocco base, quindi un tema le ridefinisce solo se ha motivo. `acido` e'
  l'unico che si porta dietro anche la propria tipografia.

## Verifiche prima di consegnare una modifica

```bash
node --check scripts/agent.js
python3 -c "import json; [json.load(open(f)) for f in ['module.json','lang/it.json','lang/en.json']]"
node verifica.cjs
node verifica-tempo.cjs
```

`verifica.cjs` compila il template e lo rende una volta per ogni vista: gli
errori di blocchi non chiusi (`{{#unless}}` chiuso con `{{/if}}`) non si vedono
altrimenti fino a runtime. Il suo helper `localize` segna anche le chiavi di
lingua dimenticate. Handlebars non va installato, lo prende da Foundry.

`verifica.cjs` compila **tutti e due** i template: `agent.hbs` e `master.hbs`.
Aggiungendo una vista, aggiungi la sua voce lì dentro. Sono
centodiciannove casi: tutte le viste dei due template, più le varianti che
accendono blocchi diversi — le tre pagine della home, blocco con e senza
avvisi, banca piena e vuota, i messaggi con e senza il campo del numero
nuovo aperto, conversazione coperta e scoperta, filo di
gruppo, modulo del gruppo nuovo con e senza rubrica, chiamata in arrivo e in
linea, le quattro linguette di Phone più la scheda di un contatto (in
rubrica e coperta), i preferiti pieni e vuoti, NCPD in elenco, fascicolo
aperto e vuoto, il casellario del master in elenco, in modifica e in
creazione, la posta del master con e senza numero libero configurato e col
filo di gruppo aperto, il calendario nelle sue tre facce (settimana
dichiarata, modulo aperto, settimana chiusa dal master), StreetWire con e
senza una reputazione leggibile, e le dieci App del DLC — Alex con e senza
database, ZPost in elenco, aperta e vuota, Garden pieno e vuoto, HusTool e
Roach Race con e senza storico, WatchBox spento, acceso e su un Agent
interno, Brainwasher a metà ciclo e completo, Elftracker collegato, in
modifica e senza account, Sentinel con e senza nodi esposti, Patch Pro in
bozze e vuota, la home senza sfondo e le impostazioni col selettore.

Dall'ultimo giro ci sono anche i cinque passi della prima accensione (con la
variante del Corporativo, che non sceglie dove vive), Corp Link senza badge e
nelle sue quattro linguette, Casa con e senza lo sconto del Quartier
Generale, e la scheda Corp Link della console — archivio in elenco e in
modifica, badge assegnato e badge da assegnare.

Tre chiavi in più su una voce, e non finiscono nel contesto: `_con` sono
pezzi di marcatura che **devono** esserci (la classe di marca di ogni App
sta lì: se qualcuno toglie `app-{{appCorrente}}` dalla scocca, saltano otto
casi in una volta), `_vietato` è
l'elenco delle stringhe che non devono comparire nella resa una volta tolti
gli attributi `data-numero` — è così che si prende un numero coperto sfuggito
in un testo — e `_senza` sono pezzi di marcatura che non devono esserci (il
tasto salva-contatto in un filo coperto, il tasto modifica su un contatto
coperto).

`verifica-tempo.cjs` prova l'aritmetica del calendario fuori da Foundry, e
**non ne tiene una copia**: estrae le funzioni da `agent.js` con `vm` e
esegue quelle. Una copia si sarebbe scollata dal codice vero al primo ritocco,
e una prova che passa mentre il modulo è rotto è peggio di nessuna prova. Il
prezzo è che rinominare una di quelle funzioni fa fallire l'estrazione con un
errore esplicito — che è il comportamento giusto. Sono cinquantanove casi:
bisestili, mesi a cavallo d'anno, griglie di venticinque mesi di fila, il salto
al mese prossimo ripetuto dodici volte, e i due numeri di settimana.

È lì che va messa qualunque cosa si possa provare senza Foundry. Le funzioni
pure stanno fuori dalle finestre apposta: `grigliaMese()` è nata dentro
`#contestoCalendario()` e ne è stata tirata fuori proprio per poterla provare.

Restano fuori da qualunque verifica automatica il giro dei permessi (chi vede
cosa), l'elezione del postino e dell'applicante, e la consegna della giacenza:
quelli si provano solo con due browser aperti su due utenti diversi, e almeno
una volta con il GM scollegato.

Anche la comparsa del tasto si prova a mano, da un client **giocatore**: su un
personaggio senza Agent in inventario non deve esserci in nessuno dei quattro
posti, e deve comparire nell'istante in cui l'oggetto entra nell'inventario —
senza ricaricare.

La copertura si prova nello stesso modo, e il giro completo è: A nasconde il
numero verso B, scrive a B, poi **chiama** B e B risponde — la telefonata è il
punto dove si rompeva. Sul lato di B: nessun numero nel filo, nel display
della chiamata e in rubrica, niente tasto per salvare il contatto, e il filo
resta coperto anche dopo che B ha risposto e richiamato.

Diagnostica in console dentro Foundry:

```js
game.modules.get("cprx-agent").api.diagnostica()
```

Stampa anche numero, applicante eletto, messaggi in transito e stato
dell'Agent. Per dare un numero a tutti gli attori in un colpo solo:

```js
game.modules.get("cprx-agent").api.assegnaNumeri()
```
