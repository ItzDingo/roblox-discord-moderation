require('dotenv').config();
const express=require('express');const {initDb,setStatus,getPending}=require('./db');
const app=express();app.use(express.json());
const secret=(req,res,next)=>{if(req.get('x-api-secret')!==process.env.API_SECRET)return res.status(401).json({error:'unauthorized'});next()};
app.get('/health',(_,res)=>res.json({ok:true}));
app.get('/api/pending',secret,async(_,res)=>{try{res.json(await getPending())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/complete',secret,async(req,res)=>{try{const {banId,status}=req.body;if(!banId||!['active','unbanned'].includes(status))return res.status(400).json({error:'invalid'});await setStatus(banId,status);res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
(async()=>{await initDb();app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('API listening'))})().catch(e=>{console.error(e);process.exit(1)});
