-- Bloxlab Runtime Exporter
-- Install this as a Roblox Studio plugin script, then press Home > Send RBXL.

local HttpService = game:GetService("HttpService")

local EXPORT_URL = _G.BloxlabRuntimeExportUrl or "http://127.0.0.1:8080/api/rbxl/runtime-exports"

local SERVICES = {
	"Workspace",
	"Lighting",
	"ReplicatedStorage",
	"ServerScriptService",
	"ServerStorage",
	"StarterGui",
	"StarterPack",
	"StarterPlayer",
	"Players",
	"Teams",
	"SoundService",
	"Chat",
	"TextChatService",
	"MaterialService",
}

local GROUP_PROPERTIES = {
	{
		isA = "Instance",
		properties = {
			Archivable = "bool",
		},
	},
	{
		isA = "BasePart",
		properties = {
			Anchored = "bool",
			CanCollide = "bool",
			CanQuery = "bool",
			CanTouch = "bool",
			CastShadow = "bool",
			CFrame = "CFrame",
			Color = "Color3",
			CollisionGroup = "string",
			Locked = "bool",
			Massless = "bool",
			Material = "Enum",
			MaterialVariant = "string",
			Reflectance = "Float32",
			RootPriority = "Int32",
			Size = "Vector3",
			Transparency = "Float32",
		},
	},
	{
		isA = "Part",
		properties = {
			Shape = "Enum",
		},
	},
	{
		isA = "MeshPart",
		properties = {
			CollisionFidelity = "Enum",
			DoubleSided = "bool",
			MeshId = "ContentId",
			RenderFidelity = "Enum",
			TextureID = "ContentId",
		},
	},
	{
		isA = "SpecialMesh",
		properties = {
			MeshId = "ContentId",
			MeshType = "Enum",
			Offset = "Vector3",
			Scale = "Vector3",
			TextureId = "ContentId",
			VertexColor = "Vector3",
		},
	},
	{
		isA = "Attachment",
		properties = {
			CFrame = "CFrame",
			Axis = "Vector3",
			SecondaryAxis = "Vector3",
			Visible = "bool",
		},
	},
	{
		isA = "GuiObject",
		properties = {
			Active = "bool",
			AnchorPoint = "Vector2",
			AutomaticSize = "Enum",
			BackgroundColor3 = "Color3",
			BackgroundTransparency = "Float32",
			BorderColor3 = "Color3",
			BorderSizePixel = "Int32",
			ClipsDescendants = "bool",
			LayoutOrder = "Int32",
			Position = "UDim2",
			Rotation = "Float32",
			Selectable = "bool",
			Size = "UDim2",
			Visible = "bool",
			ZIndex = "Int32",
		},
	},
	{
		isA = "TextLabel",
		properties = {
			Font = "Enum",
			RichText = "bool",
			Text = "string",
			TextColor3 = "Color3",
			TextScaled = "bool",
			TextSize = "Float32",
			TextStrokeColor3 = "Color3",
			TextStrokeTransparency = "Float32",
			TextTransparency = "Float32",
			TextWrapped = "bool",
			TextXAlignment = "Enum",
			TextYAlignment = "Enum",
		},
	},
	{
		isA = "ImageLabel",
		properties = {
			Image = "ContentId",
			ImageColor3 = "Color3",
			ImageRectOffset = "Vector2",
			ImageRectSize = "Vector2",
			ImageTransparency = "Float32",
			ScaleType = "Enum",
			SliceCenter = "Rect",
			TileSize = "UDim2",
		},
	},
	{
		isA = "ScrollingFrame",
		properties = {
			AutomaticCanvasSize = "Enum",
			CanvasPosition = "Vector2",
			CanvasSize = "UDim2",
			ScrollBarThickness = "Int32",
			ScrollingDirection = "Enum",
			ScrollingEnabled = "bool",
		},
	},
	{
		isA = "Light",
		properties = {
			Brightness = "Float32",
			Color = "Color3",
			Enabled = "bool",
			Shadows = "bool",
		},
	},
	{
		isA = "PointLight",
		properties = {
			Range = "Float32",
		},
	},
	{
		isA = "SpotLight",
		properties = {
			Angle = "Float32",
			Face = "Enum",
			Range = "Float32",
		},
	},
	{
		isA = "SurfaceLight",
		properties = {
			Angle = "Float32",
			Face = "Enum",
			Range = "Float32",
		},
	},
	{
		isA = "Script",
		properties = {
			Disabled = "bool",
			RunContext = "Enum",
			Source = "string",
		},
	},
	{
		isA = "LocalScript",
		properties = {
			Disabled = "bool",
			Source = "string",
		},
	},
	{
		isA = "ModuleScript",
		properties = {
			Source = "string",
		},
	},
	{
		isA = "Sound",
		properties = {
			Looped = "bool",
			PlaybackSpeed = "Float32",
			Playing = "bool",
			RollOffMaxDistance = "Float32",
			RollOffMinDistance = "Float32",
			RollOffMode = "Enum",
			SoundId = "ContentId",
			TimePosition = "Float32",
			Volume = "Float32",
		},
	},
	{
		isA = "ParticleEmitter",
		properties = {
			Acceleration = "Vector3",
			Brightness = "Float32",
			Color = "ColorSequence",
			Drag = "Float32",
			EmissionDirection = "Enum",
			Enabled = "bool",
			Lifetime = "NumberRange",
			LightEmission = "Float32",
			LightInfluence = "Float32",
			LockedToPart = "bool",
			Orientation = "Enum",
			Rate = "Float32",
			RotSpeed = "NumberRange",
			Rotation = "NumberRange",
			Size = "NumberSequence",
			Speed = "NumberRange",
			SpreadAngle = "Vector2",
			Squash = "NumberSequence",
			Texture = "ContentId",
			TimeScale = "Float32",
			Transparency = "NumberSequence",
			VelocityInheritance = "Float32",
			ZOffset = "Float32",
		},
	},
	{
		isA = "Beam",
		properties = {
			Brightness = "Float32",
			Color = "ColorSequence",
			CurveSize0 = "Float32",
			CurveSize1 = "Float32",
			Enabled = "bool",
			FaceCamera = "bool",
			LightEmission = "Float32",
			LightInfluence = "Float32",
			Segments = "Int32",
			Texture = "ContentId",
			TextureLength = "Float32",
			TextureMode = "Enum",
			TextureSpeed = "Float32",
			Transparency = "NumberSequence",
			Width0 = "Float32",
			Width1 = "Float32",
			ZOffset = "Float32",
		},
	},
	{
		isA = "Trail",
		properties = {
			Brightness = "Float32",
			Color = "ColorSequence",
			Enabled = "bool",
			FaceCamera = "bool",
			Lifetime = "Float32",
			LightEmission = "Float32",
			LightInfluence = "Float32",
			MaxLength = "Float32",
			MinLength = "Float32",
			Texture = "ContentId",
			TextureLength = "Float32",
			TextureMode = "Enum",
			Transparency = "NumberSequence",
			WidthScale = "NumberSequence",
		},
	},
	{
		isA = "Decal",
		properties = {
			Color3 = "Color3",
			Face = "Enum",
			Texture = "ContentId",
			Transparency = "Float32",
		},
	},
	{
		isA = "Texture",
		properties = {
			Color3 = "Color3",
			Face = "Enum",
			OffsetStudsU = "Float32",
			OffsetStudsV = "Float32",
			StudsPerTileU = "Float32",
			StudsPerTileV = "Float32",
			Texture = "ContentId",
			Transparency = "Float32",
		},
	},
	{
		isA = "SurfaceAppearance",
		properties = {
			AlphaMode = "Enum",
			ColorMap = "ContentId",
			MetalnessMap = "ContentId",
			NormalMap = "ContentId",
			RoughnessMap = "ContentId",
		},
	},
}

