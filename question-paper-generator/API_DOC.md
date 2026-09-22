# API reference

Base URL: `http://localhost:8080/api/v1`. All resource IDs are 24-character MongoDB ObjectIds. All application routes use JSON envelopes; `/metrics` is intentionally Prometheus text.

## Common contract

Success: `{"success":true,"message":"...","data":{...}}`. Errors: `{"success":false,"message":"...","errorCode":"...","requestId":"..."}`. HTTP status is authoritative. Unexpected errors never include raw provider errors, stack traces or secrets. Every response has a server-generated `X-Request-Id`. Authenticated resource responses are non-cacheable.

Authenticate with `Authorization: Bearer <access-token>`. Refresh tokens are supplied in JSON, not automatically sent cookies. Store tokens in platform secure storage; browsers should avoid persistent JavaScript-accessible storage where possible. Logout revokes the current session. Refresh replay revokes that session family. Sessions on other devices remain separate. A Redis outage cannot authorize a request.

IDs, ownership and roles come from the authenticated server-side user. Never submit userId or role in request bodies. Wrong-owner resources generally return 404. All protected routes can also return 401, 403 or 503; malformed inputs return 400.

List pagination: `page=1`, `limit=20`; maximum limit 100, page 10000. `sort` accepts `createdAt`, `-createdAt` (default), `title`, `-title`; title is meaningful for books/papers/samples. Chapter lists default to chapter order. Pagination is `{total,page,limit,pages}`. Unrecognized query/body keys are rejected.

Global limit: 300 requests/IP/minute. Endpoint limits below are additional, configurable in .env. 429 includes `Retry-After`; limit headers describe the last evaluated limiter. Book, sample and admin-content uploads share one user quota. Generation and regeneration share one quota; HTTP retries also consume request quota.

Use a unique Idempotency-Key per intended generation. Repeating an identical validated request returns its existing job. Reusing a key for different inputs returns 409. Redis accelerates lookup for 24 hours; Mongo's unique owner/key record preserves deduplication while the job record remains. Keys are scoped per user.

## Payload rules

Question types: mcq, true_false, fill_blank, very_short_answer, short_answer, long_answer, assertion_reason, case_based, numerical, match_the_following. Counts are positive integers, marks are positive half-mark increments. Maximum 100 offered questions, 10 chapters, duration 5–360 minutes. Sections must have distinct names.

Each section accepts name, type, count, marksEach, instructions and choiceCount (default 0). count is the number offered; choiceCount is the number that may be omitted. Section marks = (count - choiceCount) × marksEach. Cross-section choices and unequal-mark alternatives are rejected by sample analysis. A case-based question stores its case and subparts together, with one combined marking explanation.

Generation accepts exactly one of patternId or pattern. Optional totalMarks and numberOfQuestions must match the pattern; they do not silently resize it. difficulty is easy, medium, hard or mixed. Mixed accepts difficultyDistribution such as {"easy":30,"medium":50,"hard":20}; percentages must sum to 100. Integer question allocation uses largest remainders. Question difficulty refers to offered questions, including choices.

Catalog fields: source, externalId, title, description, board, classLevel, medium, subject, publisher, author, keywords, coverImageUrl, officialUrl, qrCode, dialCode, doId, copyright, license, permissions, contentAccessMethod, contentStatus. URLs require HTTPS. Source is diksha/ncert/licensed for admin records; uploaded is server-assigned.

Capability flags in permissions: metadata_available, content_available, content_download_allowed, content_processing_allowed, commercial_use_allowed, authorizationReference. Processing requires explicit authorizationReference. license includes name, url, commercialUseAllowed and redistributionAllowed. Public clients receive contentAvailable instead of internal permissions. Admin contentStatus updates allow metadata_only/available/failed; only a successful worker can publish ready.

