require('dotenv').config();
const {Client,GatewayIntentBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle}=require('discord.js');
const {initDb,active,createBan,setDiscordMessage,setStatus,getRecentResolved,markNotified}=require('./db');const {publishCommand,getUser,getAvatar,isCurrentlyBanned}=require('./roblox');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const ids=()=>new Set((process.env.ALLOWED_ROLE_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
async function allowed(m){if(!m)return false;let member=m;if(!member.roles||!member.roles.cache||member.roles.cache.size===0){try{member=await member.guild.members.fetch(member.id||member.user?.id)}catch(e){return false}}return member.roles.cache.some(r=>ids().has(r.id))}
async function queueUnban(userId,sourceMessage,requester){
 let row=await active(userId);
 if(row&&['active','pending','unban_pending'].includes(row.status)){
  await setStatus(row.id,'unban_pending');
 }else{
  // No matching DB row (e.g. banned outside this bot, or the row drifted out of sync). Verify directly with Roblox before creating a fresh tracking row.
  const reallyBanned=await isCurrentlyBanned(userId).catch(()=>null);
  if(!reallyBanned)throw new Error('No active ban found (checked both local records and Roblox directly).');
  let username=String(userId),displayName=String(userId);
  try{const u=await getUser(userId);username=u.name;displayName=u.displayName||u.name}catch(e){}
  row=await createBan({userId,username,displayName,reason:'Unban requested (no prior tracked ban found; confirmed banned via Open Cloud)',moderatorId:requester?.id||'unknown',moderatorName:requester?.tag||'unknown',status:'unban_pending'});
 }
 await publishCommand({action:'unban',banId:row.id,userId:Number(userId)});
 if(sourceMessage){const e=EmbedBuilder.from(sourceMessage.embeds[0]||{}).setColor(0xF59E0B).setFooter({text:'Unban requested…'});await sourceMessage.edit({embeds:[e],components:[]})}
 return row;
}
client.on('messageCreate',async m=>{if(m.author.bot||!m.guild||m.guild.id!==process.env.DISCORD_GUILD_ID||m.channel.id!==process.env.MOD_CHANNEL_ID)return;if(!(await allowed(m.member)))return;const p=m.content.trim().split(/\s+/);const cmd=p.shift()?.toLowerCase();if(cmd!=='!ban'&&cmd!=='!unban')return;await m.delete().catch(()=>{});
try{if(cmd==='!unban'){if(!/^\d+$/.test(p[0]||''))throw new Error('Usage: !unban <RobloxUserId>');const userId=p[0];const hadRow=await active(userId);const row=await queueUnban(userId,null,m.author);if(hadRow&&['active','pending','unban_pending'].includes(hadRow.status)){const ch=await client.channels.fetch(row.discord_channel_id).catch(()=>null);const msg=ch?await ch.messages.fetch(row.discord_message_id).catch(()=>null):null;if(msg){const e=EmbedBuilder.from(msg.embeds[0]||{}).setColor(0xF59E0B).setFooter({text:'Unban requested…'});await msg.edit({embeds:[e],components:[]})}}else{const embed=new EmbedBuilder().setTitle('Roblox Player Unban Requested').setColor(0xF59E0B).addFields({name:'User ID',value:String(userId),inline:true},{name:'Moderator',value:m.author.tag,inline:true},{name:'Status',value:'Unban requested… (no prior tracked ban, confirmed via Open Cloud)',inline:false}).setTimestamp();const msg=await m.channel.send({embeds:[embed]});await setDiscordMessage(row.id,m.channel.id,msg.id)}return}
if(!/^\d+$/.test(p[0]||'')||!p.slice(1).join(' '))throw new Error('Usage: !ban <RobloxUserId> <reason>');const userId=Number(p[0]),reason=p.slice(1).join(' ');if(await active(userId))throw new Error('This user already has a moderation action pending/active.');const alreadyBanned=await isCurrentlyBanned(userId).catch(()=>null);if(alreadyBanned)throw new Error('This user is already banned in Roblox (confirmed via Open Cloud). Unban them first if you want to re-ban with a new reason.');const u=await getUser(userId),avatar=await getAvatar(userId);const row=await createBan({userId,username:u.name,displayName:u.displayName||u.name,reason,moderatorId:m.author.id,moderatorName:m.author.tag});const embed=new EmbedBuilder().setTitle('Roblox Player Banned').setColor(0xED4245).setThumbnail(avatar).addFields({name:'Username',value:u.name,inline:true},{name:'Display Name',value:u.displayName||u.name,inline:true},{name:'User ID',value:String(userId),inline:true},{name:'Reason',value:reason},{name:'Moderator',value:m.author.tag,inline:true},{name:'Status',value:'Pending Roblox enforcement',inline:true}).setTimestamp();const msg=await m.channel.send({embeds:[embed],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unban:${userId}`).setLabel('Unban').setStyle(ButtonStyle.Success))]});await setDiscordMessage(row.id,m.channel.id,msg.id);await publishCommand({action:'ban',banId:row.id,userId,displayName:u.displayName||u.name,reason});}
catch(e){const ch=await m.channel.send({content:`❌ ${e.message}`});setTimeout(()=>ch.delete().catch(()=>{}),7000)}});
client.on('interactionCreate',async i=>{if(!i.isButton()||!i.customId.startsWith('unban:'))return;try{await i.deferUpdate()}catch(e){console.error('deferUpdate failed (interaction likely expired):',e.message);return}if(!(await allowed(i.member))){await i.followUp({content:'You are not allowed to unban players.',ephemeral:true});return}const userId=i.customId.split(':')[1];try{await queueUnban(userId,i.message,i.user)}catch(e){await i.followUp({content:`❌ ${e.message}`,ephemeral:true})}});
(async()=>{await initDb();await client.login(process.env.DISCORD_TOKEN);
setInterval(async()=>{
  try{
    const rows=await getRecentResolved();
    for(const row of rows){
      try{
        const ch=await client.channels.fetch(row.discord_channel_id).catch(()=>null);
        const msg=ch?await ch.messages.fetch(row.discord_message_id).catch(()=>null):null;
        if(msg){
          const e=EmbedBuilder.from(msg.embeds[0]||{});
          const fieldCount=(msg.embeds[0]?.fields||[]).length;
          const statusIdx=fieldCount>=6?5:fieldCount-1;
          const spliceCount=statusIdx>=0?1:0;
          if(row.status==='active'){e.setColor(0xED4245);if(spliceCount)e.spliceFields(statusIdx,1,{name:'Status',value:'Banned',inline:true});else e.addFields({name:'Status',value:'Banned',inline:true});await msg.edit({embeds:[e],components:msg.components})}
          else if(row.status==='unbanned'){e.setColor(0x57F287);if(spliceCount)e.spliceFields(statusIdx,1,{name:'Status',value:'Unbanned',inline:true});else e.addFields({name:'Status',value:'Unbanned',inline:true});await msg.edit({embeds:[e],components:[]})}
          else if(row.status==='failed'){e.setColor(0x99AAB5);if(spliceCount)e.spliceFields(statusIdx,1,{name:'Status',value:`❌ Failed: ${(row.error_message||'unknown error').slice(0,200)}`,inline:false});else e.addFields({name:'Status',value:`❌ Failed: ${(row.error_message||'unknown error').slice(0,200)}`,inline:false});await msg.edit({embeds:[e],components:[]})}
        }
      }catch(err){console.error('Failed to update embed for ban',row.id,err.message)}
      await markNotified(row.id);
    }
  }catch(err){console.error('Poll error',err.message)}
},5000);
})().catch(e=>{console.error(e);process.exit(1)});
