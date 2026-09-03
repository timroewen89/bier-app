#!/usr/bin/env node
/* Ververst het embedded datablok in index.html vanuit Untappd-exports.

   Gebruik:
     node tools/bouw-data.mjs <map-met-exports> [pad-naar-index.html]

   De map bevat per persoon één bestand met de naam van die persoon
   (tim.csv, peter.json, …, hoofdletterongevoelig). CSV mag komma- of
   puntkomma-gescheiden zijn, met punt of komma als decimaalteken.
   Herkende kolommen: de Untappd-export (beer_name, brewery_name,
   beer_type, beer_abv, rating_score, created_at) én de kolommen van de
   in-app import (bier, brouwerij, stijl, abv, eigen_cijfer).

   Personen zonder bestand behouden hun huidige lijst uit index.html,
   zodat een gedeeltelijke verversing gewoon werkt. Namen, families en
   de familie-indeling blijven altijd behouden; nieuwe hoofdstijlen
   zonder familie worden gemeld (de app toont ze als "Overig"). */
"use strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [exportMap, indexPad = join(dirname(fileURLToPath(import.meta.url)), "..", "index.html")] = process.argv.slice(2);
if (!exportMap) {
  console.error("gebruik: node tools/bouw-data.mjs <map-met-exports> [pad-naar-index.html]");
  process.exit(1);
}

/* ---- huidige data uit index.html ---- */
const OPEN_TAG = '<script id="data" type="application/json">';
const html = readFileSync(indexPad, "utf8");
const begin = html.indexOf(OPEN_TAG);
const eind = html.indexOf("</script>", begin);
if (begin < 0 || eind < 0) { console.error(`FOUT: geen datablok gevonden in ${indexPad}`); process.exit(1); }
const oud = JSON.parse(html.slice(begin + OPEN_TAG.length, eind));
const NAMEN = oud.namen;

/* ---- csv/json inlezen, zelfde toleranties als de in-app import ---- */
function leesCsv(tekst){
  const kopregel = tekst.slice(0, (tekst + "\n").indexOf("\n")).replace(/"[^"]*"/g, "");
  const sep = (kopregel.match(/;/g) || []).length > (kopregel.match(/,/g) || []).length ? ";" : ",";
  const rijen = []; let veld = "", rij = [], inQ = false;
  for (let i = 0; i < tekst.length; i++){
    const ch = tekst[i];
    if (inQ){
      if (ch === '"'){ if (tekst[i+1] === '"'){ veld += '"'; i++; } else inQ = false; }
      else veld += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep){ rij.push(veld); veld = ""; }
    else if (ch === "\n"){ rij.push(veld); rijen.push(rij); rij = []; veld = ""; }
    else if (ch !== "\r") veld += ch;
  }
  if (veld || rij.length){ rij.push(veld); rijen.push(rij); }
  return rijen.filter(r => r.some(v => v !== ""));
}
const deciPunt = s => /^\d+,\d+$/.test(s) ? s.replace(",", ".") : s;

const KOLOMMEN = {
  naam:      ["bier", "beer_name"],
  brouwerij: ["brouwerij", "brewery_name"],
  stijl:     ["stijl", "beer_type"],
  abv:       ["abv", "beer_abv"],
  cijfer:    ["eigen_cijfer", "rating_score"],
  datum:     ["created_at"]
};

/* leest één exportbestand en levert per uniek bier de laatste check-in op */
function leesExport(pad){
  const tekst = readFileSync(pad, "utf8").replace(/^﻿/, "");
  let records;
  if (pad.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(tekst);
    if (!Array.isArray(data)) throw new Error("JSON-export moet een lijst van check-ins zijn");
    records = data;
  } else {
    const tabel = leesCsv(tekst);
    const kop = tabel[0].map(h => h.trim().toLowerCase());
    records = tabel.slice(1).map(r => Object.fromEntries(kop.map((k, i) => [k, r[i] ?? ""])));
  }
  const veld = (rec, sleutel) => {
    for (const k of KOLOMMEN[sleutel]) if (rec[k] != null && String(rec[k]).trim() !== "") return String(rec[k]).trim();
    return "";
  };
  const perBier = new Map();
  for (const rec of records) {
    const naam = veld(rec, "naam");
    if (!naam) continue;
    const bier = {
      n: naam, b: veld(rec, "brouwerij"), s: veld(rec, "stijl") || "Other",
      a: deciPunt(veld(rec, "abv")), c: deciPunt(veld(rec, "cijfer")),
      t: Date.parse(veld(rec, "datum")) || 0
    };
    const k = bier.n + "|" + bier.b;
    const eerder = perBier.get(k);
    // meerdere check-ins van hetzelfde bier: de laatste wint, maar een leeg
    // cijfer verdringt nooit een eerder gegeven cijfer
    if (!eerder || bier.t >= eerder.t) perBier.set(k, {...bier, c: bier.c || (eerder ? eerder.c : "")});
  }
  return [...perBier.values()];
}

