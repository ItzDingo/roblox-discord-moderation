const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
async function initDb(){await pool.query(`CREATE TABLE IF NOT EXISTS bans (id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,username TEXT NOT NULL,display_name TEXT NOT NULL,reason TEXT NOT NULL,moderator_id TEXT NOT NULL,moderator_name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),executed_at TIMESTAMPTZ,discord_channel_id TEXT,discord_message_id TEXT); CREATE INDEX IF NOT EXISTS bans_user_status_idx ON bans(user_id,status);`)}
async function active(userId){const r=await pool.query("SELECT * FROM bans WHERE user_id=$1 AND status IN ('pending','active','unban_pending') ORDER BY id DESC LIMIT 1",[userId]);return r.rows[0]||null}
async function createBan(x){const r=await pool.query(`INSERT INTO bans(user_id,username,display_name,reason,moderator_id,moderator_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[x.userId,x.username,x.displayName,x.reason,x.moderatorId,x.moderatorName]);return r.rows[0]}
async function setDiscordMessage(id,channel,message){await pool.query('UPDATE bans SET discord_channel_id=$2,discord_message_id=$3 WHERE id=$1',[id,channel,message])}
async function setStatus(id,status){await pool.query('UPDATE bans SET status=$2,executed_at=CASE WHEN $2 IN (\'active\',\'unbanned\') THEN NOW() ELSE executed_at END WHERE id=$1',[id,status])}
async function getPending(){const r=await pool.query("SELECT * FROM bans WHERE status IN ('pending','unban_pending') ORDER BY id ASC");return r.rows}
async function getById(id){const r=await pool.query('SELECT * FROM bans WHERE id=$1',[id]);return r.rows[0]||null}
async function getRecentCompleted(){const r=await pool.query("SELECT * FROM bans WHERE status='unbanned' AND executed_at > NOW() - INTERVAL '2 minutes' ORDER BY executed_at DESC");return r.rows}
module.exports={pool,initDb,active,createBan,setDiscordMessage,setStatus,getPending,getById,getRecentCompleted};
