require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { initDb, active, createBan, setDiscordMessage, setStatus, getPending } = require('./db');
const { publishCommand, getUser, getAvatar } = require('./roblox');

// ---------- API ----------
const app = express();
app.use(express.json());
const secret = (req, res, next) => { if (req.get('x-api-secret') !== process.env.API_SECRET) return res.status(401).json({ error: 'unauthorized' }); next() };
app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/api/pending', secret, async (_, res) => { try { res.json(await getPending()) } catch (e) { res.status(500).json({ error: e.message }) } });
app.post('/api/complete', secret, async (req, res) => { try { const { banId, status } = req.body; if (!banId || !['active', 'unbanned'].includes(status)) return res.status(400).json({ error: 'invalid' }); await setStatus(banId, status); res.json({ ok: true }) } catch (e) { res.status(500).json({ error: e.message }) } });

// ---------- Bot ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const ids = () => new Set((process.env.ALLOWED_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
function allowed(m) { return m.guild?.ownerId === m.author.id || m.member?.roles.cache.some(r => ids().has(r.id)) }
async function queueUnban(userId, sourceMessage) { const row = await active(userId); if (!row || !['active', 'pending', 'unban_pending'].includes(row.status)) throw new Error('No active ban found.'); await setStatus(row.id, 'unban_pending'); await publishCommand({ action: 'unban', banId: row.id, userId: Number(userId) }); if (sourceMessage) { const e = EmbedBuilder.from(sourceMessage.embeds[0] || {}).setColor(0xF59E0B).setFooter({ text: 'Unban requested…' }); await sourceMessage.edit({ embeds: [e], components: [] }) } return row }

client.on('messageCreate', async m => {
  if (m.author.bot || !m.guild || m.guild.id !== process.env.DISCORD_GUILD_ID || m.channel.id !== process.env.MOD_CHANNEL_ID || !allowed(m)) return;
  const p = m.content.trim().split(/\s+/); const cmd = p.shift()?.toLowerCase();
  if (cmd !== '!ban' && cmd !== '!unban') return;
  await m.delete().catch(() => {});
  try {
    if (cmd === '!unban') {
      if (!/^\d+$/.test(p[0] || '')) throw new Error('Usage: !unban <RobloxUserId>');
      const row = await queueUnban(p[0]);
      const ch = await client.channels.fetch(row.discord_channel_id).catch(() => null);
      const msg = ch ? await ch.messages.fetch(row.discord_message_id).catch(() => null) : null;
      if (msg) { const e = EmbedBuilder.from(msg.embeds[0] || {}).setColor(0xF59E0B).setFooter({ text: 'Unban requested…' }); await msg.edit({ embeds: [e], components: [] }) }
      return;
    }
    if (!/^\d+$/.test(p[0] || '') || !p.slice(1).join(' ')) throw new Error('Usage: !ban <RobloxUserId> <reason>');
    const userId = Number(p[0]), reason = p.slice(1).join(' ');
    if (await active(userId)) throw new Error('This user already has a moderation action pending/active.');
    const u = await getUser(userId), avatar = await getAvatar(userId);
    const row = await createBan({ userId, username: u.name, displayName: u.displayName || u.name, reason, moderatorId: m.author.id, moderatorName: m.author.tag });
    const embed = new EmbedBuilder().setTitle('Roblox Player Banned').setColor(0xED4245).setThumbnail(avatar).addFields(
      { name: 'Username', value: u.name, inline: true },
      { name: 'Display Name', value: u.displayName || u.name, inline: true },
      { name: 'User ID', value: String(userId), inline: true },
      { name: 'Reason', value: reason },
      { name: 'Moderator', value: m.author.tag, inline: true },
      { name: 'Status', value: 'Pending Roblox enforcement', inline: true }
    ).setTimestamp();
    const msg = await m.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unban:${userId}`).setLabel('Unban').setStyle(ButtonStyle.Success))] });
    await setDiscordMessage(row.id, m.channel.id, msg.id);
    await publishCommand({ action: 'ban', banId: row.id, userId, displayName: u.displayName || u.name, reason });
  } catch (e) {
    const ch = await m.channel.send({ content: `❌ ${e.message}` });
    setTimeout(() => ch.delete().catch(() => {}), 7000);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isButton() || !i.customId.startsWith('unban:')) return;
  if (!allowed(i.member)) return i.reply({ content: 'You are not allowed to unban players.', ephemeral: true });
  const userId = i.customId.split(':')[1];
  try { await i.deferUpdate(); await queueUnban(userId, i.message) }
  catch (e) { await i.followUp({ content: `❌ ${e.message}`, ephemeral: true }) }
});

// ---------- Boot both, sharing one DB init ----------
(async () => {
  await initDb();
  app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('API listening'));
  await client.login(process.env.DISCORD_TOKEN);
  console.log('Bot logged in');
})().catch(e => { console.error('Fatal startup error:', e); process.exit(1) });