Upload field name is `file`. Books allow PDF (application/pdf) and EPUB (application/epub+zip), samples allow PDF. Limits default to 100 MB / 20 MB. Extension, MIME and signature must agree; archive sizes and extraction limits are checked. Multipart book metadata: title, board, classLevel, medium, subject, rightsConfirmed="true". Rights confirmation includes permission for this application's processing and commercial use where applicable. No synchronous text extraction occurs in upload routes.

Generation job states: queued, processing, validating, completed, failed, cancelled (reserved). Poll GET /generation-jobs/:id. Completed includes questionPaperId. Paper status is ready after validation; pdfStatus is pending/processing/ready/failed. Poll paper details before requesting a PDF. Sample processingStatus is queued/processing/ready/failed. Poll sample details for patternId, then use it in generation. Textbook processing uses contentStatus; poll textbook details for ready chapters.

## Endpoints

### POST /api/v1/auth/send-otp

- Authentication: Public.
- Request: `{"phoneNumber":"+919876543210"}`.
- Query/headers: None.
- Response data: 200: {"status":"pending"}.
- Errors: 400 invalid E.164/country; 429 OTP_RATE_LIMITED; 503 provider/Redis unavailable.
- Rate limits: OTP send: 5/phone/15m and 20/IP/hour.

```sh
curl -X POST "$BASE/auth/send-otp" -H 'Content-Type: application/json' -d '{"phoneNumber":"+919876543210"}'
```

### POST /api/v1/auth/verify-otp

- Authentication: Public.
- Request: `{"phoneNumber":"+919876543210","code":"123456"}`.
- Query/headers: None.
- Response data: 200: {"user":{...},"accessToken":"...","refreshToken":"...","tokenType":"Bearer"}.
- Errors: 400 INVALID_OTP (including expiry); 403 account disabled; 429 OTP_RATE_LIMITED.
- Rate limits: 10/phone/15m; verification IP budget 20/hour.

```sh
curl -X POST "$BASE/auth/verify-otp" -H 'Content-Type: application/json' -d '{"phoneNumber":"+919876543210","code":"123456"}'
```

### POST /api/v1/auth/refresh

- Authentication: Public; refresh token in body.
- Request: `{"refreshToken":"<refresh-token>"}`.
- Query/headers: None.
- Response data: 200: {"accessToken":"...","refreshToken":"...","tokenType":"Bearer"}.
- Errors: 401 invalid/expired/replayed refresh token; 503 dependency failure.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/auth/refresh" -H 'Content-Type: application/json' -d '{"refreshToken":"<refresh-token>"}'
```

### POST /api/v1/auth/logout

- Authentication: Any authenticated role.
- Request: `{}`.
- Query/headers: None.
- Response data: 200: {}.
- Errors: 401 AUTH_REQUIRED; 503 dependency failure.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/auth/logout" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{}'
```

### GET /api/v1/auth/me

- Authentication: Any authenticated role.
- Request: no body.
- Query/headers: None.
- Response data: 200: {"id":"...","phoneNumber":"...","role":"student","board":"CBSE","classLevel":"10","medium":"English",...}.
- Errors: 401 AUTH_REQUIRED.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### PATCH /api/v1/users/me

- Authentication: Any authenticated role.
- Request: `{"name":"Student","board":"CBSE","classLevel":"10","medium":"English","preferences":{"defaultDifficulty":"medium","defaultDurationMinutes":60}}`.
- Query/headers: None.
- Response data: 200: updated safe user profile.
- Errors: 400 unsupported fields, including role/userId; 401 AUTH_REQUIRED.
- Rate limits: Global IP limit.

```sh
curl -X PATCH "$BASE/users/me" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"name":"Student","board":"CBSE","classLevel":"10","medium":"English","preferences":{"defaultDifficulty":"medium","defaultDurationMinutes":60}}'
```

### GET /api/v1/users/students

- Authentication: Parent/admin, own profiles.
- Request: no body.
- Query/headers: page, limit, sort.
- Response data: 200: {"items":[...],"pagination":{...}}.
- Errors: 401/403.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/users/students" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/users/students

