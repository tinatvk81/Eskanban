# Listing sources registry

Last updated: 2026-11-22. Owner: Tina. This file is the human-readable list of every site we ingest listings from, or may ingest from later. The code registry lives in `apps/api/app/domain/sources.py` (created in F7 slice S1) and must match this file.

Scope (owner decision 2026-11-22): Mashhad, all real-estate categories, owner-posted (personal) ads only. Each discovered listing shows which source it came from. Gone listings are deleted after 90 days.

## How to read this table

- **Status:** `planned` (will be built), `candidate` (found, not decided), `excluded` (decided not to use), `enabled` / `disabled` (once built).
- **Access plan:** `partner-api` (official API or partner access), `add-from-link` (advisor pastes an ad link), `crawl` (automated reading of public pages, only after the access gate below), `none`.
- **Official API:** what was found on 2026-11-22. "Not found" means a search did not find one, not that none exists.

## Sources

| Key | Site | Mashhad entry URL | Type | Official API (found 2026-11-22) | Access plan | Owner-only filter | Status |
|---|---|---|---|---|---|---|---|
| `divar` | Divar (دیوار) | https://divar.ir/s/mashhad/real-estate | General classifieds | Kenar open platform covers managing your own ads and fetching an ad by token. No general search API found. | add-from-link now; request partner access; crawl only after the gate | To be checked | planned |
| `sheypoor` | Sheypoor (شیپور) | https://www.sheypoor.com/s/mashhad/real-estate | General classifieds | Not found | crawl after the gate | To be checked | planned |
| `ihome` | iHome (آی‌هوم) | https://ihome.ir | Real-estate portal | Not checked | crawl after the gate | To be checked | planned |
| `kilid` | Kilid (کیلید) | https://kilid.com/buy/mashhad?size=25&skipCount=true&sort=searchDate_desc | Real-estate portal | Not found | crawl after the gate | To be checked (many ads may be from agencies) | planned |
| `donabsh` | 2nabsh (دونبش) | https://www.2nabsh.com/املاک-مشهد/رهن-اجاره-آپارتمان | Real-estate portal | Not checked | crawl after the gate | To be checked | candidate |
| `delta` | Delta (دلتا) | https://delta.ir | Real-estate portal | Not checked | crawl after the gate | To be checked | candidate |
| `maskanyaban` | Maskanyaban (مسکن‌یابان) | https://maskanyaban.ir (example ad: /home/534707/...) | Unknown; could not be identified | Not checked | decide after a manual look | To be checked | candidate |
| `jajiga` | Jajiga (جاجیگا) | https://www.jajiga.com/s/mashhad | Short-term stays | Not checked | none | n/a | excluded (not realtor files; owner may reverse) |
| `jabama` | Jabama (جاباما) | https://www.jabama.com/city-mashhad | Short-term stays | Not checked | none | n/a | excluded (not realtor files; owner may reverse) |

## Candidates found by research (not decided)

| Site | Note |
|---|---|
| Shabesh (شابش, shabesh.com) | Real-estate portal; strong in Tehran. |
| Iranfile (ایران‌فایل, iranfile.net) | Long-running real-estate archive. |
| Hamshahri classifieds (rahnama.com) | General classifieds with a real-estate section. |
| Malkana (ملکانا), Homing (هومینگ), Khane Avval (خانه اول), Melkbank (ملک‌بانک), Aghaye Amlak (آقای املاک) | Mentioned in comparison articles; URLs not verified; some articles are older than one year. |

## Not a source

- pishkhanak.com blog article on real-estate sites: a reference article, not a listing site.

## Access gate (must be recorded before a source is enabled)

For every source, record in the "Gate log" below:

1. Official API or partner access, if one exists: key stored in the environment, never in git.
2. If there is no API and the owner decides to crawl: the owner has read the site's terms and robots rules and recorded the decision.
3. Request rate that is slow and polite; no evasion of blocking (no browser-fingerprint spoofing, no proxy rotation, no captcha bypass). If a source blocks us, it is disabled.
4. Capture whatever the source ad page shows, including (when present): title, price, district, posted time, deal type, property type, owner name, owner phone, address, link to the original ad. A field the page doesn't show is left blank for the advisor to fill in by hand — never invented or looked up elsewhere.
5. Offline fixtures exist for the parser and the connector tests run without network.
6. The way to find owner-posted ads for this source is documented in the table above.

## Gate log

| Date | Source | Gate item | Decision / note |
|---|---|---|---|
| 2026-11-22 | all | Registry created | No source is enabled yet. |

## Adding or removing a source

1. Add or change the row in the table above and set its status.
2. Add or remove the entry in `apps/api/app/domain/sources.py` (same key).
3. Record the access gate in the Gate log.
4. Add the connector and fixtures (F7 slice for that source), then update `docs/roadmap.md`.
5. Removing a source: set it to `excluded` or `disabled`; existing listings are kept until the 90-day cleanup.

## Evidence for the API column (2026-11-22)

- Divar Kenar docs: https://divar-ir.github.io/kenar-docs
- Third-party note that Divar has no general public API: https://parse.bot/marketplace/95b1c84a-73c9-4fd2-8312-196f87b9a591/divar-ir-api
- Sheypoor (unofficial tool that uses the site's own JSON API): https://pypi.org/project/sheypoor-mcp/
- Kilid (unofficial tool; states Kilid has no public API): https://pypi.org/project/kilid-mcp/
- Comparison articles used for candidates: https://www.irantoprank.com/the-best-real-estate-ad-site/ and https://www.markazeahan.com/top-10-real-estate-software-in-iran/

## Shared ingestion contract (F7 / S2.1)

The shared ingestion contract lives in `apps/api/app/ingest/`:

- `contracts.py` defines `RawListing`, immutable `NormalizedListing`, and the
  network-agnostic `ListingConnector` protocol.
- A connector exposes its stable `source_key` and yields raw records through
  `fetch_listings()`. It does not write to the database.
- `mapper.py` validates source keys, required identity fields, database column
  length limits, integer ranges, Persian/Arabic numeric digits, dates, and
  property types. It has no database or network dependency.
- Missing optional source fields remain `None`; absent property types become
  an empty tuple. Numeric zero is preserved as a real value.
- The normalized result is intended for global `source_listings` upsert.
  Ingestion must not create tenant-specific `listing_inbox` rows; Lead Routing
  is a separate later operation.
- Offline fixtures and mapper tests must not contact external sites.
- This contract does not enable any source. All current source statuses and
  access gates remain unchanged.
