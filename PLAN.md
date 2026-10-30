# jisaoBot: move to Coolify + replace node-localstorage with SQLite

Executor: Claude Opus. Work through phases in order. Each phase ends with a
verification step; do not start the next phase until it passes. Commit after
each phase with the message given. Do not change bot behaviour (commands,
texts, cron times) beyond what is listed here.

## 0. Current state (read this first, do not re-derive)

- Telegram bot on Telegraf 4, long polling (`jisaoBot.launch()`), no HTTP server.
  Entry: `src/jisao-bot.js`. Node 22 locally. Runs today under pm2 on the
  user's VPS ("old VPS") via `ecosystem.config.js` from the repo root.
  Coolify runs on a **different** VPS ("Coolify VPS"). The existing data has
  to be copied between the two hosts during cutover (§5 step 8).
- Storage is `node-localstorage` pointed at `../scratch` **relative to CWD**,
  i.e. a `scratch` directory next to the repo clone, outside the repo. On the
  VPS find it with `pm2 describe jisao-bot` (the `exec cwd` line) and look at
  `<exec cwd>/../scratch`. A copy of the data also exists on the dev machine at
  `I:\Dev\scratch`. The `localStorage` global is
  created in `src/jisao-bot.js:43-46` and used implicitly (as a global) in
  `src/user-management.js` and `src/api-limits.js`, plus directly in
  `src/jisao-bot.js` (`updatelocation` command and the `location` message handler).
- Two kinds of records:
  - `limits` → one JSON object `{ limitMinute, limitCore, limitPirate }`, each
    `{ limitTotal, limitRemain }`. Only `limitPirate` is live; it is overwritten
    from Pirate Weather `RateLimit-*` response headers on every call (values
    arrive as strings, keep accepting that).
  - `<userID>` (Telegram user id or negative group chat id) → JSON
    `{ userID, location: {latitude, longitude}, locationUpdateRequested,
    locationID, locationName }`. Today there are two rows, both in Parede,
    which is also the hardcoded default, so losing them is harmless.
- `getUser()` and `getLimits()` are **synchronous** and called from synchronous
  code (`src/forecast-formatters.js:5`). The replacement DB must be synchronous
  too, otherwise every call chain has to be refactored to async.
- Charts: `src/charts.js` renders with `chartjs-node-canvas` + `sharp` and writes
  PNGs to `../temp-images` (again relative to CWD). Callers in `src/jisao-bot.js`
  and `src/forecast-apis.js:283-310` then `fs.access` the file and send it with
  `{ source: path }`.
- Cron (`node-cron`) at 06:40 and 22:15 with `timezone: "Europe/Lisbon"`. But
  `/weather` (`hrs > 18`) and `postToBotWeather` (local-midnight unix time used
  to align Pirate Weather hourly UV data) use `new Date()` in **process-local
  time**. A container defaults to UTC, so `TZ=Europe/Lisbon` must be set.
- Dead weight in `package.json`: `fs` (bogus npm package), `JSONStream` (unused).
  `nodemon` is the only dev dep. `canvas` 3.2.1 (transitive) ships prebuilt
  linux-x64 glibc binaries, so a plain slim Debian Node image works without a
  compiler.
- Known small bugs to fix while in there (behaviour-preserving):
  - `src/jisao-bot.js`: `userData` is an undeclared implicit global (two places).
  - `src/api-limits.js` `setLimits`: `Object.hasOwn(localLimits, ...)` throws when
    there is no stored `limits` row (`localLimits === null`).
  - `src/forecast-apis.js:288-289` and `src/jisao-bot.js` chart handlers: on a
    missing chart file they call `ctx.reply` even when `ctx` is `null` (cron path).
  - `src/jisao-bot.js` `=` text handler logs `filePath`, which is undefined.
  - `/start` text advertises `/weather2hr_home` and `/weather2hr`, but the
    registered commands are `/weather1hr_home` and `/weather1hr`. Fix the text.

## 1. Decisions (already made, do not revisit)

- **DB: SQLite via `better-sqlite3`.** Synchronous API, single file, WAL mode.
  One file at `${DATA_DIR}/jisao.db`. If `npm ci` in Docker fails to fetch a
  prebuilt binary, fall back to Node's built-in `node:sqlite` (`DatabaseSync`),
  which has the same shape of API; do not add build tools to the image for it.
