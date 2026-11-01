// This public endpoint does not require or receive the bot token.
async function checkDiscordApi() {
  try {
    const response = await fetch('https://discord.com/api/v10/gateway', {
      signal: AbortSignal.timeout(10000)
    });
    const contentType = response.headers.get('content-type') || 'unknown';
    console.log(`Discord API connectivity check: HTTP ${response.status}, content type ${contentType}`);
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`Discord API gateway response: ${typeof data.url === 'string' ? 'valid gateway URL returned' : 'gateway URL missing'}`);
    }
  } catch (error) {
    console.error(`Discord API connectivity check failed: ${error.name}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`);
  }
}

// Keep connection diagnostics separate from the bot token and other secrets.
async function startDiscord(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !token.trim()) throw new Error('DISCORD_TOKEN is missing or empty');

  let loginAccepted = false;
  const warning = setTimeout(() => {
    console.warn(loginAccepted
      ? 'Discord login was accepted, but the gateway is not ready after 30 seconds. Check the service logs and privileged intents.'
      : 'Discord login is still pending after 30 seconds. Check connectivity to Discord and the service logs.');
    void checkDiscordApi();
  }, 30000);
  client.once('clientReady', readyClient => {
    clearTimeout(warning);
    console.log(`Discord ready as ${readyClient.user.tag} (${readyClient.user.id})`);
  });
  client.on('error', error => console.error('Discord client error:', error.message));
  client.on('shardDisconnect', (event, shardId) => {
    console.warn(`Discord gateway disconnected (shard ${shardId}, code ${event.code}).`);
  });
  client.on('shardReconnecting', shardId => console.log(`Discord gateway reconnecting (shard ${shardId}).`));

  console.log('Connecting to Discord...');
  try {
    await client.login(token);
    loginAccepted = true;
    console.log('Discord login accepted; waiting for gateway readiness.');
  } catch (error) {
    clearTimeout(warning);
    throw error;
  }
}

module.exports = { startDiscord };
