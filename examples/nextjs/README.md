# Next.js example

```bash
# 1. build the package (from the repo root)
cd ../.. && npm install && npm run build && cd examples/nextjs

# 2. install and run the example
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev
```

`.npmrc` sets `install-links=true`, so `file:../..` is installed as a packed copy (only `dist/`) instead of a symlink. A symlink would pull React from the repo root's `node_modules` and crash with a duplicate React instance. After rebuilding the package, run `npm install` again to refresh the copy.