- Authentication: Parent/admin.
- Request: `{"name":"Learner","board":"CBSE","classLevel":"8","medium":"English"}`.
- Query/headers: None.
- Response data: 201: parent-owned study profile.
- Errors: 400 invalid profile; 401/403.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/users/students" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"name":"Learner","board":"CBSE","classLevel":"8","medium":"English"}'
```

### PATCH /api/v1/users/students/:id

- Authentication: Parent/admin, owner.
- Request: `{"classLevel":"9"}`.
- Query/headers: None.
- Response data: 200: updated profile.
- Errors: 400 invalid ID/fields; 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X PATCH "$BASE/users/students/<id>" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"classLevel":"9"}'
```

### DELETE /api/v1/users/students/:id

- Authentication: Parent/admin, owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: {} (soft deletion).
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X DELETE "$BASE/users/students/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/textbooks

- Authentication: Any authenticated role.
- Request: no body.
- Query/headers: board, classLevel, medium, subject, source, search, page, limit, sort.
- Response data: 200: {"books":[...],"pagination":{...},"discovery":[],"uploadSuggested":false}.
- Errors: 400 invalid filters/pagination.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/textbooks" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/textbooks/recommended

- Authentication: Any authenticated role.
- Request: no body.
- Query/headers: Same as textbooks; saved board/classLevel/medium override matching query fields.
- Response data: 200: same catalog envelope.
- Errors: 400 invalid filters/pagination.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/textbooks/recommended" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/textbooks/:id

- Authentication: Any role; public catalog or owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: safe textbook with chapters and contentAvailable flags.
- Errors: 404 TEXTBOOK_NOT_FOUND (including wrong owner).
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/textbooks/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/textbooks/:id/chapters

- Authentication: Any role; public catalog or owner.
- Request: no body.
- Query/headers: page, limit, sort (title/-title or chapter order by default).
- Response data: 200: {"chapters":[...],"pagination":{...}}.
- Errors: 404 TEXTBOOK_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/textbooks/<id>/chapters" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/textbooks/resolve-qr

- Authentication: Any authenticated role.
- Request: `{"code":"LOCAL42"}`.
- Query/headers: None.
- Response data: 200: {"source":"ncert","textbook":{...},"chapter":null}; unresolved: null resources, uploadSuggested:true.
- Errors: 400 invalid code; unresolved codes are not errors.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/textbooks/resolve-qr" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"code":"LOCAL42"}'
```

### POST /api/v1/textbooks/upload

- Authentication: Any authenticated role.
- Request: `multipart/form-data: file + required book metadata (see rules above)`.
- Query/headers: None.
- Response data: 202: {"textbook":{...},"jobId":"book-...","status":"queued"}.
- Errors: 400 INVALID_FILE_TYPE or invalid metadata; 413 FILE_TOO_LARGE; 429 RATE_LIMITED.
- Rate limits: Shared book/sample uploads: 10/user/hour.

```sh
curl -X POST "$BASE/textbooks/upload" -H "Authorization: Bearer $ACCESS_TOKEN" -F "file=@textbook.pdf;type=application/pdf" -F "title=Geometry" -F "board=CBSE" -F "classLevel=10" -F "medium=English" -F "subject=Mathematics" -F "rightsConfirmed=true"
```

### GET /api/v1/chapters/:id

- Authentication: Any role; public catalog or owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: chapter metadata, contentAvailable.
- Errors: 404 CHAPTER_NOT_FOUND or TEXTBOOK_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/chapters/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/patterns

- Authentication: Any authenticated role.
- Request: no body.
- Query/headers: page, limit, sort.
- Response data: 200: {"items":[built-in and own patterns],"pagination":{...}}.
- Errors: 400 invalid pagination.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/patterns" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/patterns/:id

- Authentication: Any role; built-in or owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: pattern with sections, totalMarks and totalQuestions.
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/patterns/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/patterns

- Authentication: Teacher/admin.
- Request: `{"name":"My Unit Test","sections":[{"name":"Section A","type":"mcq","count":10,"marksEach":1}]}`.
- Query/headers: None.
- Response data: 201: saved owned pattern.
- Errors: 400 INVALID_PATTERN/INVALID_REQUEST; 403 FORBIDDEN.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/patterns" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"name":"My Unit Test","sections":[{"name":"Section A","type":"mcq","count":10,"marksEach":1}]}'
```

