# eu-supplier-check

Example agent: check an EU counterparty in public sources before you do business with it, in one command.

1. `get_company(country, query)`: the official business register (live lookups in 12 states: CZ, DK, EE, FI, FR, HR, IE, LT, LV, PL, SE, SI; the other states return the official register lookup URL).
2. `get_company(country, vat, id_type: "vat")`: optional VAT number check in VIES.
3. `get_company("EU", name, id_type: "lei")`: LEI records in GLEIF. An LEI is reported as an exact match only when its `registered_as` number equals the register id.

The output is one JSON report. Every block carries `source_url` and `retrieved_at`; `flags` state facts such as "register shows the entity as not active" or "LEI status LAPSED". They are not a KYC or credit decision.

```bash
npm install
node supplier-check.mjs FI 0112038-9 --vat FI01120389   # Nokia Oyj: register + VIES + LEI
node supplier-check.mjs FR 552100554                    # PEUGEOT SA: register shows ceased 2021-01-16
node supplier-check.mjs DE Siemens                      # link-only register: official lookup URL + GLEIF candidates
```

Tested against production (https://mandateoffice.com/mcp) on 30 October 2026. No API key. Set `MANDATE_MCP_URL` to use another endpoint.
