# Pathway

A small self-hosted learning site. You sign in, work through a course, and it remembers
where you stopped. Lecture videos play from your own files, and Python exercises run and
check in the browser. First course: CS50's Introduction to Programming with Python.

CS50 course material is © CS50 / Harvard University, CC BY-NC-SA 4.0. Keep this site private
and non-commercial.

## What it does

- Sign in, then **Resume** or **Continue** to go back to your last lesson.
- Progress is saved automatically: lessons done, video position, your code, time studied, day streak.
- Lecture videos play from `media/` with speed control, optional subtitles, and an audio-only toggle.
- Exercises: write Python, **Run** it with your own input, or **Check** it against tests.
- **Copy for Claude** puts the task, your code, and the last result on your clipboard.
- A short **quiz** after each lecture in weeks 0 to 2 (auto-graded, retakeable, explanations for every answer).

**Honor system.** Passing a check here marks the exercise done, but the official test is CS50's
own checker. Each exercise links to the official problem page for that.

## Run it on your computer

Needs Docker.

```bash
cp .env.example .env
mkdir -p media            # put lecture-0.mp4 ... lecture-9.mp4 in here
docker compose up -d --build
```

Open http://localhost:3000 and create your account. The first account owns the site, and
sign-ups then close.

Without Docker, with Node 22.13 or newer: `npm install && npm start`.

## Lecture videos

Save each lecture as `media/lecture-N.mp4` (N is 0 to 9). `.webm`, `.m4v`, and `.mov` also work.
For subtitles, add `media/lecture-N.vtt`. Reload the lesson page and the player appears.

Use the download links CS50 provides on its lecture pages. I could not check where those links
are, so look on each lecture page. Do not rip videos from YouTube; that breaks its terms.

Videos need disk space, so check your VPS size first. 720p is plenty.

## Run it on your LAN, add a Cloudflare Tunnel later

For a home server (e.g. a Proxmox VM) that starts out LAN-only and later gets
remote access through Cloudflare:

```bash
cp .env.example .env     # leave BIND=0.0.0.0, COOKIE_SECURE=false for now
mkdir -p media
docker compose up -d --build
```

Open `http://<vm-ip>:3000` from any device on your network and create your account.

When you're ready for remote access, create a tunnel in the Cloudflare Zero
Trust dashboard (Networks > Tunnels > Create a tunnel > Docker), point its
public hostname at `http://pathway:3000`, and put the token it gives you in
`.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Then:

```bash
docker compose --profile tunnel up -d --build
```

`cloudflared` only makes an outbound connection to Cloudflare — no inbound
ports are needed on the VM or your router for this to work. Once the tunnel
hostname is your only way in, lock the rest down in `.env`:

```
BIND=127.0.0.1       # stop answering direct LAN requests
COOKIE_SECURE=true    # the public hostname is always HTTPS
```

Add email-based login (Cloudflare Access) in the Zero Trust dashboard as a
policy on that hostname — it gates the whole app before Pathway's own login
even runs.

Note the trade-off: with `COOKIE_SECURE=true`, logging in over plain
`http://<vm-ip>:3000` stops working (the browser won't send a Secure cookie
over HTTP). Decide whether LAN devices should also go through the tunnel
hostname, or keep a separate non-secure path for them.

## Put it on a VPS with HTTPS

1. Get a small VPS (1 GB RAM is enough) and point a domain or subdomain at its IP address.
2. Install Docker, and open only ports 22, 80, and 443 in the firewall.
3. Copy this folder to the server, then create `.env`:

   ```
   DOMAIN=learn.example.com
   COOKIE_SECURE=true
   ALLOW_SIGNUP=false
   ```

4. Start it with the web profile (adds Caddy, which gets a free HTTPS certificate):

   ```bash
   mkdir -p media
   docker compose --profile web up -d --build
   ```

5. Open `https://learn.example.com` and create your account **immediately**. Until the first
   account exists, anyone who finds the address can create it.
6. Upload videos into `media/` with `scp` or `rsync`.

Use a long, unique password. Failed sign-ins are rate limited, and sessions last 30 days.

## Back up

Your accounts and progress live in the `pathway-data` Docker volume:

```bash
docker run --rm -v pathway_pathway-data:/data -v "$PWD":/backup alpine tar czf /backup/pathway-backup.tgz -C /data .
```

## Update

Copy the new files over, then `docker compose up -d --build`. Course content is re-synced on
start; your progress and saved code are never touched.

## Add or change exercises

Courses are plain JavaScript files in `seed/`. Each exercise has a spec, starter code, and tests:

- `{ stdin, stdout }` runs the program with those input lines and compares what it prints.
- `{ check }` runs a few lines of Python after your code to test your functions.

Before shipping an exercise, add a correct and some wrong solutions to `test/refs.mjs` and run
`npm run validate`. It proves the correct one passes and each wrong one fails. A new exercise
without that is not trusted.

## Tests

```bash
node test/validate.mjs     # every exercise: right answers pass, wrong answers fail; quizzes are well formed
node test/smoke.mjs        # real browser: sign up, video resume, exercise, reload, sign out
```

The browser test needs `npm i --no-save playwright-core` and a Chromium.

## Known limits

- Checking runs in your browser. It is for practice, not proof. A server-side checker in a
  locked-down container is the planned upgrade.
- Only CS50P weeks 0 to 2 have auto-checked exercises and quizzes. Weeks 3 to 9 list their lectures and
  problem sets and link to the official pages. The problem names there are from memory, so
  check them against the official list.
- The code editor is a plain text box.
- I could not build the Docker image in the environment where this was written (no Docker
  daemon), so the first `docker compose up --build` on your machine is its first real build.