- **Schema** (two tables, JSON kept as text to stay close to today's data):
  ```sql
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    data    TEXT NOT NULL,            -- the same JSON object as today
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,           -- 'limits'
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  ```
- **Charts go to memory.** Render to a `Buffer` and send with
  `{ source: buffer }`. No `temp-images`, no `fs` in the bot.
- **Runtime: Node 26 (Active LTS since late Oct 2026, EOL Apr 2029)** in the
  container, image `node:26-bookworm-slim`. If that tag does not exist, use
  `node:26-trixie-slim`, then `node:26-slim`, and record which was used. Local
  dev may stay on Node 22; `canvas` 3, `sharp` 0.33 and `better-sqlite3` 13
  are N-API addons, so the same lockfile works on both. Keep
  `better-sqlite3` at >= 13 (N-API); 12.x below 12.11.1 has no Node 26
  prebuilt. Add `"engines": { "node": ">=22" }` to `package.json`.
  In the container smoke test, print `node --version` and confirm 26.x.
- **Deploy: Coolify, Dockerfile build pack, from the GitHub repo** on branch
  `main`. Persistent volume mounted at `/data`. No exposed port, health check
  disabled. Env vars set in Coolify, not baked into the image.
- **Config via env only.** `DATA_DIR` (default `./data` locally, `/data` in
  the container), `TZ`, `TG_API_KEY`, `WEATHERAPI_KEY`, `P_WEATHER_KEY`,
  `BOT_ID`, `CHAT_ID`. `ACCUWEATHER_*` keys are dead; drop them from `.env` docs.

## 2. Phase A: storage module + SQLite

1. `npm uninstall node-localstorage fs JSONStream` and `npm install better-sqlite3`.
2. Create `src/db.js`:
   - Resolve `DATA_DIR` from `process.env.DATA_DIR`, default
     `path.resolve(__dirname, '../data')`. `fs.mkdirSync(dir, {recursive:true})`.
   - Open `better-sqlite3` at `${dir}/jisao.db`, `PRAGMA journal_mode = WAL`,
     run the schema above.
   - Export sync helpers: `getUserRow(userID) -> object|null`,
     `putUserRow(user)` (upsert by `String(user.userID)`),
     `getKV(key) -> any|null`, `putKV(key, value)`.
     Keys are always stored as strings (`String(userID)`); today the id is
     sometimes a number and sometimes a string, so normalise on both read and write.
   - Prepare statements once at module load.
3. `src/user-management.js`: replace every `localStorage.getItem/setItem` with
   `getUserRow/putUserRow`. Keep function names and return shapes identical.
4. `src/api-limits.js`: replace `localStorage` with `getKV('limits')` /
   `putKV('limits', ...)`. Fix the `localLimits === null` crash in `setLimits`
   (treat missing as empty object).
5. `src/jisao-bot.js`:
   - Delete the `node-localstorage` bootstrap block and the `defaultLimits`
     seeding; instead call `setLimits(getLimits())` once at startup (seeds
     defaults if the row is missing).
   - Replace the three direct `localStorage` uses (startup IIFE, `updatelocation`,
     `on(message("location"))`) with `getUser` / `putUserRow` (export
     `putUserRow` as `saveUser` from `user-management.js` to keep imports in one
     place).
   - Declare `let userData` where it is used.
6. Add `data/` to `.gitignore`. Remove `scratch/` and `temp-images/` entries
   after Phase B.
7. Add `scripts/import-localstorage.js`: takes a directory path argument, reads
   every file, parses JSON; file named `limits` → `putKV`, anything else →
   `putUserRow`. Usage: `node scripts/import-localstorage.js ../scratch`. It
   must be idempotent (upsert) and print one line per imported key plus a
   final count, because it is used for the real cutover in §5.

**Verify A:** `node scripts/import-localstorage.js ../scratch` then
`node -e "const d=require('./src/db');console.log(d.getKV('limits'), d.getUserRow(process.env.CHAT_ID))"`
prints the imported rows. Start the bot locally (`node src/jisao-bot.js`) with
the real `.env`, run `/weather1hr_home`, `/updatelocation` + send a location,
confirm replies are unchanged and `data/jisao.db` grows.
Commit: `Replace node-localstorage with SQLite (better-sqlite3)`.

## 3. Phase B: charts in memory, drop filesystem

1. `src/charts.js`: `getDayChart` returns the composited PNG `Buffer`
   (`combinedImage.png().toBuffer()`), `getMinuteChart` returns
   `chartJSNodeCanvas.renderToBuffer(...)`. Remove the `filename` parameter and
   the `fs` import.
2. `src/forecast-apis.js` `postToBotWeather`: drop the `fs.access` wrapper; send
   with `{ source: chartBuffer }` via `ctx.replyWithPhoto` or
   `jisaoBot.telegram.sendPhoto`. Guard: if `ctx === null && jisaoBot === null`
   throw before calling anything. Remove the `fs` import.
3. `src/jisao-bot.js` `weather1hr`, `weather1hr_home`, and the `=` text handler:
   same change. Remove the `fs` import.
4. Fix the `/start` command list text (see §0).
5. Delete `temp-images/` from the repo and from `.gitignore`; delete
   `ecosystem.config.js` (pm2 is not used after this migration).
6. `package.json` scripts: `"start": "node src/jisao-bot.js"`,
   `"dev": "nodemon src/jisao-bot.js"`, drop `clean`/`postclean`.

**Verify B:** locally run `/weather`, `/weathertoday`, `/weather1hr_home`, and
send `=`; each still returns a photo with the same caption. `grep -rn "fs\.\|temp-images\|localStorage\|scratch" src/` returns nothing.
Commit: `Send charts from memory, remove temp-images and pm2 config`.

## 4. Phase C: Docker

1. `Dockerfile` (multi-stage not needed, keep it short):
   ```dockerfile
   FROM node:26-bookworm-slim
   ENV NODE_ENV=production TZ=Europe/Lisbon DATA_DIR=/data
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci --omit=dev
   COPY src ./src
   COPY scripts ./scripts
   RUN mkdir -p /data && chown node:node /data
   USER node
   VOLUME ["/data"]
   CMD ["node", "src/jisao-bot.js"]
   ```
   `canvas` 3.x and `sharp` 0.33 need `libstdc++`/glibc only; both are present in
   the slim Debian image. If `npm ci` tries to compile `canvas`, that means the prebuilt
   download failed; check the build log for the URL and network, do not add
   `python3 make g++` unless that is confirmed.
2. `.dockerignore`: `node_modules`, `data`, `.env`, `.git`, `*.md`, `temp-images`.
3. `.env.example` with the seven variable names from §1 and no values.
4. Local test on Windows (Docker Desktop):
   ```
   docker build -t jisaobot .
   docker run --rm --env-file .env -e DATA_DIR=/data -v jisao_data:/data jisaobot
   ```
   Stop the pm2 instance on the VPS first (`pm2 stop jisao-bot`), or Telegram
   returns 409 (two pollers). Start it again after the local test.

**Verify C:** container starts, logs the `Environment check` lines with all
`true`, `/weather` works from Telegram, `docker run --rm -v jisao_data:/data
alpine ls /data` shows `jisao.db`. Restart the container and confirm the user
row survives.
Commit: `Add Dockerfile and .dockerignore for Coolify`.

## 5. Phase D: Coolify

Done by the user in the Coolify UI; put these exact steps in `README.md`
(create it, keep it to this section plus the env table).

1. New Resource → Application → Public/GitHub repository
   `https://github.com/sergeypeterman/jisaoBot.git`, branch `main`.
2. Build Pack: **Dockerfile**. Leave port fields empty; under Advanced turn
   **off** the health check (bot has no HTTP endpoint). Ports Exposes: leave empty.
3. Environment Variables: `TG_API_KEY`, `WEATHERAPI_KEY`, `P_WEATHER_KEY`,
   `BOT_ID`, `CHAT_ID`, `TZ=Europe/Lisbon`, `DATA_DIR=/data`. Mark the keys as
   secrets.
4. Storages → Add Volume: name `jisao-data`, destination `/data`.
5. Set Deploy to "on push" (webhook) so a push to `main` redeploys.
6. **Before the first Deploy: stop pm2 on the VPS**
   (`pm2 stop jisao-bot`), otherwise both instances poll Telegram and one
   gets 409 errors. Only `pm2 delete jisao-bot && pm2 save` after Verify D
   passes, so rollback is one `pm2 start` away.
7. Deploy, watch logs for the `Environment check` lines, send `/weather`.
8. **Migrate the existing data** (required, right after the first successful
   deploy, before announcing the bot as moved).
   On the old VPS, locate and pack the data:
   ```
   SCRATCH=$(dirname "$(pm2 describe jisao-bot | grep 'exec cwd' | awk '{print $NF}')")/scratch
   tar czf /tmp/jisao-scratch.tgz -C "$(dirname "$SCRATCH")" scratch
   scp /tmp/jisao-scratch.tgz <user>@<coolify-vps>:/tmp/
   ```
   On the Coolify VPS, load it into the running container:
   ```
   C=$(docker ps --filter name=jisao --format '{{.Names}}' | head -1)
   mkdir -p /tmp/jisao && tar xzf /tmp/jisao-scratch.tgz -C /tmp/jisao
   docker cp /tmp/jisao/scratch "$C":/tmp/scratch
   docker exec "$C" node scripts/import-localstorage.js /tmp/scratch
   ```
   The script upserts, so running it against the live container is safe and
   can be repeated. The bot has already created a fresh home-chat row at boot
   with the default location; the import overwrites it with the real one. It
   also carries over the `limits` row, so the Pirate Weather remaining-calls
   counter continues instead of showing 10000 until the next API call.
9. Check the import:
   ```
   docker exec "$C" node -e "const d=require('./src/db');console.log(d.getKV('limits'));console.log(d.getUserRow(process.env.CHAT_ID))"
   ```
   Compare `limitRemain` and the home `location` against the files in
   `scratch`.

**Verify D:** step 9 matches the source files; the number of user rows equals
the number of non-`limits` files in `scratch`; both cron posts arrive at the
right Lisbon times on the next day; `/updatelocation` from a personal chat
persists across a redeploy.
Commit: `Add README with Coolify deployment steps`.

## 6. Out of scope

- Any change to forecast logic, texts, chart styling, or cron times.
- Replacing long polling with webhooks.
- Removing the dead AccuWeather code paths (`limitMinute`, `limitCore`) beyond
  what is needed to compile; keep the `APILimits` shape so the `limits` row
  stays compatible.
