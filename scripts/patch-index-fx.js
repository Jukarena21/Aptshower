const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let idx = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const bud = fs.readFileSync(path.join(__dirname, "budget-snippet.html"), "utf8").trimEnd();
const prem = fs.readFileSync(path.join(__dirname, "premium-snippet.html"), "utf8").trimEnd();

const reBudget =
  /<div class="budget-fx" aria-hidden="true">[\s\S]*?<\/div>\r?\n    <div class="inner">/;
if (!reBudget.test(idx)) throw new Error("budget-fx block not found");
const budIndent = bud.replace(/^    <div class="budget-fx"/m, "      <div class=\"budget-fx\"");
idx = idx.replace(reBudget, `${budIndent}\n    <div class="inner">`);

const rePrem =
  /<div class="premium-fx" aria-hidden="true">[\s\S]*?<\/div>\r?\n    <div class="inner">/;
if (!rePrem.test(idx)) throw new Error("premium-fx block not found");
idx = idx.replace(rePrem, `${prem}\n    <div class="inner">`);

fs.writeFileSync(path.join(root, "public", "index.html"), idx);
console.log("patched index.html");
