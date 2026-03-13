# Changelog

## 0.2.0

- Switch from `ejson2env` to `ejson decrypt` for clean JSON output
- Replace regex parsing of shell export lines with `JSON.parse()`
- Use `execFileSync` instead of `execSync` to avoid shell injection

## 0.1.0

- Initial release: secrets extension with `load_secrets` tool, `/secrets` command, and automatic env injection via bash spawnHook
