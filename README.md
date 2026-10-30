# jisaoBot

## Environment variables

Set these in Coolify (or in a local `.env`, see `.env.example`). Never commit
real values.

| Variable         | Required | Example / default      | Purpose |
|------------------|----------|------------------------|---------|
| `TG_API_KEY`     | yes      | (secret)               | Telegram bot token from BotFather |
| `WEATHERAPI_KEY` | yes      | (secret)               | weatherapi.com key (location names, forecasts) |
| `P_WEATHER_KEY`  | yes      | (secret)               | pirateweather.net key (hourly/minute forecasts, charts) |
| `BOT_ID`         | yes      | (secret)               | chat id of the owner's private chat with the bot |
| `CHAT_ID`        | yes      | (secret)               | id of the home group chat (negative number); cron posts go here |
| `TZ`             | yes      | `Europe/Lisbon`        | process time zone; `/weather` and the UV chart use local time. Also set in the image |
| `DATA_DIR`       | no       | `/data` in the image, `./data` locally | directory holding `jisao.db`; must be the persistent volume |

## Deploying on Coolify

Coolify runs on a different VPS ("Coolify VPS") from the one where the bot ran
under pm2 ("old VPS"). Do the steps in order.

1. **New Resource → Application → Public/GitHub repository**
   `https://github.com/sergeypeterman/jisaoBot.git`, branch `main`.
2. **Build Pack: Dockerfile.** Leave the port fields empty and clear the
   **Domains** field (the bot has no HTTP endpoint; if the UI insists on a
   value for Ports Exposes, any value is harmless as long as no domain is set).
   Under **Advanced**, turn **off** the health check.
3. **Environment Variables:** `TG_API_KEY`, `WEATHERAPI_KEY`, `P_WEATHER_KEY`,
   `BOT_ID`, `CHAT_ID`, `TZ=Europe/Lisbon`, `DATA_DIR=/data`. Mark the keys as
   secrets and leave "Build Variable" unchecked, so they only exist at runtime
   and are not baked into the image.
4. **Storages → Add Volume:** name `jisao-data`, destination `/data`.
5. Set Deploy to **on push** (webhook), so a push to `main` redeploys.
6. **Before the first Deploy, stop pm2 on the old VPS:**
   ```
   pm2 stop jisao-bot
   ```
   Otherwise both instances poll Telegram and one gets 409 errors. Do **not**
   delete it yet: only run `pm2 delete jisao-bot && pm2 save` after the checks
   at the end pass, so rollback is one `pm2 start jisao-bot` away (stop the
   Coolify app first when rolling back).
7. **Deploy**, watch the logs for the `Environment check` lines (all `true`),
   then send `/weather` to the bot.
8. **Migrate the existing data** (required, right after the first successful
   deploy, before announcing the bot as moved).

   On the **old VPS**, pack the node-localstorage directory. The bot runs from
   `~/jisaoBot/src` and stores data in `../scratch`, so it is `~/jisaoBot/scratch`:
   ```
   SCRATCH=~/jisaoBot/scratch
   pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).find(p=>p.name==="jisao-bot").pm2_env.pm_cwd))'
                                # expect /home/ubuntu/jisaoBot/src; if not, SCRATCH=<that dir>/../scratch
   ls -la "$SCRATCH"            # expect: limits plus one file per user/chat id, recent mtimes
   ls "$SCRATCH" | grep -vc '^limits$'   # number of user rows to expect later
   tar czf /tmp/jisao-scratch.tgz -C "$(dirname "$SCRATCH")" scratch
   scp /tmp/jisao-scratch.tgz <user>@<coolify-vps>:/tmp/
   ```
   (If the `pm2 jlist` line fails, the `exec cwd` line of
   `pm2 describe jisao-bot` shows the same directory.)

   On the **Coolify VPS**, load it into the running container. Coolify names
   the container after the application's UUID (shown in the app's URL in the
   Coolify UI and in its Logs view), not after "jisao":
   ```
   APP_UUID=<application uuid from Coolify>
   C=$(docker ps --filter "name=$APP_UUID" --format '{{.Names}}' | head -1)
   echo "container: $C"         # must not be empty
   mkdir -p /tmp/jisao && tar xzf /tmp/jisao-scratch.tgz -C /tmp/jisao
   docker exec -u root "$C" rm -rf /tmp/scratch     # only matters on a repeat run
   docker cp /tmp/jisao/scratch "$C":/tmp/scratch
   docker exec -u root "$C" chmod -R a+rX /tmp/scratch
   docker exec "$C" node scripts/import-localstorage.js /tmp/scratch
   ```
   Run the import as the container's default user (no `-u root`), so the
   database files stay owned by `node`. The script upserts, so running it
   against the live container is safe and can be repeated. The bot has already
   created a fresh home-chat row at boot with the default location; the import
   overwrites it with the real one. It also carries over the `limits` row, so
   the Pirate Weather remaining-calls counter continues instead of showing
   10000 until the next API call.
9. **Check the import:**
   ```
   docker exec "$C" node -e "const d=require('./src/db');console.log(d.getKV('limits'));console.log(d.getUserRow(process.env.CHAT_ID))"
   docker exec "$C" node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/data/jisao.db',{readOnly:true});console.log(db.prepare('SELECT user_id FROM users').all().map(r=>r.user_id))"
   ```
   Compare `limitRemain` and the home `location` against the files in
   `scratch` (`cat "$SCRATCH"/limits "$SCRATCH"/<CHAT_ID>` on the old VPS).
   The number of user ids should equal the count from step 8, plus any
   chats that first used the bot on Coolify before the import.

### After the cutover

- Both cron posts (06:40 and 22:15) arrive at the right Lisbon times the next day.
- `/updatelocation` from a personal chat persists across a redeploy.
- Then remove the old instance: `pm2 delete jisao-bot && pm2 save` on the old VPS.
