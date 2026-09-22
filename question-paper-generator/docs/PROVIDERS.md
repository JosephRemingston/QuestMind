# Provider integration decisions

Sources reviewed during implementation on 2026-09-22:

- [DIKSHA exploration](https://diksha.gov.in/help/getting-started/explore-diksha/) describes searching and QR-based discovery.
- [DIKSHA open-source platform](https://diksha.gov.in/help/diksha-oss/) identifies Sunbird ED and API-based building blocks. This does not establish that a particular hosted search/content endpoint is publicly authorized for this application.
- [NCERT official textbooks portal](https://ncert.nic.in/textbook.php) is the discovery destination in the seed catalog.
- [NCERT e-content terms](https://epathshala.nic.in/wp-content/doc/book/gtextbook/textbook.htm) and [NCERT copyright notice](https://www.ncert.nic.in/pdf/announcement/notices/Press_Release_Copyright_Infringement-NCERT.pdf) require permission-aware use. Free access is not treated as commercial ingestion authorization.
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [embeddings](https://developers.openai.com/api/docs/guides/embeddings) inform the default provider adapters.
- [Twilio verification checks](https://www.twilio.com/docs/verify/api/verification-check) inform OTP validation using the verification SID.
- [BullMQ timeouts](https://docs.bullmq.io/patterns/timeout-jobs) explain why a queue option alone does not enforce a processing deadline.

## Current behavior

`DikshaBookSource`, `NcertBookSource`, `LicensedBookSource` and `UploadedBookSource` implement the same source interface. DIKSHA and licensed integrations can receive curated records; NCERT reads `fixtures/catalog.json`. Local catalog queries run first. Provider fallback returns metadata in `discovery`, distinct from persisted selectable `books`. Administrators can import metadata via CRUD or asynchronous sync; no fake internal book ID is returned for an unimported external result.

QR resolution first checks exact local textbook/chapter mappings. Recognized official URL hosts route to the appropriate provider; arbitrary URLs are never fetched. A bare DIAL-like code is not assumed to belong to DIKSHA. Providers may return a verified mapping, or the API returns an unknown/unresolved result with upload suggested.

`DIKSHA_API_BASE_URL` and `DIKSHA_API_KEY` are reserved configuration only: no live API call is shipped without a verified authorized contract. `DIKSHA_ENABLED` enables its curated adapter. `NCERT_ENABLED` enables curated metadata lookup, not scraping or downloading. Daily/monthly synchronization can be scheduled by an operator calling the admin sync endpoint; it runs asynchronously through the textbook queue.

## Adding an authorized live integration

Implement `searchBooks(filters)`, `getBook(externalId)`, `getChapters(externalId)`, `resolveCode(code)`, and `getContent(bookId, chapterId)`, then register the provider in `registry.js`. The base class includes aliases for `resolveQrCode` and `getChapterContent`. Providers must normalize metadata to catalog fields and preserve source/external IDs, official URLs, copyright/license and individual capability flags.

Use only deployment-approved HTTPS hosts, documented endpoint paths, explicit authorization and bounded responses/timeouts. Never follow arbitrary provider/user URLs for content retrieval. Keep credentials server-side. Treat provider metadata as untrusted input, validate schemas and retain authorization evidence separately. Sync may update metadata but never grants processing rights or marks a chapter ready. Preserve content-bearing editions and citations when introducing newer editions.

A production deployment needs its own authorized catalog and textbook content. The repository intentionally contains no redistributed NCERT/DIKSHA textbooks. The integration test's geometry passages are original test fixtures.