local CLASS_PROPERTIES = {
	Workspace = {
		FallenPartsDestroyHeight = "Float32",
		Gravity = "Float32",
		StreamingEnabled = "bool",
	},
	Lighting = {
		Ambient = "Color3",
		Brightness = "Float32",
		ClockTime = "Float32",
		ColorShift_Bottom = "Color3",
		ColorShift_Top = "Color3",
		EnvironmentDiffuseScale = "Float32",
		EnvironmentSpecularScale = "Float32",
		ExposureCompensation = "Float32",
		FogColor = "Color3",
		FogEnd = "Float32",
		FogStart = "Float32",
		GeographicLatitude = "Float32",
		GlobalShadows = "bool",
		OutdoorAmbient = "Color3",
		ShadowSoftness = "Float32",
		Technology = "Enum",
	},
	Players = {
		CharacterAutoLoads = "bool",
	},
	SoundService = {
		AmbientReverb = "Enum",
		DistanceFactor = "Float32",
		DopplerScale = "Float32",
		RolloffScale = "Float32",
		VolumetricAudio = "Enum",
	},
	Terrain = {
		Decoration = "bool",
		WaterColor = "Color3",
		WaterReflectance = "Float32",
		WaterTransparency = "Float32",
		WaterWaveSize = "Float32",
		WaterWaveSpeed = "Float32",
	},
	SpawnLocation = {
		AllowTeamChangeOnTouch = "bool",
		Duration = "Float32",
		Enabled = "bool",
		Neutral = "bool",
		TeamColor = "BrickColor",
	},
	ScreenGui = {
		DisplayOrder = "Int32",
		Enabled = "bool",
		IgnoreGuiInset = "bool",
		ResetOnSpawn = "bool",
		ZIndexBehavior = "Enum",
	},
	UIListLayout = {
		FillDirection = "Enum",
		HorizontalAlignment = "Enum",
		Padding = "UDim",
		SortOrder = "Enum",
		VerticalAlignment = "Enum",
	},
	UIGridLayout = {
		CellPadding = "UDim2",
		CellSize = "UDim2",
		FillDirection = "Enum",
		HorizontalAlignment = "Enum",
		SortOrder = "Enum",
		StartCorner = "Enum",
		VerticalAlignment = "Enum",
	},
	UIPadding = {
		PaddingBottom = "UDim",
		PaddingLeft = "UDim",
		PaddingRight = "UDim",
		PaddingTop = "UDim",
	},
	UICorner = {
		CornerRadius = "UDim",
	},
	UIStroke = {
		ApplyStrokeMode = "Enum",
		Color = "Color3",
		Enabled = "bool",
		LineJoinMode = "Enum",
		Thickness = "Float32",
		Transparency = "Float32",
	},
}

