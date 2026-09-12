local Players=game:GetService("Players")
local MessagingService=game:GetService("MessagingService")
local HttpService=game:GetService("HttpService")
local ReplicatedStorage=game:GetService("ReplicatedStorage")
local API_URL="https://YOUR-RENDER-API.onrender.com"
local API_SECRET="YOUR_API_SECRET"
local COMMAND_TOPIC="ModerationCommand_v1"
local ANNOUNCE_TOPIC="BanAnnounce_v1"
local event=ReplicatedStorage:FindFirstChild("BanAnnouncement") or Instance.new("RemoteEvent")
event.Name="BanAnnouncement";event.Parent=ReplicatedStorage
local function api(path,method,body)local ok,res=pcall(function()return HttpService:RequestAsync({Url=API_URL..path,Method=method or "GET",Headers={['x-api-secret']=API_SECRET,['Content-Type']='application/json'},Body=body and HttpService:JSONEncode(body) or nil})end);if not ok or not res.Success then warn("Moderation API error",res and res.StatusCode or res);return false end;return true end
local function announce(data)pcall(function()MessagingService:PublishAsync(ANNOUNCE_TOPIC,data)end)end
local function execute(data)
 local userId=tonumber(data.userId);if not userId then return end
 if data.action=="ban" then
  local ok,err=pcall(function()Players:BanAsync({UserIds={userId},ApplyToUniverse=true,Duration=-1,DisplayReason=tostring(data.reason),PrivateReason="Discord moderation ban #"..tostring(data.banId),ExcludeAltAccounts=true,ApplyDeviceBlock=false})end)
  if ok then api("/api/complete","POST",{banId=data.banId,status="active"});announce({displayName=data.displayName,reason=data.reason}) else warn("BanAsync failed",err);api("/api/complete","POST",{banId=data.banId,status="failed",error=tostring(err)}) end
 elseif data.action=="unban" then
  local ok,err=pcall(function()Players:UnbanAsync({UserIds={userId},ApplyToUniverse=true})end)
  if ok then api("/api/complete","POST",{banId=data.banId,status="unbanned"}) else warn("UnbanAsync failed",err);api("/api/complete","POST",{banId=data.banId,status="failed",error=tostring(err)}) end
 end
end
local function processPending()local ok,res=pcall(function()return HttpService:RequestAsync({Url=API_URL.."/api/pending",Method="GET",Headers={['x-api-secret']=API_SECRET}})end);if not ok or not res.Success then return end;local list=HttpService:JSONDecode(res.Body);for _,d in ipairs(list)do execute({action=d.status=="unban_pending" and "unban" or "ban",banId=d.id,userId=d.user_id,displayName=d.display_name,reason=d.reason})end end
MessagingService:SubscribeAsync(COMMAND_TOPIC,function(msg)local ok,data=pcall(function()return HttpService:JSONDecode(msg.Data)end);if ok then execute(data)end end)
MessagingService:SubscribeAsync(ANNOUNCE_TOPIC,function(msg)event:FireAllClients(msg.Data)end)
task.defer(processPending)
