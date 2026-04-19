const fs = require("fs");
const path = require("path");

/** Cada 💩 es un span absoluto con animación (no un bloque de texto). */
const POO_COUNT = 130;
const poos = [];
for (let i = 0; i < POO_COUNT; i++) {
  const top = (((i * 47 + 11) * (i % 7 + 1)) % 86) + 3;
  const left = (((i * 59 + 19) * (i % 5 + 1)) % 84) + 2;
  const delay = (-(i % 25) * 0.28 - (i % 3) * 0.15).toFixed(2);
  const fsz = 0.55 + (i % 9) * 0.06;
  poos.push(
    `      <span class="budget-fx__poo-bit" style="top:${top}%;left:${left}%;animation-delay:${delay}s;font-size:${fsz.toFixed(2)}rem">💩</span>`
  );
}

const paths = [1, 2, 3, 4, 5, 6, 7, 8];
let flies = "";
for (let i = 0; i < 42; i++) {
  const t = (i * 7 + 3) % 88;
  const l = (i * 11 + 5) % 85;
  const p = paths[i % 8];
  const d = (6.2 + (i % 50) / 10).toFixed(1);
  const del = (-(i % 19) * 0.35).toFixed(2);
  flies += `      <span class="budget-fx__fly" style="top:${t}%;left:${l}%;animation:fly-path-${p} ${d}s linear ${del}s infinite"></span>\n`;
}

const crowns = [];
for (let i = 0; i < 14; i++) {
  const top = (i * 13 + 7) % 78;
  const left = (i * 17 + 3) % 82;
  const delay = (-(i % 10) * 0.4).toFixed(2);
  const slow = i % 3 === 0 ? " premium-fx__emoji--slow" : i % 3 === 1 ? " premium-fx__emoji--fast" : "";
  crowns.push(
    `      <span class="premium-fx__emoji${slow}" style="top:${top}%;left:${left}%;animation-delay:${delay}s">👑</span>`
  );
}

const moneySyms = ["💵", "💰", "💸", "🤑", "💴", "💶"];
const moneys = [];
for (let i = 0; i < 16; i++) {
  const top = (i * 11 + 9) % 75;
  const left = (i * 19 + 11) % 78;
  const delay = (-(i % 8) * 0.55).toFixed(2);
  moneys.push(
    `      <span class="premium-fx__emoji premium-fx__emoji--fast" style="top:${top}%;left:${left}%;animation-delay:${delay}s">${moneySyms[i % moneySyms.length]}</span>`
  );
}

const cams = [];
for (let i = 0; i < 8; i++) {
  const top = [5, 8, 42, 48, 18, 62, 72, 28][i];
  const left = [6, 78, 4, 82, 44, 12, 55, 68][i];
  const delay = (-i * 0.31).toFixed(2);
  const flashDel = (-(i * 0.41) - i * 0.17).toFixed(2);
  const dur = (2.15 + (i % 6) * 0.11).toFixed(2);
  const icon = i % 2 === 0 ? "📸" : "📷";
  cams.push(`      <div class="premium-fx__cam-wrap" style="top:${top}%;left:${left}%;animation-delay:${delay}s">
        <span class="premium-fx__flash" style="animation-duration:${dur}s;animation-delay:${flashDel}s" aria-hidden="true"></span>
        <span class="premium-fx__cam-ico">${icon}</span>
      </div>`);
}

const out = `    <div class="budget-fx" aria-hidden="true">
      <svg class="budget-fx__crack" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 2 L 18 26 L 14 36 M 18 26 L 34 20 L 48 44 M 34 20 L 30 10 M 48 44 L 62 50 L 70 68 M 62 50 L 82 42 L 94 58" />
        <path d="M 3 0 L 20 32 L 12 48 M 20 32 L 36 38 L 44 62" />
        <path d="M 100 5 L 78 28 L 82 40 M 78 28 L 58 22 L 48 48 M 58 22 L 52 12" />
        <path d="M 96 0 L 72 35 L 68 52 L 52 70" />
        <path d="M 40 0 L 52 24 L 48 38 M 52 24 L 68 18 L 78 36" />
      </svg>
      <div class="budget-fx__poo-swarm" aria-hidden="true">
${poos.join("\n")}
      </div>
${flies}    </div>`;

const premiumOut = `    <div class="premium-fx" aria-hidden="true">
${crowns.join("\n")}
${moneys.join("\n")}
${cams.join("\n")}
    </div>`;

fs.writeFileSync(path.join(__dirname, "budget-snippet.html"), out, "utf8");
fs.writeFileSync(path.join(__dirname, "premium-snippet.html"), premiumOut, "utf8");
console.log("ok");