local function lower(value)
	return string.lower(tostring(value or ""))
end

local function isEditorArtifact(instance)
	local name = lower(instance.Name)
	return string.find(name, "bloxlab", 1, true) ~= nil or string.sub(name, 1, 5) == "__mcp"
end

local function shouldSkip(instance)
	if isEditorArtifact(instance) then
		return true
	end

	if instance:IsA("Camera") then
		return true
	end

	return false
end

local function readProperty(instance, propertyName)
	local ok, value = pcall(function()
		return instance[propertyName]
	end)

	if ok then
		return value
	end

	return nil
end

local function serializeVector2(value)
	return { X = value.X, Y = value.Y }
end

local function serializeVector3(value)
	return { X = value.X, Y = value.Y, Z = value.Z }
end

local function serializeColor3(value)
	return { R = value.R, G = value.G, B = value.B }
end

local function serializeUDim(value)
	return { Scale = value.Scale, Offset = value.Offset }
end

local function serializeUDim2(value)
	return { X = serializeUDim(value.X), Y = serializeUDim(value.Y) }
end

local function serializeCFrame(value)
	return { Components = { value:GetComponents() } }
end

local function serializeRect(value)
	return {
		Min = serializeVector2(value.Min),
		Max = serializeVector2(value.Max),
	}
