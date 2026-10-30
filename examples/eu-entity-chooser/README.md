# eu-entity-chooser

Example agent: shortlist EU limited company forms against a founder's hard requirements, with the official source of every fact.

1. `get_formation_guide()` and `get_formation_guide(country)` for each state: forms, minimum capital, notary, online formation, portal, register, languages.
2. Filters on the requirements you pass. A form passes only when the fact is marked `verified` in the data; a missing or unverified fact puts the form on the `unconfirmed` list with the reason.
3. `get_post_formation(country)` for the first three results: VAT, EORI, UBO register, tax and social security authority and URL.

It does not rank by tax, cost or suitability and gives no legal advice. The order (lowest stated EUR minimum capital first) is only for reading.

```bash
npm install
node entity-chooser.mjs --max-capital 5000                  # stated EUR minimum capital at most 5,000
node entity-chooser.mjs --max-capital 5000 --online         # plus fully online formation
node entity-chooser.mjs --no-notary --countries EE,LV,LT,FI,SE,DK
node entity-chooser.mjs --lang en
```

Options: `--max-capital <EUR>`, `--online`, `--no-notary`, `--countries A,B,...`, `--lang <code>`.
Tested against production (https://mandateoffice.com/mcp) on 30 October 2026. No API key. Set `MANDATE_MCP_URL` to use another endpoint.
