# API Source Layout

This package uses a small layered structure:

```text
presentation -> application -> shared contracts/domain rules
presentation -> infrastructure
infrastructure -> application contracts
```

- `presentation/http`: Hono routes, OpenAPI metadata, HTTP-only limits and headers.
- `presentation/realtime`: Durable Object WebSocket adapter.
- `application`: side-effect-free use cases and ports.
- `infrastructure`: Cloudflare bindings, D1 repositories, clocks, JSON helpers, rate limits.

Keep Cloudflare types, D1 SQL, request/response objects, and WebSocket APIs out of `application`.
