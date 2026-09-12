# Roblox Discord Moderation

Discord `!ban` / `!unban` -> Render -> Roblox Open Cloud Messaging -> Roblox `BanAsync` / `UnbanAsync`.

## Render
Use the Blueprint (`render.yaml`) to create:
- `roblox-moderation-api` web service
- `roblox-moderation-bot` background worker
- `roblox-moderation-db` Postgres

The worker is the always-on Discord Gateway process. The web service is the Roblox callback/pending-actions API.

## Discord env
DISCORD_TOKEN, DISCORD_GUILD_ID, MOD_CHANNEL_ID, ALLOWED_ROLE_IDS

## Roblox/Render env
DATABASE_URL, API_SECRET, ROBLOX_UNIVERSE_ID, ROBLOX_OPEN_CLOUD_API_KEY, ROBLOX_MESSAGE_TOPIC

## Roblox setup
1. In Studio, enable `Players.BanningEnabled` / Banning APIs.
2. Game Settings > Security > Allow HTTP Requests.
3. Create an Open Cloud API key with permission to publish universe messages.
4. Put `BanSystem.server.lua` in ServerScriptService.
5. Put `BanAnnounce.client.lua` in StarterPlayerScripts.
6. Create `StarterGui > BanAnnounce > Frame > Info` and add a Sound inside Frame.
7. In BanSystem.server.lua replace API_URL and API_SECRET.
8. Make Frame initially visible; the script moves it offscreen until an announcement arrives.

## Important
`ApplyDeviceBlock=true` is the Roblox official temporary device block. The account/universe ban is permanent because Duration=-1. Do not treat the device block as a permanent hardware ban.

Never commit `.env` or API keys to GitHub.