### PATCH /api/v1/patterns/:id

- Authentication: Teacher/admin, owner; built-ins cannot be changed.
- Request: `{"name":"Revised Unit Test","sections":[{"type":"short_answer","count":5,"marksEach":2,"choiceCount":1}]}`.
- Query/headers: None.
- Response data: 200: updated pattern (provide complete name/sections replacement).
- Errors: 400 INVALID_PATTERN; 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X PATCH "$BASE/patterns/<id>" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"name":"Revised Unit Test","sections":[{"type":"short_answer","count":5,"marksEach":2,"choiceCount":1}]}'
```

### DELETE /api/v1/patterns/:id

- Authentication: Teacher/admin, owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: {} (soft deletion).
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X DELETE "$BASE/patterns/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/sample-papers/upload

- Authentication: Teacher/admin.
- Request: `multipart/form-data: file + title`.
- Query/headers: None.
- Response data: 202: {"samplePaperId":"...","jobId":"sample-...","status":"queued"}.
- Errors: 400 INVALID_FILE_TYPE; 413 FILE_TOO_LARGE; 403 FORBIDDEN.
- Rate limits: Shared uploads: 10/user/hour.

```sh
curl -X POST "$BASE/sample-papers/upload" -H "Authorization: Bearer $ACCESS_TOKEN" -F "file=@textbook.pdf;type=application/pdf" -F "title=Unit Test"
```

### GET /api/v1/sample-papers

- Authentication: Any role, owner.
- Request: no body.
- Query/headers: page, limit, sort.
- Response data: 200: {"items":[...],"pagination":{...}}.
- Errors: 400 invalid pagination.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/sample-papers" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/sample-papers/:id

- Authentication: Any role, owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: sample with processingStatus, patternId, analyzedPattern when ready.
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/sample-papers/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/question-papers/generate

- Authentication: Any authenticated role.
- Request: `{"textbookId":"<book-id>","chapterIds":["<chapter-id>"],"pattern":{"sections":[{"type":"mcq","count":2,"marksEach":1}]},"difficulty":"medium","durationMinutes":60}`.
- Query/headers: Optional Idempotency-Key header (1-128 printable ASCII characters).
- Response data: 202: {"jobId":"...","status":"queued","progress":0,"questionsGenerated":0,"totalQuestions":2}.
- Errors: 400 INVALID_PATTERN/INVALID_REQUEST; 404 source/pattern not found; 409 BOOK_CONTENT_NOT_READY or IDEMPOTENCY_CONFLICT; 429 GENERATION_LIMIT_REACHED.
- Rate limits: 10 requests/user/hour and 2 concurrent accepted generations.

```sh
curl -X POST "$BASE/question-papers/generate" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"textbookId":"<book-id>","chapterIds":["<chapter-id>"],"pattern":{"sections":[{"type":"mcq","count":2,"marksEach":1}]},"difficulty":"medium","durationMinutes":60}' -H "Idempotency-Key: practice-session-001"
```

### GET /api/v1/generation-jobs/:id

- Authentication: Owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: {"jobId":"...","status":"processing","progress":65,"questionsGenerated":13,"totalQuestions":20,"questionPaperId":null}.
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/generation-jobs/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/question-papers

- Authentication: Owner.
- Request: no body.
- Query/headers: page, limit, sort.
- Response data: 200: {"papers":[summary metadata without question bodies],"pagination":{...}}.
- Errors: 400 invalid pagination.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/question-papers" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/question-papers/:id

- Authentication: Owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: paper, sections, questions (without answers), pdfStatus.
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/question-papers/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### DELETE /api/v1/question-papers/:id

- Authentication: Owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: {} (archived, retained in storage).
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X DELETE "$BASE/question-papers/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/question-papers/:id/regenerate

- Authentication: Owner.
- Request: `{}`.
- Query/headers: Optional new Idempotency-Key header.
- Response data: 202: new generation job; original paper retained.
- Errors: 404 RESOURCE_NOT_FOUND; 409 BOOK_CONTENT_NOT_READY; 429 GENERATION_LIMIT_REACHED.
- Rate limits: 10 generation requests/user/hour; 2 concurrent.

```sh
curl -X POST "$BASE/question-papers/<id>/regenerate" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{}'
```

### GET /api/v1/question-papers/:id/answer-key

- Authentication: Owner.
- Request: no body.
- Query/headers: None.
- Response data: 200: {"answerKey":[{"questionNumber":1,"correctAnswer":"Three","explanation":"...","marks":1,"source":{...}}]}.
- Errors: 404 RESOURCE_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/question-papers/<id>/answer-key" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### GET /api/v1/question-papers/:id/pdf

- Authentication: Owner.
- Request: no body.
- Query/headers: kind=question-paper (default) or kind=answer-key.
- Response data: 200: {"url":"https://...signed...","expiresInSeconds":300}.
- Errors: 404 RESOURCE_NOT_FOUND; 409 PDF_NOT_READY.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/question-papers/<id>/pdf" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/admin/textbooks

- Authentication: Admin.
- Request: `{"source":"ncert","externalId":"school-approved-edition-1","title":"Mathematics","board":"CBSE","classLevel":"10","medium":"English","subject":"Mathematics","officialUrl":"https://ncert.nic.in/textbook.php","contentAccessMethod":"official_link"}`.
- Query/headers: None.
- Response data: 201: new global catalog textbook.
- Errors: 400 invalid metadata/permissions; 403 FORBIDDEN; 409 CONFLICT.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/admin/textbooks" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"source":"ncert","externalId":"school-approved-edition-1","title":"Mathematics","board":"CBSE","classLevel":"10","medium":"English","subject":"Mathematics","officialUrl":"https://ncert.nic.in/textbook.php","contentAccessMethod":"official_link"}'
```