/* ---- per persoon: nieuw bestand, anders de huidige lijst uit index.html ---- */
function bestaandeLijst(i){
  return oud.rijen.filter(r => r[4] & (1 << i)).map(r => ({
    n: r[0], b: r[1], s: oud.stijlen[r[2]] || "Other", a: r[3] || "", c: (r[5] || "").split(",")[i] || ""
  }));
}
const bestanden = readdirSync(exportMap);
const perPersoon = NAMEN.map((naam, i) => {
  const bestand = bestanden.find(f => f.replace(/\.(csv|json)$/i, "").toLowerCase() === naam.toLowerCase());
  if (!bestand) return { naam, bron: "behouden uit index.html", lijst: bestaandeLijst(i) };
  return { naam, bron: bestand, lijst: leesExport(join(exportMap, bestand)) };
});
const onbekend = bestanden.filter(f => /\.(csv|json)$/i.test(f) &&
  !NAMEN.some(n => f.replace(/\.(csv|json)$/i, "").toLowerCase() === n.toLowerCase()));
if (onbekend.length) console.warn(`let op: overgeslagen, geen persoon met deze naam: ${onbekend.join(", ")}`);

/* ---- samenvoegen tot het datamodel van de app ---- */
const bieren = new Map();       // n|b -> {n, b, s, a, w, c[5]}
perPersoon.forEach(({lijst}, i) => {
  for (const bier of lijst) {
    const k = bier.n + "|" + bier.b;
    let o = bieren.get(k);
    if (!o) { o = { n: bier.n, b: bier.b, s: "", a: "", w: 0, c: ["", "", "", "", ""] }; bieren.set(k, o); }
    o.w |= (1 << i);
    o.c[i] = bier.c || "";
    if (!o.s || o.s === "Other") o.s = bier.s;
    if (!o.a) o.a = bier.a;
  }
});

const stijlen = [...new Set([...bieren.values()].map(o => o.s || "Other"))].sort((a, b) => a.localeCompare(b, "nl"));
const stijlIndex = new Map(stijlen.map((s, i) => [s, i]));
const hoofd = stijlen.map(s => s.split(" - ")[0].trim());

const rijen = [...bieren.values()]
  .sort((a, b) => a.n.localeCompare(b.n, "nl") || a.b.localeCompare(b.b, "nl"))
  .map(o => [o.n, o.b, stijlIndex.get(o.s || "Other"), o.a, o.w, o.c.join(",")]);

const nieuw = {
  namen: NAMEN,
  aanwezig: perPersoon.map(p => p.lijst.length > 0),
  peildatum: new Date().toISOString().slice(0, 10),
  stijlen, hoofd,
  fam: oud.fam,               // familie-indeling is handwerk en blijft behouden
  families: oud.families,
  rijen
};

/* ---- terugschrijven en rapporteren ---- */
writeFileSync(indexPad, html.slice(0, begin + OPEN_TAG.length) + JSON.stringify(nieuw) + html.slice(eind));

const oudPer = NAMEN.map((_, i) => oud.rijen.filter(r => r[4] & (1 << i)).length);
console.log(`datablok in ${indexPad} ververst (peildatum ${nieuw.peildatum})`);
perPersoon.forEach((p, i) => console.log(`  ${p.naam.padEnd(8)} ${String(oudPer[i]).padStart(4)} -> ${String(p.lijst.length).padStart(4)} bieren  (${p.bron})`));
console.log(`  totaal   ${String(oud.rijen.length).padStart(4)} -> ${String(rijen.length).padStart(4)} unieke bieren · ${stijlen.length} stijlen`);
const zonderFam = [...new Set(hoofd)].filter(h => !nieuw.fam[h]);
if (zonderFam.length) console.warn(`let op: hoofdstijlen zonder familie (app toont ze als "Overig"): ${zonderFam.join(", ")}\n  voeg ze desgewenst toe aan "fam" in het datablok.`);
console.log('controleer met: node test/match.test.js && git diff --stat');
