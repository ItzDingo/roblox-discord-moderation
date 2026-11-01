// Keep connection diagnostics separate from the bot token and other secrets.
async function startDiscord(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !token.trim()) throw new Error('DISCORD_TOKEN is missing or empty');

  let loginAccepted = false;
  const warning = setTimeout(() => {
    console.warn(loginAccepted
      ? 'Discord login was accepted, but the gateway is not ready after 30 seconds. Check the service logs and privileged intents.'
      : 'Discord login is still pending after 30 seconds. Check connectivity to Discord and the service logs.');
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
