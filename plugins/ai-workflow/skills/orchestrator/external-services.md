# External services and LLMs

These rules cover the app's runtime and its tests only. They don't cover the workflow's own tooling: git, worktrees, GitHub PRs and Linear work as normal.

- Tests (unit, integration, e2e): mock every external service.
- Running the app locally (dev, QA): never call a real external service or the real LLM (OpenRouter or any other provider). That includes chunking, embedding and populating a vector DB. Use a local implementation or a stub.
- Put each LLM and embedding integration behind a strategy with a local and a production implementation, chosen by config. This split is required, not a speculative abstraction.
- Local LLM calls: Ollama with `llama3.1` or `llama3.2`. Without Ollama: a stubbed response.
- Local embeddings: Ollama with `embeddinggemma`. Without Ollama: ChromaDB's embedding functions. Production embeddings are produced by the production model at deploy time.
- Embeddings from different models don't mix: keep one vector collection per environment/model, and re-embed when the model changes.
