# Deploying to Combell (shared hosting)

Party Panic is one Laravel app: it serves the API **and** the game (`resources/js`, built by Vite into `public/build`). Realtime runs on Pusher, so the host only needs PHP and MySQL: no long-running processes, no Node.

## Requirements on the hosting

- PHP 8.3 or newer (set it in the Combell control panel for the site).
- A MySQL database.
- SSH access (for the deploy script and `artisan`).
- HTTPS on the domain (Let's Encrypt in the control panel).

## One-time setup

1. **Database**: create one in the control panel. Note host, name, user and password.
2. **Folder and document root**: upload the app to a folder outside the public web root, e.g. `~/partypanic`, and point the domain's document root to `~/partypanic/public`. If the panel doesn't allow changing the document root, put the app next to `www` and replace `www` with a symlink to `partypanic/public`.
3. **Pusher**: in the Pusher dashboard, app settings, switch on **Enable client events**.
4. **Local build settings**: the game is built on your laptop and gets its Pusher key and cluster from the `VITE_PUSHER_*` lines in your local `.env` (they point to the `PUSHER_*` values). Use the same Pusher app as the server.
5. **First deploy** (from your laptop):

   ```bash
   COMBELL_SSH=user@ssh.host COMBELL_PATH=partypanic scripts/deploy-combell.sh
   ```

   The first run uploads the code; the migrate step fails until step 6 is done. That's expected.
6. **Server `.env`**: over SSH, `cd partypanic`, copy `.env.production.example` to `.env`, fill in everything marked `<...>`, then run:

   ```bash
   php artisan key:generate
   php artisan migrate --force --seed
   php artisan optimize
   ```

7. **Scheduled task**: in the control panel (cron), run every hour:

   ```
   cd ~/partypanic && php artisan rooms:prune-stale
   ```

   (Or `php artisan schedule:run` every minute if the plan allows minute-level cron.)

## Every next deploy

```bash
git checkout main && git pull
COMBELL_SSH=user@ssh.host COMBELL_PATH=partypanic scripts/deploy-combell.sh
```

The script builds the game, installs production PHP dependencies, uploads with rsync (never touching the server's `.env` or storage), migrates, seeds the lookup tables (idempotent) and caches config and routes.

## Checks after deploying

- `https://<domain>/` shows the title screen.
- `https://<domain>/api/clock` returns JSON.
- Create a Private Party and join it from a second browser: both see each other in the lobby.
- `storage/logs/` on the server for errors.

## Pusher limits

Every movement update goes to every other player in the room, and each delivery counts as a message. A four-player match is roughly 30,000 messages. Check your plan's daily limit in the Pusher dashboard.