end

local function serializeNumberRange(value)
	return { Min = value.Min, Max = value.Max }
end

local function serializeNumberSequence(value)
	local keypoints = {}
	for _, keypoint in ipairs(value.Keypoints) do
		table.insert(keypoints, {
			Time = keypoint.Time,
			Value = keypoint.Value,
			Envelope = keypoint.Envelope,
		})
	end
	return { Keypoints = keypoints }
end

local function serializeColorSequence(value)
	local keypoints = {}
	for _, keypoint in ipairs(value.Keypoints) do
		table.insert(keypoints, {
			Time = keypoint.Time,
			Color = serializeColor3(keypoint.Value),
		})
	end
	return { Keypoints = keypoints }
end

local function serializeValue(propertyType, value)
	if value == nil then
		return nil
	end

	if propertyType == "bool" or propertyType == "string" then
		return value
	elseif propertyType == "Float32" or propertyType == "Float64" or propertyType == "Int32" or propertyType == "Int64" then
		return value
	elseif propertyType == "Enum" then
		return value.Value
	elseif propertyType == "EnumItem" then
		return { Type = tostring(value.EnumType), Value = value.Value }
	elseif propertyType == "Vector2" then
		return serializeVector2(value)
	elseif propertyType == "Vector3" then
		return serializeVector3(value)
	elseif propertyType == "Color3" then
		return serializeColor3(value)
	elseif propertyType == "CFrame" then
		return serializeCFrame(value)
	elseif propertyType == "UDim" then
		return serializeUDim(value)
	elseif propertyType == "UDim2" then
		return serializeUDim2(value)
	elseif propertyType == "Rect" then
		return serializeRect(value)
	elseif propertyType == "NumberRange" then
		return serializeNumberRange(value)
	elseif propertyType == "NumberSequence" then
		return serializeNumberSequence(value)
	elseif propertyType == "ColorSequence" then
		return serializeColorSequence(value)
	elseif propertyType == "BrickColor" then
		return value.Number
	elseif propertyType == "ContentId" or propertyType == "Content" then
		return tostring(value)
	end

	return nil
end

local function addProperty(properties, instance, propertyName, propertyType)
	if properties[propertyName] ~= nil then
		return
	end

	local rawValue = readProperty(instance, propertyName)
	local serialized = serializeValue(propertyType, rawValue)

	if serialized ~= nil then
		properties[propertyName] = {
			Type = propertyType,
			Value = serialized,
		}
	end
end

local function buildProperties(instance)
	local properties = {}

	for _, group in ipairs(GROUP_PROPERTIES) do
		if instance:IsA(group.isA) then
			for propertyName, propertyType in pairs(group.properties) do
				addProperty(properties, instance, propertyName, propertyType)
			end
		end
	end

	local classProperties = CLASS_PROPERTIES[instance.ClassName]
	if classProperties then
		for propertyName, propertyType in pairs(classProperties) do
			addProperty(properties, instance, propertyName, propertyType)
		end
	end

	if instance.ClassName == "Players" then
		properties.CharacterAutoLoads = {
			Type = "bool",
			Value = true,
		}
	end

	return properties
end

