# QuestMind

The JavaScript backend is in [`question-paper-generator/`](question-paper-generator/README.md). It follows HireMind's config/controller/service/model/queue layout, with independent Express API and BullMQ worker processes.

```sh
npm ci
npm test
npm run check
```

See the backend [setup guide](question-paper-generator/README.md), [API reference](question-paper-generator/API_DOC.md), and [provider integration notes](question-paper-generator/docs/PROVIDERS.md). Production service credentials and authorized textbook content must be supplied separately.
