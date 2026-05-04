# Project Memory

Tracks accumulated knowledge about this project to prevent redundant re-briefing across sessions.

## Feedback

### No keyboard navigation suggestions
Do not suggest keyboard navigation, tab order, or focus state improvements.
**Why:** Wall-mounted Home Assistant panel — no keyboard involved.

### Always use subagents for file edits
Main agent must never call Edit or Write tools directly. All file edits must be delegated to subagents.
**Why:** Explicit workflow rule — main synthesises and delegates, agents execute.

### Keep README.md and CLAUDE.md in sync with src/ changes
After editing any file in `src/`, review README.md and CLAUDE.md and update any documentation that no longer matches the code.
**Why:** Both docs must stay accurate to source at all times.

## References

### Home Assistant
- Local URL: `http://10.0.0.5:8123/`
- SSH alias: `ssh homeassistant` (user: `hassio`, host: `10.0.0.5`)
- SSH key: `~/.ssh/id_ed25519`, ciphers: `aes256-gcm`/`aes128-gcm`

### Deployment
- HACS auto-updates from `master` branch on GitHub push
- Build: `npm run build` → `dist/solar-dashboard.js`
- CI auto-bumps version on every push — always `git pull --rebase` before pushing

### Entity & Config
- Moon phase entity auto-discovered by state value matching (no hardcoded entity ID)
- 6 `input_number` helpers auto-created on first dashboard load
