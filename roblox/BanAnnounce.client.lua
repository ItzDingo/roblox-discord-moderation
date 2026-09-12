local TweenService=game:GetService("TweenService")
local ReplicatedStorage=game:GetService("ReplicatedStorage")
local player=game.Players.LocalPlayer
local gui=player:WaitForChild("PlayerGui"):WaitForChild("BanAnnounce")
local frame=gui:WaitForChild("Frame")
local info=frame:WaitForChild("Info")
local sound=frame:FindFirstChildWhichIsA("Sound",true)
local hidden=UDim2.new(0.5,0,-0.55,0)
local shown=UDim2.new(0.5,0,0.08,0)
frame.AnchorPoint=Vector2.new(0.5,0.5);frame.Position=hidden
frame.Visible=false

local queue={}
local processing=false

local function playOne(data)
	info.Text=string.format("%s Has Been Banned for %s",tostring(data.displayName),tostring(data.reason))
	frame.Visible=true
	TweenService:Create(frame,TweenInfo.new(1.2,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Position=shown}):Play()
	if sound then sound:Play() end
	task.wait(7)
	local hideTween=TweenService:Create(frame,TweenInfo.new(1,Enum.EasingStyle.Quad,Enum.EasingDirection.In),{Position=hidden})
	hideTween:Play()
	hideTween.Completed:Wait()
	frame.Visible=false
end

local function processQueue()
	if processing then return end
	processing=true
	while #queue>0 do
		local data=table.remove(queue,1)
		playOne(data)
	end
	processing=false
end

ReplicatedStorage:WaitForChild("BanAnnouncement").OnClientEvent:Connect(function(data)
	table.insert(queue,data)
	processQueue()
end)
