# Conjakeions+ Project Instructions

## CI Watching

After every `git push` to this repo, automatically:
1. Get the latest run ID: `gh run list --repo slmingol/conjakeions-plus --limit 1`
2. Watch it: `gh run watch <run-id> --repo slmingol/conjakeions-plus`
3. Report "CI green" or "CI failed" when it completes, then give the pull+deploy commands

Do this without waiting for the user to ask.

## Git

Always use `git pull --rebase origin main && git push origin main` — never bare `git push`. The auto-version workflow commits on every push, so the remote is always ahead.

## Deployment

Production: docker-host-01.bub.lan at `/home/slm/docker_apps/conjakeion-plus`

After CI green, give user:
```bash
cd ~/docker_apps/conjakeion-plus
docker compose pull && docker compose up -d
```

## docker exec node snippets

Use heredoc with `-i` flag to avoid bash history expansion on `!`:
```bash
docker exec -i conjakeions-plus node << 'EOF'
// JS here
EOF
```
