# Partial

Agent-native project management via `.plan` files.

## Tech Stack

- **Runtime:** Node.js 20+, TypeScript 5.x (strict)
- **Desktop:** Electron (electron-vite)
- **UI:** Svelte 5 (runes)
- **Visualization:** D3.js
- **Parser:** YAML + Zod validation
- **DAG Engine:** graphlib
- **Tooling:** Biome, Lefthook, Vitest, pnpm

## Quick Start

```bash
git clone https://github.com/villetakanen/partial.git
cd partial
pnpm install
pnpm dev
```

## Testing

```bash
pnpm test
pnpm test:coverage
```

## Further Reading

- [Scaffolding Guide](docs/scaffolding.md) — Full project setup and architecture reference
- [AGENTS.md](AGENTS.md) — Agent contributor context (when available)

## License

MIT
