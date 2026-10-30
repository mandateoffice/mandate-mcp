// eu-supplier-check: a small agent that checks an EU counterparty in public sources before you do business with it.
//
// Steps (all read-only Mandate MCP calls, no API key):
//   1. get_company(country, query)        official business register (live in 12 states, link + GLEIF in the rest)
//   2. get_company(country, vat, "vat")   optional: VAT number validity in VIES
//   3. get_company("EU", name, "lei")     LEI records in GLEIF; an LEI counts as a match only if its
//                                         registered_as number equals the register id
// Output: one JSON report with every fact's source_url and retrieved_at, plus plain flags.
// The flags state facts (e.g. "register status: ceased"); they are not a KYC or credit decision.
//
// Usage:
//   npm install
//   node supplier-check.mjs FI 0112038-9 --vat FI01120389
//   node supplier-check.mjs DK 24256790
//   node supplier-check.mjs DE "Siemens"          # link-only register: official lookup URL + GLEIF
// Env: MANDATE_MCP_URL (default https://mandateoffice.com/mcp)

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MANDATE_MCP_URL || "https://mandateoffice.com/mcp";
const args = process.argv.slice(2);
const vatIdx = args.indexOf("--vat");
const vat = vatIdx >= 0 ? args.splice(vatIdx, 2)[1] : undefined;
const [country, query] = args;
if (!country || !query) {
  console.error('usage: node supplier-check.mjs <CC> <register id or name> [--vat <VAT number>]');
  process.exit(2);
}

const ID_KEYS = ["registry_code", "siren", "ico", "business_id", "krs", "regcode", "code", "organisation_number",
  "registration_number", "cvr", "company_number", "oib", "mbs"];
const norm = (s) => String(s ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();

async function call(client, name, args) {
  const r = await client.callTool({ name, arguments: args });
  const data = r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? "{}");
  return { isError: !!r.isError, data };
}

const client = new Client({ name: "eu-supplier-check", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
const report = { input: { country, query, vat: vat ?? null }, checked_at: new Date().toISOString(), register: null, vat: null, lei: null, flags: [] };
try {
  // 1. Business register
  const reg = (await call(client, "get_company", { country, query })).data;
  const hit = reg.results?.[0];
  report.register = {
    supported: reg.supported ?? null,
    source: reg.source ?? null, source_url: reg.source_url ?? null, license: reg.license ?? null,
    retrieved_at: reg.retrieved_at ?? null, data_as_of: reg.data_as_of ?? null,
    matches: reg.results?.length ?? 0,
    company: hit ? Object.fromEntries(Object.entries(hit).filter(([k]) =>
      ["name", "legal_form", "type", "status", "registered", "founded", "created", "closed", "ceased", "deregistered", "register_url", ...ID_KEYS].includes(k))) : null,
    official_register: reg.official_register ?? reg.official_register_url ?? null,
  };
  if (reg.supported === false) report.flags.push("register not queried live for this country: use official_register to check by hand");
  else if (!hit) report.flags.push("no match in the register");
  else {
    if ((reg.results?.length ?? 0) > 1) report.flags.push(`${reg.results.length} matches: confirm the right entity by its register id`);
    const st = [hit.status, hit.closed, hit.ceased, hit.deregistered, hit.terminated, hit.deleted].filter(Boolean).join(" ");
    if (/ceased|closed|deleted|liquidat|bankrupt|inactive|struck/i.test(st) || hit.closed || hit.ceased || hit.deregistered || hit.deleted)
      report.flags.push(`register shows the entity as not active: ${st}`);
    if (hit.in_liquidation_or_insolvency_section) report.flags.push("KRS extract has entries in section 6 (dzial 6: liquidation, restructuring, bankruptcy and related); read the extract");
    if (hit.ongoing_proceedings?.length) report.flags.push(`register lists ongoing proceedings: ${JSON.stringify(hit.ongoing_proceedings)}`);
  }

  // 2. VIES
  if (vat) {
    const v = (await call(client, "get_company", { country, query: vat, id_type: "vat" })).data;
    const r0 = v.results?.[0];
    report.vat = { vat_number: vat, valid: r0?.valid ?? v.valid ?? null, name: r0?.name ?? null,
      source_url: v.source_url ?? null, retrieved_at: v.retrieved_at ?? null, error: v.error ?? null };
    if (report.vat.valid === false) report.flags.push("VAT number not valid in VIES at the time of the check");
    if (report.vat.valid === null) report.flags.push(`VIES gave no answer${v.error ? ` (${v.error})` : ""}: retry later`);
  }

  // 3. GLEIF
  const name = report.register?.company?.name ?? query;
  const g = (await call(client, "get_company", { country: "EU", query: name, id_type: "lei" })).data;
  const regId = hit ? norm(ID_KEYS.map((k) => hit[k]).find(Boolean)) : "";
  const exact = (g.results ?? []).filter((x) => regId && norm(x.registered_as) === regId && (!x.jurisdiction || x.jurisdiction.startsWith(country === "EL" ? "GR" : country)));
  report.lei = { source_url: g.source_url ?? null, retrieved_at: g.retrieved_at ?? null,
    exact_matches: exact.map((x) => ({ lei: x.lei, name: x.name, entity_status: x.entity_status, lei_status: x.lei_status, lei_url: x.lei_url })),
    other_candidates: (g.results ?? []).filter((x) => !exact.includes(x)).slice(0, 5).map((x) => ({ lei: x.lei, name: x.name, registered_as: x.registered_as, jurisdiction: x.jurisdiction })) };
  if (!exact.length) report.flags.push("no LEI whose registered_as equals the register id (many companies have no LEI)");
  for (const x of exact) if (x.lei_status && x.lei_status !== "ISSUED") report.flags.push(`LEI ${x.lei} status ${x.lei_status} (not renewed or retired)`);

  report.note = "Facts from official public sources via Mandate Office (mandateoffice.com). Not legal advice and not a KYC or credit decision; check each fact at its source_url.";
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.close();
}