### PATCH /api/v1/admin/textbooks/:id

- Authentication: Admin.
- Request: `{"title":"Mathematics - New Edition","dialCode":"ABC123"}`.
- Query/headers: None.
- Response data: 200: updated global metadata.
- Errors: 400 invalid permissions; 404 TEXTBOOK_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X PATCH "$BASE/admin/textbooks/<id>" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"title":"Mathematics - New Edition","dialCode":"ABC123"}'
```

### DELETE /api/v1/admin/textbooks/:id

- Authentication: Admin.
- Request: no body.
- Query/headers: None.
- Response data: 200: {} (disabled).
- Errors: 404 TEXTBOOK_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X DELETE "$BASE/admin/textbooks/<id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

### POST /api/v1/admin/textbooks/:id/chapters

- Authentication: Admin.
- Request: `{"externalId":"chapter-1","title":"Real Numbers","chapterNumber":1,"order":1}`.
- Query/headers: None.
- Response data: 201: structured chapter metadata.
- Errors: 400 invalid parent/book/fields; 404 TEXTBOOK_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/admin/textbooks/<id>/chapters" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"externalId":"chapter-1","title":"Real Numbers","chapterNumber":1,"order":1}'
```

### PATCH /api/v1/admin/chapters/:id

- Authentication: Admin.
- Request: `{"title":"Real Numbers","dialCode":"CHAP01"}`.
- Query/headers: None.
- Response data: 200: updated chapter.
- Errors: 400 invalid parent; 404 CHAPTER_NOT_FOUND.
- Rate limits: Global IP limit.

