# pi-extensions

Personal extensions for the [Pi coding agent](https://buildwithpi.com).

## Extensions

| Extension | Description |
|-----------|-------------|
| [secrets](./secrets/) | Load environment variables from ejson secret files into all bash commands. `/secrets` command + `load_secrets` tool. |

## Install

Add to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "git:github.com/sbfaulkner/pi-extensions"
  ]
}
```

To enable only a subset:

```json
{
  "packages": [
    {
      "source": "git:github.com/sbfaulkner/pi-extensions",
      "extensions": ["secrets/index.ts"]
    }
  ]
}
```

## Local Development

If you keep a local clone, add to settings:

```json
{
  "extensions": [
    "~/src/github.com/sbfaulkner/pi-extensions/secrets"
  ]
}
```
