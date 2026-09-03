#!/usr/bin/env node
/* Tests voor de match-kern van het "Te proeven"-tabblad.
   Draaien met:  node test/match.test.js
   De kern wordt rechtstreeks uit index.html gelicht (tussen de match-kern-markers),
   zodat de tests altijd de echte productiecode raken. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const begin = html.indexOf("/* --- match-kern");
const eind = html.indexOf("/* --- einde match-kern --- */");
if (begin < 0 || eind < 0) {
  console.error("FOUT: match-kern-markers niet gevonden in index.html");
  process.exit(1);
}
const bron = html.slice(html.indexOf("*/", begin) + 2, eind);
const {vindMatch, maakProefIndex} = new Function(bron + "\nreturn {vindMatch, maakProefIndex};")();

/* nagebootste eigen lijsten, met de gevallen die eerder misgingen */
const eigen = [
  {n: "La Chouffe Blonde", b: "Brasserie d'Achouffe"},
  {n: "Chouffe IPA", b: "Brasserie d'Achouffe"},
  {n: "Mc Chouffe", b: "Brasserie d'Achouffe"},
  {n: "La Chouffe 0.0%", b: "Brasserie d'Achouffe"},
  {n: "Stone Delicious IPA (2021)", b: "Stone Brewing"},
  {n: "Stone Hazy IPA", b: "Stone Brewing"},
  {n: "Abt 12", b: "Brouwerij St.Bernardus"},
  {n: "Trappistes Rochefort 10", b: "Abbaye Notre-Dame de Saint-Rémy"},
  {n: "Trappistes Rochefort 8", b: "Abbaye Notre-Dame de Saint-Rémy"},
  {n: "Gulden Draak Classic", b: "Brouwerij Van Steenberge"},
  {n: "Duvel", b: "Duvel Moortgat"},
  {n: "Duvel Tripel Hop Citra", b: "Duvel Moortgat"},
  {n: "Früh Kölsch", b: "Cölner Hofbräu Früh"},
  {n: "Oude Geuze Boon", b: "Brouwerij Boon"}
];
const idx = maakProefIndex(eigen);

let fouten = 0;
function geval(omschrijving, proefbier, verwacht){
  const m = vindMatch(proefbier, idx);
  const kreeg = m ? m.n : null;
  const ok = kreeg === verwacht;
  if (!ok) fouten++;
  console.log(`${ok ? "  ok " : "FOUT"}  ${omschrijving}\n        ${JSON.stringify(proefbier.n)} -> ${JSON.stringify(kreeg)} (verwacht ${JSON.stringify(verwacht)})`);
}

geval("flagship met hernoemde volle naam matcht",
      {n: "La Chouffe", b: "Brasserie d'Achouffe"}, "La Chouffe Blonde");
geval("variant met marker-woord telt niet als het origineel",
      {n: "Stone IPA", b: "Stone Brewing"}, null);
geval("brouwerijnaam in de biernaam wordt herkend",
      {n: "St. Bernardus Abt 12", b: "Brouwerij St. Bernardus"}, "Abt 12");
geval("nummers onderscheiden varianten (10 is geen 8)",
      {n: "Rochefort 10", b: "Brasserie de Rochefort"}, "Trappistes Rochefort 10");
geval("letterlijk bevatte naam met extra woord matcht",
      {n: "Gulden Draak", b: "Brouwerij Van Steenberge"}, "Gulden Draak Classic");
geval("kaalste kandidaat wint van de variant",
      {n: "Duvel", b: "Duvel Moortgat"}, "Duvel");
geval("diakritische tekens worden gevouwen",
      {n: "Fruh Kolsch", b: "Colner Hofbrau Fruh"}, "Früh Kölsch");
geval("zelfde biernaam maar andere brouwerij matcht niet",
      {n: "Oude Geuze", b: "Brouwerij 3 Fonteinen"}, null);
geval("onbekend bier matcht niet",
      {n: "Pliny the Elder", b: "Russian River Brewing"}, null);

if (fouten) {
  console.error(`\n${fouten} test(s) gefaald`);
  process.exit(1);
}
console.log(`\nalle ${9} tests geslaagd`);
