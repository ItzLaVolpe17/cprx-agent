# cprx-agent

Modulo Foundry VTT che aggiunge un Agent giocabile al sistema Cyberpunk RED:
contatti, lavori, note, messaggi e chiamate fra personaggi, una vetrina per
comprare oggetti dai compendi e un App Store per le App di Black Chrome.

- Foundry VTT **v12** (`compatibility.maximum` è fissato a 12 di proposito)
- Sistema `cyberpunk-red-core`

Le note di progetto — com'è fatto, perché è fatto così, e le trappole già
pagate — stanno in [CLAUDE.md](CLAUDE.md). È il posto da leggere prima di
toccare qualcosa.

## Metterlo in un mondo

Il modulo va dentro la cartella dei moduli di Foundry, con il nome della
cartella uguale all'`id` del manifest:

```
<Foundry Data>/Data/modules/cprx-agent/
```

Su una macchina nuova basta clonarci dentro il repository:

```bash
cd <Foundry Data>/Data/modules
git clone <url del repository> cprx-agent
```

Poi si attiva dalle impostazioni del mondo. Non c'è niente da compilare e
nessuna dipendenza da installare.

## Verifiche prima di consegnare una modifica

```bash
node --check scripts/agent.js
node verifica.cjs
node verifica-tempo.cjs
```

`verifica.cjs` rende ogni vista dei due template fuori da Foundry e segna le
chiavi di lingua dimenticate; `verifica-tempo.cjs` prova l'aritmetica del
calendario. Handlebars non va installato — lo prendono dall'installazione di
Foundry, e **il percorso in cima a `verifica.cjs` è l'unica cosa da cambiare
su una macchina diversa.**

I due file di lingua devono avere le stesse chiavi:

```bash
node -e "const f=require('fs'),a=Object.keys(JSON.parse(f.readFileSync('lang/it.json'))),b=Object.keys(JSON.parse(f.readFileSync('lang/en.json')));console.log(a.length,b.length,a.filter(k=>!b.includes(k)))"
```

## Diagnostica dentro Foundry

```js
game.modules.get("cprx-agent").api.diagnostica()
```
