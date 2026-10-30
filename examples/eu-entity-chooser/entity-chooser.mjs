// eu-entity-chooser: a small agent that shortlists EU limited company forms against a founder's hard requirements.
//
// Steps (read-only Mandate MCP calls, no API key):
//   1. get_formation_guide()                       overview of the 27 states
//   2. get_formation_guide(country) per country    forms, minimum capital, notary, online formation, sources
//   3. get_post_formation(country) for the first 3  VAT, EORI, UBO register, tax and social security: authority and URL
// It only filters on facts the source data gives. A form passes a requirement only when the fact is marked verified;
// unverified or missing facts put the form on an "unconfirmed" list instead. It does not rank by tax, cost or
// suitability and gives no legal advice: it shows which forms meet the stated requirements, with the source of each fact.
//
// Usage:
//   npm install
//   node entity-chooser.mjs --max-capital 5000 --online
//   node entity-chooser.mjs --no-notary --countries EE,LV,LT,FI,SE,DK
//   node entity-chooser.mjs --max-capital 1 --lang en
// Options:
//   --max-capital <EUR>   minimum share capital must be at most this amount (only EUR amounts are compared)
//   --online              fully online formation must be possible
//   --no-notary           no notary required
//   --countries A,B,...   limit to these member states (default: all 27)
//   --lang <code>         an official language of the country must be this one (e.g. en)
// Env: MANDATE_MCP_URL (default https://mandateoffice.com/mcp)

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MANDATE_MCP_URL || "https://mandateoffice.com/mcp";
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const req = {
  max_capital_eur: opt("--max-capital") !== undefined ? Number(opt("--max-capital")) : null,
  online: argv.includes("--online"),
  no_notary: argv.includes("--no-notary"),
  countries: opt("--countries")?.toUpperCase().split(",").map((s) => s.trim()).filter(Boolean) ?? null,
  lang: opt("--lang")?.toLowerCase() ?? null,
};
if (req.max_capital_eur !== null && !Number.isFinite(req.max_capital_eur)) { console.error("--max-capital needs a number"); process.exit(2); }

async function call(client, name, args) {
  const r = await client.callTool({ name, arguments: args });
  return r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? "{}");
}
const src = (f) => (f ? { source_url: f.source_url ?? null, verified: !!f.verified } : null);

const client = new Client({ name: "eu-entity-chooser", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
try {
  const overview = await call(client, "get_formation_guide", {});
  const countries = overview.countries.map((c) => c.country).filter((c) => !req.countries || req.countries.includes(c));
  const guides = [];
  for (const c of countries) guides.push(await call(client, "get_formation_guide", { country: c }));

  const passed = [], unconfirmed = [], failed = [];
  for (const g of guides) {
    for (const f of g.forms ?? []) {
      const fails = [], open = [];
      // Each check returns "pass", "fail" or "open" (fact missing or not verified).
      const check = (label, fact, test) => {
        if (!fact || fact.value === null && fact.amount === undefined) return open.push(`${label}: not in the data`);
        const res = test(fact);
        if (res === null) return open.push(`${label}: no comparable value in the data${fact.text ? ` ("${fact.text}")` : ""}`);
        if (!fact.verified) return open.push(`${label}: ${res ? "meets" : "fails"} the requirement, but the fact is not verified`);
        if (!res) fails.push(label);
      };
      if (req.max_capital_eur !== null) check("minimum capital", f.min_capital, (m) =>
        m.amount === null || m.amount === undefined || m.currency !== "EUR" ? null : m.amount <= req.max_capital_eur);
      if (req.online) check("online formation", g.online_formation, (o) => (typeof o.value === "boolean" ? o.value : null));
      if (req.no_notary) check("no notary", f.notary_required, (n) => (typeof n.value === "boolean" ? !n.value : null));
      if (req.lang && !(g.languages ?? []).includes(req.lang)) fails.push(`language ${req.lang}`);
      const row = {
        country: g.country, country_name: g.country_name, form: f.id, local_name: f.local_name,
        min_capital: f.min_capital ? { amount: f.min_capital.amount, currency: f.min_capital.currency, text: f.min_capital.text ?? null, ...src(f.min_capital) } : null,
        notary_required: f.notary_required ? { value: f.notary_required.value, ...src(f.notary_required) } : null,
        online_formation: g.online_formation ? { value: g.online_formation.value, ...src(g.online_formation) } : null,
        portal: g.online_portal?.url ?? null, register: g.register?.url ?? null, languages: g.languages ?? [],
      };
      if (fails.length) failed.push({ ...row, fails });
      else if (open.length) unconfirmed.push({ ...row, open });
      else passed.push(row);
    }
  }
  // Order: lowest stated EUR minimum capital first (a tie-breaker for reading, not a recommendation).
  const cap = (r) => (r.min_capital?.currency === "EUR" && typeof r.min_capital.amount === "number" ? r.min_capital.amount : Infinity);
  passed.sort((a, b) => cap(a) - cap(b) || a.country.localeCompare(b.country));

  for (const r of passed.slice(0, 3)) {
    const pf = await call(client, "get_post_formation", { country: r.country });
    r.after_formation = Object.fromEntries(["vat", "eori", "ubo_register", "tax_and_social"].filter((k) => pf[k]).map((k) => [k, {
      authority: pf[k].authority ?? null, url: pf[k].url ?? null, url_checked: pf[k].url_checked ?? null }]));
  }

  console.log(JSON.stringify({
    requirements: req, checked_at: new Date().toISOString(), data_version: overview.data_version ?? null,
    meets_all_verified: passed, unconfirmed, excluded_count: failed.length,
    excluded: failed.map((r) => ({ country: r.country, form: r.form, fails: r.fails })),
    boundary: overview.boundary,
  }, null, 2));
} finally {
  await client.close();
}
