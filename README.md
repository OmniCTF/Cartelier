# Cartelier — CTF web challenge

An easy-medium reflected-XSS challenge wrapped in an e-commerce storefront. The login page reflects its `error` query parameter into HTML. Players must submit a crafted local path to the support reviewer, whose browser carries an `HttpOnly` admin session cookie, then use same-origin JavaScript to request `/admin` and send the response to a private in-app inbox.

## Run

```bash
FLAG='CTF{XSS_can_read_pages}' docker compose up --build
```

Open `http://localhost:3000`. Change the host port with `CHALLENGE_PORT=8080`.

The container is suitable for a CTFd Docker/instance plugin: it exposes port `3000`, stores no persistent data, has a health check, binds the app to `0.0.0.0`, and accepts the flag through `FLAG`. The bot uses `BOT_BASE_URL=http://127.0.0.1:3000` inside the same container, so it does not need to know the randomized public hostname. `challenge.yml` can be imported with ctfcli; update its flag and `FLAG` together for production.

Suggested CTFd prompt:

> Cartelier's support staff will inspect broken storefront pages for you. Their session cookie is HttpOnly, but is that enough to keep the private courier note safe?

Suggested category/difficulty: `Web / Easy-Medium`, 350 points (dynamic).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `FLAG` | development flag | Challenge flag shown only on `/admin` |
| `BOT_BASE_URL` | `http://127.0.0.1:$PORT` | Internal origin visited by the bot |
| `CHROMIUM_PATH` | `/usr/bin/chromium` | Browser executable |
| `ADMIN_SESSION` | random at startup | Optional fixed admin session token |

Give each team a separate container because inboxes and report throttling are process-local.