```sh
curl -X PATCH "$BASE/admin/chapters/<id>" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"title":"Real Numbers","dialCode":"CHAP01"}'
```

### POST /api/v1/admin/textbooks/:id/content

- Authentication: Admin; recorded rights required.
- Request: `multipart/form-data: file`.
- Query/headers: None.
- Response data: 202: {"textbookId":"...","status":"queued"}.
- Errors: 409 missing rights or ready/processing edition; 400 invalid file; 413 too large.
- Rate limits: Shared uploads: 10/user/hour.

```sh
curl -X POST "$BASE/admin/textbooks/<id>/content" -H "Authorization: Bearer $ACCESS_TOKEN" -F "file=@textbook.pdf;type=application/pdf"
```

### POST /api/v1/admin/sources/:source/sync

- Authentication: Admin.
- Request: `{}`.
- Query/headers: source path parameter: diksha or ncert.
- Response data: 202: {"jobId":"sync-...","status":"queued"}; provider must be configured/enabled for worker success.
- Errors: 400 invalid source; 403 FORBIDDEN.
- Rate limits: Global IP limit.

```sh
curl -X POST "$BASE/admin/sources/ncert/sync" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{}'
```

### GET /api/v1/health

- Authentication: Public.
- Request: no body.
- Query/headers: None.
- Response data: 200: {"status":"up","uptime":123,"timestamp":"..."}.
- Errors: Process unavailable means no response.
- Rate limits: No application rate limit (monitor at ingress).

```sh
curl -X GET "$BASE/health"
```

### GET /api/v1/health/ready

- Authentication: Public.
- Request: no body.
- Query/headers: None.
- Response data: 200: {"ready":true,"checks":{"mongodb":"up","redis":"up"}}.
- Errors: 503 DEPENDENCY_UNAVAILABLE with check status.
- Rate limits: No application rate limit.

```sh
curl -X GET "$BASE/health/ready"
```

### GET /api/v1/metrics

- Authentication: Admin.
- Request: no body.
- Query/headers: None.
- Response data: 200: Prometheus text exposition (operational endpoint, not JSON).
- Errors: 401 AUTH_REQUIRED; 403 FORBIDDEN.
- Rate limits: Global IP limit.

```sh
curl -X GET "$BASE/metrics" -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Curl setup and common workflow

```sh
export BASE=http://localhost:8080/api/v1
export ACCESS_TOKEN='<token returned by verify-otp>'
curl "$BASE/textbooks?board=CBSE&classLevel=10&medium=English&subject=Mathematics&page=1&limit=20" -H "Authorization: Bearer $ACCESS_TOKEN"
curl "$BASE/patterns" -H "Authorization: Bearer $ACCESS_TOKEN"
```

Select a persisted book and ready chapters, choose a pattern, then generate. Discovery-only external metadata has no selectable local ID until an admin imports it. Unknown QR codes return uploadSuggested. Users do not need to upload a book when authorized catalog content is ready. Parent study profiles store selection defaults only; they do not grant access to another login's papers. All parent-generated papers belong to the parent account.

Error codes include AUTH_REQUIRED, INVALID_OTP, OTP_RATE_LIMITED, USER_NOT_FOUND, TEXTBOOK_NOT_FOUND, CHAPTER_NOT_FOUND, BOOK_CONTENT_NOT_READY, INVALID_PATTERN, GENERATION_LIMIT_REACHED, GENERATION_FAILED, QUESTION_VALIDATION_FAILED, FILE_TOO_LARGE, INVALID_FILE_TYPE, RESOURCE_NOT_FOUND, FORBIDDEN, RATE_LIMITED, INVALID_REQUEST, IDEMPOTENCY_CONFLICT, DEPENDENCY_UNAVAILABLE, PROVIDER_UNAVAILABLE, PDF_NOT_READY, CONFLICT and INTERNAL_ERROR. Worker failures expose safe status messages; provider prompts, credentials and raw textbook contents are never returned.
