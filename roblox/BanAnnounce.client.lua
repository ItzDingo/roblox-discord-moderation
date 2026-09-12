local TweenService=game:GetService("TweenService")
local ReplicatedStorage=game:GetService("ReplicatedStorage")
local player=game.Players.LocalPlayer
local gui=player:WaitForChild("PlayerGui"):WaitForChild("BanAnnounce")
local frame=gui:WaitForChild("Frame")
local info=frame:WaitForChild("Info")
local sound=frame:FindFirstChildWhichIsA("Sound",true)
local hidden=UDim2.new(0.5,0,-0.25,0)
local shown=UDim2.new(0.5,0,0.08,0)
frame.AnchorPoint=Vector2.new(0.5,0.5);frame.Position=hidden
local busy=false
ReplicatedStorage:WaitForChild("BanAnnouncement").OnClientEvent:Connect(function(data)
 if busy then return end;busy=true
 info.Text=string.format("%s Has Been Banned for %s",tostring(data.displayName),tostring(data.reason))
 TweenService:Create(frame,TweenInfo.new(1.2,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Position=shown}):Play()
 if sound then sound:Play() end
task.wait(7)
 TweenService:Create(frame,TweenInfo.new(1,Enum.EasingStyle.Quad,Enum.EasingDirection.In),{Position=hidden}):Play()
task.wait(1.1);busy=false
end)