local function makeSnapshot()
	local nodes = {}
	local instanceIds = {}
	local childIdsByInstance = {}
	local nextId = 0

	local function nextNodeId()
		local id = string.format("n_%06d", nextId)
		nextId += 1
		return id
	end

	local rootId = nextNodeId()

	local function assignId(instance)
		local id = instanceIds[instance]
		if id then
			return id
		end

		id = nextNodeId()
		instanceIds[instance] = id
		return id
	end

	local function collect(instance)
		local id = assignId(instance)
		local childIds = {}
		childIdsByInstance[instance] = childIds

		if instance.ClassName == "Players" then
			return id
		end

		for _, child in ipairs(instance:GetChildren()) do
			if not shouldSkip(child) then
				table.insert(childIds, collect(child))
			end
		end

		return id
	end

	local serviceIds = {}
	for _, serviceName in ipairs(SERVICES) do
		local ok, service = pcall(function()
			return game:GetService(serviceName)
		end)

		if ok and service and not shouldSkip(service) then
			table.insert(serviceIds, collect(service))
		end
	end

	nodes[rootId] = {
		Id = rootId,
		ClassName = "DataModel",
		Name = "DataModel",
		ParentId = nil,
		ChildIds = serviceIds,
		Properties = {},
	}

	local function writeNode(instance, parentId)
		local id = instanceIds[instance]
		if not id then
			return
		end

		local childIds = childIdsByInstance[instance] or {}
		nodes[id] = {
			Id = id,
			ClassName = instance.ClassName,
			Name = instance.Name,
			ParentId = parentId,
			ChildIds = childIds,
			Properties = buildProperties(instance),
		}

		for _, child in ipairs(instance:GetChildren()) do
			if instanceIds[child] then
				writeNode(child, id)
			end
		end
	end

	local hasSpawnLocation = false
	for instance in pairs(instanceIds) do
		if instance:IsA("SpawnLocation") then
			hasSpawnLocation = true
			break
		end
	end

	for _, serviceName in ipairs(SERVICES) do
		local ok, service = pcall(function()
			return game:GetService(serviceName)
		end)

		if ok and service and instanceIds[service] then
			writeNode(service, rootId)
		end
	end

	if not hasSpawnLocation then
		local workspaceId = instanceIds[workspace]
		if workspaceId and nodes[workspaceId] then
			local spawnId = nextNodeId()
			table.insert(nodes[workspaceId].ChildIds, spawnId)
			nodes[spawnId] = {
				Id = spawnId,
				ClassName = "SpawnLocation",
				Name = "RuntimeSpawn",
				ParentId = workspaceId,
				ChildIds = {},
				Properties = {
					Anchored = { Type = "bool", Value = true },
					CanCollide = { Type = "bool", Value = true },
					Color = { Type = "Color3", Value = { R = 0.1, G = 0.7, B = 0.35 } },
					CFrame = { Type = "CFrame", Value = { Components = { 0, 4, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1 } } },
					Duration = { Type = "Float32", Value = 0 },
					Enabled = { Type = "bool", Value = true },
					Neutral = { Type = "bool", Value = true },
					Size = { Type = "Vector3", Value = { X = 6, Y = 1, Z = 6 } },
					Transparency = { Type = "Float32", Value = 0.5 },
				},
			}
		end
	end

	return {
		schema = "bloxlab.robloxRuntime.v1",
		source = {
			fileName = "runtime-place.rbxl",
			format = "runtime-json",
			exportedAt = DateTime.now():ToIsoDate(),
		},
		rootId = rootId,
		nodes = nodes,
	}
end

local toolbar = plugin:CreateToolbar("Home")
local button = toolbar:CreateButton("Send RBXL", "Send runtime JSON to the Bloxlab website", "")
button.ClickableWhenViewportHidden = true

local busy = false

button.Click:Connect(function()
	if busy then
		return
	end

	busy = true
	button:SetActive(true)

	local ok, result = pcall(function()
		local snapshot = makeSnapshot()
		local body = HttpService:JSONEncode({
			fileName = "runtime-place.rbxl",
			snapshot = snapshot,
		})

		local response = HttpService:RequestAsync({
			Url = EXPORT_URL,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
			},
			Body = body,
		})

		if not response.Success then
			error(("HTTP %s: %s"):format(tostring(response.StatusCode), tostring(response.Body)))
		end

		return response.Body
	end)

	button:SetActive(false)
	busy = false

	if ok then
		print("[Bloxlab] Runtime RBXL is ready on the website:", result)
	else
		warn("[Bloxlab] Runtime RBXL export failed:", result)
	end
end)
