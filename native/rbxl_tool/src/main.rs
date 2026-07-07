use std::{
    collections::{BTreeMap, HashMap, HashSet},
    env,
    fs::File,
    io::{BufReader, BufWriter, Cursor, Read},
    path::{Path, PathBuf},
    str::FromStr,
};

use anyhow::{anyhow, bail, Context, Result};
use rbx_dom_weak::{
    types::{
        Axes, BrickColor, CFrame, Color3, Color3uint8, ColorSequence, ColorSequenceKeypoint,
        Content, ContentId, ContentType, Enum, EnumItem, Faces, Font, FontStyle, FontWeight,
        Matrix3, NumberRange, NumberSequence, NumberSequenceKeypoint, Ray, Rect, Ref, Region3,
        Region3int16, UDim, UDim2, Variant, Vector2, Vector2int16, Vector3, Vector3int16,
    },
    InstanceBuilder, WeakDom,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum SourceFormat {
    Rbxl,
    Rbxlx,
    Rbxm,
    Rbxmx,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ParserKind {
    Binary,
    Xml,
}

#[derive(Debug, Serialize)]
struct Snapshot {
    schema: &'static str,
    source: SnapshotSource,
    #[serde(rename = "rootId")]
    root_id: String,
    nodes: BTreeMap<String, SnapshotNode>,
}

#[derive(Debug, Serialize)]
struct SnapshotSource {
    #[serde(rename = "fileName")]
    file_name: String,
    format: SourceFormat,
}

#[derive(Debug, Serialize)]
struct SnapshotNode {
    #[serde(rename = "Id")]
    id: String,
    #[serde(rename = "ClassName")]
    class_name: String,
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "ParentId")]
    parent_id: Option<String>,
    #[serde(rename = "ChildIds")]
    child_ids: Vec<String>,
    #[serde(rename = "Properties")]
    properties: BTreeMap<String, SnapshotProperty>,
}

#[derive(Debug, Serialize)]
struct SnapshotProperty {
    #[serde(rename = "Type")]
    ty: &'static str,
    #[serde(rename = "Value")]
    value: Value,
}

#[derive(Debug)]
struct RuntimeSnapshot {
    root_id: String,
    nodes: BTreeMap<String, RuntimeNode>,
}

#[derive(Debug)]
struct RuntimeNode {
    id: String,
    class_name: String,
    name: String,
    parent_id: Option<String>,
    child_ids: Vec<String>,
    properties: BTreeMap<String, RuntimeProperty>,
}

#[derive(Debug)]
struct RuntimeProperty {
    ty: Option<String>,
    value: Value,
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("parse") => {
            let input = required_arg(&args, 2, "input file")?;
            let output = required_arg(&args, 3, "snapshot output")?;
            parse_command(input, output)
        }
        Some("save-rbxl") => {
            let input = required_arg(&args, 2, "input file")?;
            let output = required_arg(&args, 3, "output .rbxl")?;
            save_rbxl_command(input, output)
        }
        Some("from-json") => {
            let input = required_arg(&args, 2, "runtime JSON")?;
            let output = required_arg(&args, 3, "output .rbxl")?;
            from_json_command(input, output)
        }
        _ => {
            eprintln!("Usage:");
            eprintln!("  rbxl_tool parse <input.rbxl|rbxlx|rbxm|rbxmx> <snapshot.json>");
            eprintln!("  rbxl_tool save-rbxl <input.rbxl|rbxlx|rbxm|rbxmx> <output.rbxl>");
            eprintln!("  rbxl_tool from-json <runtime.json> <output.rbxl>");
            bail!("unknown or missing command");
        }
    }
}

fn required_arg(args: &[String], index: usize, label: &str) -> Result<PathBuf> {
    args.get(index)
        .map(PathBuf::from)
        .with_context(|| format!("missing {label}"))
}

fn parse_command(input: PathBuf, output: PathBuf) -> Result<()> {
    let loaded = load_dom(&input)?;
    let snapshot = build_snapshot(&loaded.dom, &input, loaded.format);
    let file = File::create(&output)
        .with_context(|| format!("failed to create snapshot {}", output.display()))?;
    serde_json::to_writer_pretty(BufWriter::new(file), &snapshot)
        .context("failed to write snapshot JSON")?;

    println!(
        "{}",
        serde_json::to_string(&json!({
            "ok": true,
            "action": "parse",
            "format": loaded.format,
            "nodeCount": snapshot.nodes.len(),
        }))?
    );
    Ok(())
}

fn save_rbxl_command(input: PathBuf, output: PathBuf) -> Result<()> {
    let loaded = load_dom(&input)?;
    write_binary_rbxl(&loaded.dom, &output)?;

    println!(
        "{}",
        serde_json::to_string(&json!({
            "ok": true,
            "action": "save-rbxl",
            "inputFormat": loaded.format,
            "topLevelCount": writable_refs(&loaded.dom).len(),
        }))?
    );
    Ok(())
}

fn from_json_command(input: PathBuf, output: PathBuf) -> Result<()> {
    let value = read_json_value(&input)?;
    let runtime = normalize_runtime_snapshot(value)?;
    let dom = runtime_snapshot_to_dom(&runtime)?;
    write_binary_rbxl(&dom, &output)?;

    println!(
        "{}",
        serde_json::to_string(&json!({
            "ok": true,
            "action": "from-json",
            "nodeCount": runtime.nodes.len(),
            "topLevelCount": writable_refs(&dom).len(),
        }))?
    );
    Ok(())
}

fn read_json_value(path: &Path) -> Result<Value> {
    let mut bytes = Vec::new();
    File::open(path)
        .with_context(|| format!("failed to open {}", path.display()))?
        .read_to_end(&mut bytes)
        .with_context(|| format!("failed to read {}", path.display()))?;
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes);
    serde_json::from_slice(bytes)
        .with_context(|| format!("failed to parse runtime JSON {}", path.display()))
}

fn write_binary_rbxl(dom: &WeakDom, output: &Path) -> Result<()> {
    let refs = writable_refs(dom);
    if refs.is_empty() {
        bail!("DOM has no writable top-level instances");
    }

    let file =
        File::create(output).with_context(|| format!("failed to create {}", output.display()))?;
    rbx_binary::to_writer(BufWriter::new(file), dom, &refs)
        .context("failed to write binary RBXL")?;
    Ok(())
}

fn writable_refs(dom: &WeakDom) -> Vec<Ref> {
    if dom.root().class.as_str() == "DataModel" {
        dom.root().children().to_vec()
    } else {
        vec![dom.root_ref()]
    }
}

struct LoadedDom {
    dom: WeakDom,
    format: SourceFormat,
}

fn load_dom(path: &Path) -> Result<LoadedDom> {
    let mut bytes = Vec::new();
    File::open(path)
        .with_context(|| format!("failed to open {}", path.display()))?
        .read_to_end(&mut bytes)
        .with_context(|| format!("failed to read {}", path.display()))?;

    let format = detect_source_format(path);
    let parser = detect_parser_kind(path, &bytes)?;
    let cursor = Cursor::new(bytes);
    let reader = BufReader::new(cursor);
    let dom = match parser {
        ParserKind::Binary => {
            rbx_binary::from_reader(reader).context("failed to parse binary Roblox file")?
        }
        ParserKind::Xml => {
            rbx_xml::from_reader_default(reader).context("failed to parse XML Roblox file")?
        }
    };

    Ok(LoadedDom { dom, format })
}

fn detect_source_format(path: &Path) -> SourceFormat {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("rbxl") => SourceFormat::Rbxl,
        Some("rbxlx") => SourceFormat::Rbxlx,
        Some("rbxm") => SourceFormat::Rbxm,
        Some("rbxmx") => SourceFormat::Rbxmx,
        _ => SourceFormat::Unknown,
    }
}

fn detect_parser_kind(path: &Path, bytes: &[u8]) -> Result<ParserKind> {
    if bytes.starts_with(b"<roblox!") {
        return Ok(ParserKind::Binary);
    }

    let trimmed = trim_xml_start(bytes);
    if trimmed.starts_with(b"<roblox") || trimmed.starts_with(b"<?xml") {
        return Ok(ParserKind::Xml);
    }

    match detect_source_format(path) {
        SourceFormat::Rbxl | SourceFormat::Rbxm => Ok(ParserKind::Binary),
        SourceFormat::Rbxlx | SourceFormat::Rbxmx => Ok(ParserKind::Xml),
        SourceFormat::Unknown => bail!("could not detect Roblox file format"),
    }
}

fn trim_xml_start(bytes: &[u8]) -> &[u8] {
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    let first_non_space = bytes
        .iter()
        .position(|byte| !byte.is_ascii_whitespace())
        .unwrap_or(0);
    &bytes[first_non_space..]
}

fn build_snapshot(dom: &WeakDom, input: &Path, format: SourceFormat) -> Snapshot {
    let mut ref_to_id: HashMap<Ref, String> = HashMap::new();
    for (index, instance) in dom.descendants().enumerate() {
        ref_to_id.insert(instance.referent(), format!("n_{index:06}"));
    }

    let root_id = ref_to_id
        .get(&dom.root_ref())
        .cloned()
        .unwrap_or_else(|| "n_000000".to_owned());

    let mut nodes = BTreeMap::new();
    for instance in dom.descendants() {
        let id = ref_to_id
            .get(&instance.referent())
            .cloned()
            .unwrap_or_else(|| instance.referent().to_string());

        let parent_id = if instance.parent().is_none() {
            None
        } else {
            ref_to_id.get(&instance.parent()).cloned()
        };

        let child_ids = instance
            .children()
            .iter()
            .filter_map(|child| ref_to_id.get(child).cloned())
            .collect();

        let mut properties = BTreeMap::new();
        for (name, value) in instance.properties.iter() {
            properties.insert(
                name.as_str().to_owned(),
                serialize_property(value, &ref_to_id),
            );
        }

        nodes.insert(
            id.clone(),
            SnapshotNode {
                id,
                class_name: instance.class.as_str().to_owned(),
                name: instance.name.clone(),
                parent_id,
                child_ids,
                properties,
            },
        );
    }

    Snapshot {
        schema: "bloxlab.robloxDom.v1",
        source: SnapshotSource {
            file_name: input
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("place.rbxlx")
                .to_owned(),
            format,
        },
        root_id,
        nodes,
    }
}

fn serialize_property(value: &Variant, ref_to_id: &HashMap<Ref, String>) -> SnapshotProperty {
    match value {
        Variant::Bool(value) => prop("Bool", json!(value)),
        Variant::String(value) => prop("String", json!(value)),
        Variant::Float32(value) => prop("Float32", json!(value)),
        Variant::Float64(value) => prop("Float64", json!(value)),
        Variant::Int32(value) => prop("Int32", json!(value)),
        Variant::Int64(value) => prop("Int64", json!(value)),
        Variant::Vector2(value) => prop("Vector2", vector2_json(value)),
        Variant::Vector2int16(value) => prop("Vector2int16", json!([value.x, value.y])),
        Variant::Vector3(value) => prop("Vector3", vector3_json(value)),
        Variant::Vector3int16(value) => prop("Vector3int16", json!([value.x, value.y, value.z])),
        Variant::Color3(value) => prop(
            "Color3",
            json!({
                "r": value.r,
                "g": value.g,
                "b": value.b,
            }),
        ),
        Variant::Color3uint8(value) => prop(
            "Color3uint8",
            json!({
                "r": value.r,
                "g": value.g,
                "b": value.b,
            }),
        ),
        Variant::CFrame(value) => prop(
            "CFrame",
            json!({
                "position": vector3_json(&value.position),
                "orientation": {
                    "x": vector3_json(&value.orientation.x),
                    "y": vector3_json(&value.orientation.y),
                    "z": vector3_json(&value.orientation.z),
                },
            }),
        ),
        Variant::UDim(value) => prop(
            "UDim",
            json!({
                "scale": value.scale,
                "offset": value.offset,
            }),
        ),
        Variant::UDim2(value) => prop(
            "UDim2",
            json!({
                "x": {
                    "scale": value.x.scale,
                    "offset": value.x.offset,
                },
                "y": {
                    "scale": value.y.scale,
                    "offset": value.y.offset,
                },
            }),
        ),
        Variant::Enum(value) => prop("Enum", json!(value.to_u32())),
        Variant::EnumItem(value) => prop(
            "EnumItem",
            json!({
                "type": value.ty,
                "value": value.value,
            }),
        ),
        Variant::BrickColor(value) => prop(
            "BrickColor",
            json!({
                "name": value.to_string(),
                "value": *value as u16,
                "color": {
                    "r": value.to_color3uint8().r,
                    "g": value.to_color3uint8().g,
                    "b": value.to_color3uint8().b,
                },
            }),
        ),
        Variant::Ref(value) => prop("Ref", ref_json(value, ref_to_id)),
        Variant::ContentId(value) => prop("ContentId", json!(value.as_str())),
        Variant::Content(value) => prop("Content", content_json(value.value(), ref_to_id)),
        Variant::NumberRange(value) => prop(
            "NumberRange",
            json!({
                "min": value.min,
                "max": value.max,
            }),
        ),
        Variant::Rect(value) => prop(
            "Rect",
            json!({
                "min": vector2_json(&value.min),
                "max": vector2_json(&value.max),
            }),
        ),
        Variant::Axes(value) => prop("Axes", serde_json::to_value(value).unwrap_or(Value::Null)),
        Variant::Faces(value) => prop("Faces", serde_json::to_value(value).unwrap_or(Value::Null)),
        Variant::Tags(value) => prop("Tags", serde_json::to_value(value).unwrap_or(Value::Null)),
        Variant::Font(value) => prop("Font", serde_json::to_value(value).unwrap_or(Value::Null)),
        Variant::UniqueId(value) => prop(
            "UniqueId",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::BinaryString(value) => prop(
            "BinaryString",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::SharedString(value) => prop(
            "SharedString",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::NetAssetRef(value) => prop(
            "NetAssetRef",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::NumberSequence(value) => prop(
            "NumberSequence",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::ColorSequence(value) => prop(
            "ColorSequence",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::PhysicalProperties(value) => prop(
            "PhysicalProperties",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::Ray(value) => prop("Ray", serde_json::to_value(value).unwrap_or(Value::Null)),
        Variant::Region3(value) => prop(
            "Region3",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::Region3int16(value) => prop(
            "Region3int16",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::OptionalCFrame(value) => prop(
            "OptionalCFrame",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        Variant::Attributes(value) => prop(
            "Attributes",
            serde_json::to_value(value).unwrap_or(Value::Null),
        ),
        _ => prop("Unknown", Value::Null),
    }
}

fn prop(ty: &'static str, value: Value) -> SnapshotProperty {
    SnapshotProperty { ty, value }
}

fn vector2_json(value: &Vector2) -> Value {
    json!({
        "x": value.x,
        "y": value.y,
    })
}

fn vector3_json(value: &Vector3) -> Value {
    json!({
        "x": value.x,
        "y": value.y,
        "z": value.z,
    })
}

fn ref_json(value: &Ref, ref_to_id: &HashMap<Ref, String>) -> Value {
    if value.is_none() {
        Value::Null
    } else {
        json!({
            "id": ref_to_id.get(value),
            "referent": value.to_string(),
        })
    }
}

fn content_json(value: &ContentType, ref_to_id: &HashMap<Ref, String>) -> Value {
    match value {
        ContentType::None => json!({
            "kind": "None",
        }),
        ContentType::Uri(uri) => json!({
            "kind": "Uri",
            "uri": uri,
        }),
        ContentType::Object(referent) => json!({
            "kind": "Object",
            "ref": ref_json(referent, ref_to_id),
        }),
        _ => json!({
            "kind": "Unknown",
        }),
    }
}

fn normalize_runtime_snapshot(value: Value) -> Result<RuntimeSnapshot> {
    let snapshot_value = unwrap_snapshot_payload(&value);
    let snapshot_obj = snapshot_value
        .as_object()
        .ok_or_else(|| anyhow!("runtime JSON must be an object"))?;
    let nodes_value = get_any(snapshot_obj, &["nodes", "Nodes", "instances", "Instances"])
        .ok_or_else(|| anyhow!("runtime JSON is missing nodes"))?;

    let mut nodes = match nodes_value {
        Value::Object(map) => normalize_nodes_object(map)?,
        Value::Array(items) => normalize_nodes_array(items)?,
        _ => bail!("runtime JSON nodes must be an object or array"),
    };

    attach_derived_children(&mut nodes);

    let root_id = get_any(
        snapshot_obj,
        &["rootId", "RootId", "rootID", "root", "Root"],
    )
    .and_then(value_to_string)
    .or_else(|| find_root_id(&nodes))
    .ok_or_else(|| anyhow!("runtime JSON is missing rootId and no root node could be inferred"))?;

    if !nodes.contains_key(&root_id) {
        bail!("runtime JSON rootId '{root_id}' does not exist in nodes");
    }

    Ok(RuntimeSnapshot { root_id, nodes })
}

fn unwrap_snapshot_payload(value: &Value) -> &Value {
    value
        .as_object()
        .and_then(|object| {
            get_any(
                object,
                &[
                    "snapshot",
                    "Snapshot",
                    "dom",
                    "Dom",
                    "runtimeDom",
                    "runtimeDOM",
                ],
            )
        })
        .unwrap_or(value)
}

fn normalize_nodes_object(map: &Map<String, Value>) -> Result<BTreeMap<String, RuntimeNode>> {
    let mut nodes = BTreeMap::new();
    for (key, value) in map {
        let node = normalize_node(Some(key), value)
            .with_context(|| format!("invalid runtime node '{key}'"))?;
        nodes.insert(node.id.clone(), node);
    }
    Ok(nodes)
}

fn normalize_nodes_array(items: &[Value]) -> Result<BTreeMap<String, RuntimeNode>> {
    let mut nodes = BTreeMap::new();
    for (index, value) in items.iter().enumerate() {
        let fallback = format!("n_{index:06}");
        let node = normalize_node(Some(&fallback), value)
            .with_context(|| format!("invalid runtime node at index {index}"))?;
        nodes.insert(node.id.clone(), node);
    }
    Ok(nodes)
}

fn normalize_node(fallback_id: Option<&str>, value: &Value) -> Result<RuntimeNode> {
    let object = value
        .as_object()
        .ok_or_else(|| anyhow!("node must be an object"))?;

    let id = get_any(object, &["Id", "id", "ID"])
        .and_then(value_to_string)
        .or_else(|| fallback_id.map(str::to_owned))
        .ok_or_else(|| anyhow!("node is missing Id"))?;
    let class_name = get_any(object, &["ClassName", "className", "class", "Class"])
        .and_then(value_to_string)
        .ok_or_else(|| anyhow!("node '{id}' is missing ClassName"))?;
    let name = get_any(object, &["Name", "name"])
        .and_then(value_to_string)
        .unwrap_or_else(|| class_name.clone());
    let parent_id = get_any(
        object,
        &["ParentId", "parentId", "ParentID", "parent", "Parent"],
    )
    .and_then(value_to_string)
    .filter(|value| !value.is_empty());
    let child_ids = get_any(object, &["ChildIds", "childIds", "Children", "children"])
        .map(normalize_child_ids)
        .transpose()?
        .unwrap_or_default();
    let properties = get_any(object, &["Properties", "properties", "props", "Props"])
        .map(normalize_properties)
        .transpose()?
        .unwrap_or_default();

    Ok(RuntimeNode {
        id,
        class_name,
        name,
        parent_id,
        child_ids,
        properties,
    })
}

fn normalize_child_ids(value: &Value) -> Result<Vec<String>> {
    let children = value
        .as_array()
        .ok_or_else(|| anyhow!("ChildIds must be an array"))?;
    let mut ids = Vec::with_capacity(children.len());
    for child in children {
        if let Some(id) = value_to_string(child) {
            ids.push(id);
        } else if let Some(object) = child.as_object() {
            if let Some(id) = get_any(object, &["Id", "id", "ID"]).and_then(value_to_string) {
                ids.push(id);
            }
        }
    }
    Ok(ids)
}

fn normalize_properties(value: &Value) -> Result<BTreeMap<String, RuntimeProperty>> {
    match value {
        Value::Object(map) => {
            let mut properties = BTreeMap::new();
            for (name, entry) in map {
                properties.insert(name.clone(), normalize_property_entry(entry));
            }
            Ok(properties)
        }
        Value::Array(items) => {
            let mut properties = BTreeMap::new();
            for entry in items {
                let object = entry
                    .as_object()
                    .ok_or_else(|| anyhow!("property array entries must be objects"))?;
                let name = get_any(object, &["Name", "name", "Property", "property"])
                    .and_then(value_to_string)
                    .ok_or_else(|| anyhow!("property entry is missing name"))?;
                properties.insert(name, normalize_property_entry(entry));
            }
            Ok(properties)
        }
        _ => bail!("Properties must be an object or array"),
    }
}

fn normalize_property_entry(entry: &Value) -> RuntimeProperty {
    let Some(object) = entry.as_object() else {
        return RuntimeProperty {
            ty: None,
            value: entry.clone(),
        };
    };

    let ty = get_any(object, &["Type", "type", "ty", "kind", "Kind"]).and_then(value_to_string);
    let value = get_any(object, &["Value", "value"])
        .cloned()
        .unwrap_or_else(|| entry.clone());

    RuntimeProperty { ty, value }
}

fn attach_derived_children(nodes: &mut BTreeMap<String, RuntimeNode>) {
    let parent_pairs: Vec<(String, String)> = nodes
        .values()
        .filter_map(|node| {
            node.parent_id
                .as_ref()
                .map(|parent_id| (parent_id.clone(), node.id.clone()))
        })
        .collect();

    for (parent_id, child_id) in parent_pairs {
        if let Some(parent) = nodes.get_mut(&parent_id) {
            if !parent
                .child_ids
                .iter()
                .any(|existing| existing == &child_id)
            {
                parent.child_ids.push(child_id);
            }
        }
    }
}

fn find_root_id(nodes: &BTreeMap<String, RuntimeNode>) -> Option<String> {
    nodes
        .values()
        .find(|node| node.parent_id.is_none())
        .map(|node| node.id.clone())
}

fn runtime_snapshot_to_dom(snapshot: &RuntimeSnapshot) -> Result<WeakDom> {
    let mut id_to_ref = HashMap::new();
    for (index, id) in snapshot.nodes.keys().enumerate() {
        id_to_ref.insert(id.clone(), Ref::some((index as u128) + 1));
    }

    let mut visiting = HashSet::new();
    let root = build_instance_builder(&snapshot.root_id, snapshot, &id_to_ref, &mut visiting)?;
    Ok(WeakDom::new(root))
}

fn build_instance_builder(
    id: &str,
    snapshot: &RuntimeSnapshot,
    id_to_ref: &HashMap<String, Ref>,
    visiting: &mut HashSet<String>,
) -> Result<InstanceBuilder> {
    if !visiting.insert(id.to_owned()) {
        bail!("cycle detected while building node '{id}'");
    }

    let node = snapshot
        .nodes
        .get(id)
        .ok_or_else(|| anyhow!("node '{id}' does not exist"))?;
    let referent = *id_to_ref
        .get(id)
        .ok_or_else(|| anyhow!("node '{id}' has no referent"))?;

    let mut builder = InstanceBuilder::new(node.class_name.as_str())
        .with_name(node.name.clone())
        .with_referent(referent);

    for (property_name, property) in &node.properties {
        if is_instance_meta_property(property_name) {
            continue;
        }

        let value = runtime_property_to_variant(node.class_name.as_str(), property_name, property, id_to_ref)
            .with_context(|| format!("node '{id}' property '{property_name}'"))?;
        builder.add_property(property_name.as_str(), value);
    }

    for child_id in &node.child_ids {
        let child = build_instance_builder(child_id, snapshot, id_to_ref, visiting)?;
        builder.add_child(child);
    }

    visiting.remove(id);
    Ok(builder)
}

fn is_instance_meta_property(name: &str) -> bool {
    matches!(
        name,
        "Name" | "ClassName" | "Parent" | "ParentId" | "ParentID" | "ChildIds"
    )
}

fn runtime_property_to_variant(
    class_name: &str,
    property_name: &str,
    property: &RuntimeProperty,
    id_to_ref: &HashMap<String, Ref>,
) -> Result<Variant> {
    let Some(ty) = property.ty.as_deref() else {
        return infer_variant(&property.value);
    };

    let normalized = normalize_type_name(ty);
    match normalized.as_str() {
        "bool" | "boolean" => Ok(Variant::Bool(bool_value(&property.value)?)),
        "string" | "protectedstring" | "tokenstring" => {
            Ok(Variant::String(string_value(&property.value)?))
        }
        "binarystring" => Ok(Variant::BinaryString(de_value(&property.value)?)),
        "sharedstring" => Ok(Variant::SharedString(de_value(&property.value)?)),
        "netassetref" => Ok(Variant::NetAssetRef(de_value(&property.value)?)),
        "float" | "float32" | "single" => Ok(Variant::Float32(f32_value(&property.value)?)),
        "double" | "float64" | "number" => Ok(Variant::Float64(f64_value(&property.value)?)),
        "int" | "int32" | "integer" => Ok(Variant::Int32(i32_value(&property.value)?)),
        "int64" | "long" => Ok(Variant::Int64(i64_value(&property.value)?)),
        "vector2" => Ok(Variant::Vector2(vector2_value(&property.value)?)),
        "vector2int16" => Ok(Variant::Vector2int16(vector2int16_value(&property.value)?)),
        "vector3" => Ok(Variant::Vector3(vector3_value(&property.value)?)),
        "vector3int16" => Ok(Variant::Vector3int16(vector3int16_value(&property.value)?)),
        "color3" => Ok(Variant::Color3(color3_value(&property.value)?)),
        "color3uint8" => Ok(Variant::Color3uint8(color3uint8_value(&property.value)?)),
        "cframe" | "coordinateframe" => Ok(Variant::CFrame(cframe_value(&property.value)?)),
        "optionalcframe" => Ok(Variant::OptionalCFrame(optional_cframe_value(
            &property.value,
        )?)),
        "udim" => Ok(Variant::UDim(udim_value(&property.value)?)),
        "udim2" => Ok(Variant::UDim2(udim2_value(&property.value)?)),
        "enum" | "token" => Ok(Variant::Enum(Enum::from_u32(u32_value(&property.value)?))),
        "enumitem" => Ok(Variant::EnumItem(enum_item_value(&property.value)?)),
        "brickcolor" => Ok(Variant::BrickColor(brick_color_value(&property.value)?)),
        "ref" | "reference" | "object" | "instance" => {
            Ok(Variant::Ref(ref_value(&property.value, id_to_ref)?))
        }
        "contentid" => Ok(Variant::ContentId(ContentId::from(string_value(
            &property.value,
        )?))),
        "content" => Ok(runtime_content_to_binary_variant(
            class_name,
            property_name,
            &property.value,
            id_to_ref,
        )?),
        "numberrange" => Ok(Variant::NumberRange(number_range_value(&property.value)?)),
        "rect" => Ok(Variant::Rect(rect_value(&property.value)?)),
        "ray" => Ok(Variant::Ray(ray_value(&property.value)?)),
        "region3" => Ok(Variant::Region3(region3_value(&property.value)?)),
        "region3int16" => Ok(Variant::Region3int16(region3int16_value(&property.value)?)),
        "numbersequence" => Ok(Variant::NumberSequence(number_sequence_value(
            &property.value,
        )?)),
        "colorsequence" => Ok(Variant::ColorSequence(color_sequence_value(
            &property.value,
        )?)),
        "axes" => Ok(Variant::Axes(axes_value(&property.value)?)),
        "faces" => Ok(Variant::Faces(faces_value(&property.value)?)),
        "tags" => Ok(Variant::Tags(de_value(&property.value)?)),
        "attributes" => Ok(Variant::Attributes(de_value(&property.value)?)),
        "font" => Ok(Variant::Font(font_value(&property.value)?)),
        "uniqueid" => Ok(Variant::UniqueId(de_value(&property.value)?)),
        "physicalproperties" => Ok(Variant::PhysicalProperties(de_value(&property.value)?)),
        "variant" => de_value(&property.value),
        "unknown" => bail!("cannot export Unknown property without losing data"),
        unsupported => {
            bail!("unsupported runtime property type '{unsupported}' for {property_name}")
        }
    }
}

fn infer_variant(value: &Value) -> Result<Variant> {
    match value {
        Value::Bool(value) => Ok(Variant::Bool(*value)),
        Value::String(value) => Ok(Variant::String(value.clone())),
        Value::Number(number) => {
            if let Some(value) = number.as_i64() {
                i32::try_from(value)
                    .map(Variant::Int32)
                    .or_else(|_| Ok(Variant::Int64(value)))
            } else {
                Ok(Variant::Float64(number.as_f64().unwrap_or_default()))
            }
        }
        _ => bail!("property is missing Type; object/array values need an explicit Type"),
    }
}

fn normalize_type_name(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !matches!(ch, ' ' | '_' | '-'))
        .flat_map(char::to_lowercase)
        .collect()
}

fn get_any<'a>(object: &'a Map<String, Value>, names: &[&str]) -> Option<&'a Value> {
    names.iter().find_map(|name| object.get(*name))
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn string_value(value: &Value) -> Result<String> {
    value_to_string(value).ok_or_else(|| anyhow!("expected string"))
}

fn bool_value(value: &Value) -> Result<bool> {
    match value {
        Value::Bool(value) => Ok(*value),
        Value::String(value) => value
            .parse::<bool>()
            .with_context(|| format!("expected bool, got '{value}'")),
        _ => bail!("expected bool"),
    }
}

fn f32_value(value: &Value) -> Result<f32> {
    Ok(f64_value(value)? as f32)
}

fn f64_value(value: &Value) -> Result<f64> {
    match value {
        Value::Number(number) => number.as_f64().ok_or_else(|| anyhow!("invalid number")),
        Value::String(value) => value
            .parse::<f64>()
            .with_context(|| format!("expected number, got '{value}'")),
        _ => bail!("expected number"),
    }
}

fn i16_value(value: &Value) -> Result<i16> {
    Ok(i64_value(value)?.try_into()?)
}

fn i32_value(value: &Value) -> Result<i32> {
    Ok(i64_value(value)?.try_into()?)
}

fn i64_value(value: &Value) -> Result<i64> {
    match value {
        Value::Number(number) => number.as_i64().ok_or_else(|| anyhow!("expected integer")),
        Value::String(value) => value
            .parse::<i64>()
            .with_context(|| format!("expected integer, got '{value}'")),
        _ => bail!("expected integer"),
    }
}

fn u8_value(value: &Value) -> Result<u8> {
    Ok(u64_value(value)?.try_into()?)
}

fn u16_value(value: &Value) -> Result<u16> {
    Ok(u64_value(value)?.try_into()?)
}

fn u32_value(value: &Value) -> Result<u32> {
    Ok(u64_value(value)?.try_into()?)
}

fn u64_value(value: &Value) -> Result<u64> {
    match value {
        Value::Number(number) => number
            .as_u64()
            .or_else(|| number.as_i64().and_then(|value| value.try_into().ok()))
            .ok_or_else(|| anyhow!("expected unsigned integer")),
        Value::String(value) => value
            .parse::<u64>()
            .with_context(|| format!("expected unsigned integer, got '{value}'")),
        _ => bail!("expected unsigned integer"),
    }
}

fn array_value(value: &Value) -> Result<&[Value]> {
    value
        .as_array()
        .map(Vec::as_slice)
        .ok_or_else(|| anyhow!("expected array"))
}

fn object_value(value: &Value) -> Result<&Map<String, Value>> {
    value.as_object().ok_or_else(|| anyhow!("expected object"))
}

fn de_value<T: DeserializeOwned>(value: &Value) -> Result<T> {
    serde_json::from_value(value.clone()).map_err(Into::into)
}

fn vector2_value(value: &Value) -> Result<Vector2> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(Vector2::new(f32_value(&values[0])?, f32_value(&values[1])?));
        }
    }

    let object = object_value(value)?;
    Ok(Vector2::new(
        f32_value(get_any(object, &["x", "X"]).ok_or_else(|| anyhow!("missing x"))?)?,
        f32_value(get_any(object, &["y", "Y"]).ok_or_else(|| anyhow!("missing y"))?)?,
    ))
}

fn vector2int16_value(value: &Value) -> Result<Vector2int16> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(Vector2int16::new(
                i16_value(&values[0])?,
                i16_value(&values[1])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Vector2int16::new(
        i16_value(get_any(object, &["x", "X"]).ok_or_else(|| anyhow!("missing x"))?)?,
        i16_value(get_any(object, &["y", "Y"]).ok_or_else(|| anyhow!("missing y"))?)?,
    ))
}

fn vector3_value(value: &Value) -> Result<Vector3> {
    if let Value::Array(values) = value {
        if values.len() >= 3 {
            return Ok(Vector3::new(
                f32_value(&values[0])?,
                f32_value(&values[1])?,
                f32_value(&values[2])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Vector3::new(
        f32_value(get_any(object, &["x", "X"]).ok_or_else(|| anyhow!("missing x"))?)?,
        f32_value(get_any(object, &["y", "Y"]).ok_or_else(|| anyhow!("missing y"))?)?,
        f32_value(get_any(object, &["z", "Z"]).ok_or_else(|| anyhow!("missing z"))?)?,
    ))
}

fn vector3int16_value(value: &Value) -> Result<Vector3int16> {
    if let Value::Array(values) = value {
        if values.len() >= 3 {
            return Ok(Vector3int16::new(
                i16_value(&values[0])?,
                i16_value(&values[1])?,
                i16_value(&values[2])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Vector3int16::new(
        i16_value(get_any(object, &["x", "X"]).ok_or_else(|| anyhow!("missing x"))?)?,
        i16_value(get_any(object, &["y", "Y"]).ok_or_else(|| anyhow!("missing y"))?)?,
        i16_value(get_any(object, &["z", "Z"]).ok_or_else(|| anyhow!("missing z"))?)?,
    ))
}

fn color3_value(value: &Value) -> Result<Color3> {
    if let Value::Array(values) = value {
        if values.len() >= 3 {
            return Ok(Color3::new(
                f32_value(&values[0])?,
                f32_value(&values[1])?,
                f32_value(&values[2])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Color3::new(
        f32_value(get_any(object, &["r", "R"]).ok_or_else(|| anyhow!("missing r"))?)?,
        f32_value(get_any(object, &["g", "G"]).ok_or_else(|| anyhow!("missing g"))?)?,
        f32_value(get_any(object, &["b", "B"]).ok_or_else(|| anyhow!("missing b"))?)?,
    ))
}

fn color3uint8_value(value: &Value) -> Result<Color3uint8> {
    if let Value::Array(values) = value {
        if values.len() >= 3 {
            return Ok(Color3uint8::new(
                u8_value(&values[0])?,
                u8_value(&values[1])?,
                u8_value(&values[2])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Color3uint8::new(
        u8_value(get_any(object, &["r", "R"]).ok_or_else(|| anyhow!("missing r"))?)?,
        u8_value(get_any(object, &["g", "G"]).ok_or_else(|| anyhow!("missing g"))?)?,
        u8_value(get_any(object, &["b", "B"]).ok_or_else(|| anyhow!("missing b"))?)?,
    ))
}

fn cframe_value(value: &Value) -> Result<CFrame> {
    if let Value::Array(values) = value {
        return cframe_from_components(values);
    }

    let object = object_value(value)?;
    if let Some(components) = get_any(object, &["components", "Components"]) {
        return cframe_from_components(array_value(components)?);
    }

    let position = get_any(object, &["position", "Position", "pos", "Pos"])
        .map(vector3_value)
        .transpose()?
        .unwrap_or_else(|| Vector3::new(0.0, 0.0, 0.0));
    let orientation = get_any(
        object,
        &["orientation", "Orientation", "rotation", "Rotation"],
    )
    .map(matrix3_value)
    .transpose()?
    .unwrap_or_else(Matrix3::identity);

    Ok(CFrame::new(position, orientation))
}

fn optional_cframe_value(value: &Value) -> Result<Option<CFrame>> {
    if value.is_null() {
        Ok(None)
    } else {
        cframe_value(value).map(Some)
    }
}

fn cframe_from_components(values: &[Value]) -> Result<CFrame> {
    match values.len() {
        12 => {
            let position = Vector3::new(
                f32_value(&values[0])?,
                f32_value(&values[1])?,
                f32_value(&values[2])?,
            );
            let orientation = matrix3_from_9_values(&values[3..12])?;
            Ok(CFrame::new(position, orientation))
        }
        9 => Ok(CFrame::new(
            Vector3::new(0.0, 0.0, 0.0),
            matrix3_from_9_values(values)?,
        )),
        _ => bail!("CFrame components must have 9 or 12 numbers"),
    }
}

fn matrix3_value(value: &Value) -> Result<Matrix3> {
    if let Value::Array(values) = value {
        if values.len() == 9 {
            return matrix3_from_9_values(values);
        }
        if values.len() == 3 {
            return Ok(Matrix3::new(
                vector3_value(&values[0])?,
                vector3_value(&values[1])?,
                vector3_value(&values[2])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Matrix3::new(
        vector3_value(get_any(object, &["x", "X"]).ok_or_else(|| anyhow!("missing x axis"))?)?,
        vector3_value(get_any(object, &["y", "Y"]).ok_or_else(|| anyhow!("missing y axis"))?)?,
        vector3_value(get_any(object, &["z", "Z"]).ok_or_else(|| anyhow!("missing z axis"))?)?,
    ))
}

fn matrix3_from_9_values(values: &[Value]) -> Result<Matrix3> {
    if values.len() != 9 {
        bail!("Matrix3 needs exactly 9 numbers");
    }

    Ok(Matrix3::new(
        Vector3::new(
            f32_value(&values[0])?,
            f32_value(&values[1])?,
            f32_value(&values[2])?,
        ),
        Vector3::new(
            f32_value(&values[3])?,
            f32_value(&values[4])?,
            f32_value(&values[5])?,
        ),
        Vector3::new(
            f32_value(&values[6])?,
            f32_value(&values[7])?,
            f32_value(&values[8])?,
        ),
    ))
}

fn udim_value(value: &Value) -> Result<UDim> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(UDim::new(f32_value(&values[0])?, i32_value(&values[1])?));
        }
    }

    let object = object_value(value)?;
    Ok(UDim::new(
        f32_value(get_any(object, &["scale", "Scale"]).ok_or_else(|| anyhow!("missing scale"))?)?,
        i32_value(
            get_any(object, &["offset", "Offset"]).ok_or_else(|| anyhow!("missing offset"))?,
        )?,
    ))
}

fn udim2_value(value: &Value) -> Result<UDim2> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(UDim2::new(udim_value(&values[0])?, udim_value(&values[1])?));
        }
    }

    let object = object_value(value)?;
    Ok(UDim2::new(
        udim_value(get_any(object, &["x", "X"]).ok_or_else(|| anyhow!("missing x"))?)?,
        udim_value(get_any(object, &["y", "Y"]).ok_or_else(|| anyhow!("missing y"))?)?,
    ))
}

fn enum_item_value(value: &Value) -> Result<EnumItem> {
    if !value.is_object() {
        return Ok(EnumItem {
            ty: String::new(),
            value: u32_value(value)?,
        });
    }

    let object = object_value(value)?;
    Ok(EnumItem {
        ty: get_any(object, &["type", "Type", "enum", "Enum"])
            .and_then(value_to_string)
            .unwrap_or_default(),
        value: u32_value(
            get_any(object, &["value", "Value"]).ok_or_else(|| anyhow!("missing enum value"))?,
        )?,
    })
}

fn brick_color_value(value: &Value) -> Result<BrickColor> {
    match value {
        Value::Number(_) => BrickColor::from_number(u16_value(value)?)
            .ok_or_else(|| anyhow!("invalid BrickColor number")),
        Value::String(name) => BrickColor::from_name(name)
            .or_else(|| name.parse::<u16>().ok().and_then(BrickColor::from_number))
            .ok_or_else(|| anyhow!("invalid BrickColor '{name}'")),
        Value::Object(object) => {
            if let Some(value) = get_any(object, &["value", "Value", "number", "Number"]) {
                return BrickColor::from_number(u16_value(value)?)
                    .ok_or_else(|| anyhow!("invalid BrickColor number"));
            }
            if let Some(name) = get_any(object, &["name", "Name"]).and_then(value_to_string) {
                return BrickColor::from_name(&name)
                    .ok_or_else(|| anyhow!("invalid BrickColor name '{name}'"));
            }
            bail!("BrickColor object needs value or name")
        }
        _ => bail!("expected BrickColor"),
    }
}

fn ref_value(value: &Value, id_to_ref: &HashMap<String, Ref>) -> Result<Ref> {
    match value {
        Value::Null => Ok(Ref::none()),
        Value::String(value) => ref_from_string(value, id_to_ref),
        Value::Object(object) => {
            if let Some(id) =
                get_any(object, &["id", "Id", "nodeId", "nodeID"]).and_then(value_to_string)
            {
                return ref_from_string(&id, id_to_ref);
            }
            if let Some(referent) =
                get_any(object, &["referent", "Referent", "ref", "Ref"]).and_then(value_to_string)
            {
                return ref_from_string(&referent, id_to_ref);
            }
            Ok(Ref::none())
        }
        _ => bail!("expected Ref"),
    }
}

fn ref_from_string(value: &str, id_to_ref: &HashMap<String, Ref>) -> Result<Ref> {
    if value.is_empty() || value == "null" {
        return Ok(Ref::none());
    }
    if let Some(referent) = id_to_ref.get(value) {
        return Ok(*referent);
    }
    Ref::from_str(value).with_context(|| format!("unknown runtime node ref '{value}'"))
}

fn runtime_content_to_binary_variant(
    class_name: &str,
    property_name: &str,
    value: &Value,
    id_to_ref: &HashMap<String, Ref>,
) -> Result<Variant> {
    if runtime_content_is_object_ref(value) {
        return Ok(Variant::Content(content_value(value, id_to_ref)?));
    }

    if content_property_requires_content_id(class_name, property_name) {
        Ok(Variant::ContentId(ContentId::from(content_id_string(value)?)))
    } else {
        Ok(Variant::Content(content_value(value, id_to_ref)?))
    }
}

fn content_property_requires_content_id(class_name: &str, property_name: &str) -> bool {
    let class_name = normalize_type_name(class_name);
    let property_name = normalize_type_name(property_name);

    matches!(
        (class_name.as_str(), property_name.as_str()),
        ("animation", "animationid")
            | ("beam", "texture")
            | ("decal", "texture")
            | ("filemesh", "meshid")
            | ("filemesh", "textureid")
            | ("imagebutton", "image")
            | ("imagelabel", "image")
            | ("meshpart", "meshid")
            | ("meshpart", "textureid")
            | ("pants", "pantstemplate")
            | ("particleemitter", "texture")
            | ("shirt", "shirttemplate")
            | ("sky", "moontextureid")
            | ("sky", "skyboxbk")
            | ("sky", "skyboxdn")
            | ("sky", "skyboxft")
            | ("sky", "skyboxlf")
            | ("sky", "skyboxrt")
            | ("sky", "skyboxup")
            | ("sky", "suntextureid")
            | ("sound", "soundid")
            | ("specialmesh", "meshid")
            | ("specialmesh", "textureid")
            | ("trail", "texture")
            | ("videoframe", "video")
    )
}

fn runtime_content_is_object_ref(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };

    get_any(object, &["kind", "Kind", "type", "Type"])
        .and_then(value_to_string)
        .map(|kind| matches!(kind.as_str(), "Object" | "object" | "Ref" | "ref"))
        .unwrap_or(false)
}

fn content_id_string(value: &Value) -> Result<String> {
    match value {
        Value::Null => Ok(String::new()),
        Value::String(uri) => Ok(uri.clone()),
        Value::Object(object) => {
            let kind = get_any(object, &["kind", "Kind", "type", "Type"])
                .and_then(value_to_string)
                .unwrap_or_else(|| "Uri".to_owned());

            match kind.as_str() {
                "None" | "none" => Ok(String::new()),
                "Uri" | "URI" | "uri" => Ok(get_any(object, &["uri", "Uri", "url", "Url", "value", "Value"])
                    .and_then(value_to_string)
                    .unwrap_or_default()),
                "Object" | "object" | "Ref" | "ref" => Ok(String::new()),
                _ => Ok(get_any(object, &["uri", "Uri", "url", "Url", "value", "Value"])
                    .and_then(value_to_string)
                    .unwrap_or_default()),
            }
        }
        _ => bail!("expected Content"),
    }
}
fn content_value(value: &Value, id_to_ref: &HashMap<String, Ref>) -> Result<Content> {
    match value {
        Value::Null => Ok(Content::none()),
        Value::String(uri) => Ok(Content::from_uri(uri)),
        Value::Object(object) => {
            let kind = get_any(object, &["kind", "Kind", "type", "Type"])
                .and_then(value_to_string)
                .unwrap_or_else(|| "Uri".to_owned());
            match kind.as_str() {
                "None" | "none" => Ok(Content::none()),
                "Uri" | "URI" | "uri" => Ok(Content::from_uri(
                    get_any(object, &["uri", "Uri", "url", "Url"])
                        .and_then(value_to_string)
                        .unwrap_or_default(),
                )),
                "Object" | "object" | "Ref" | "ref" => {
                    let ref_source = get_any(object, &["ref", "Ref", "id", "Id"])
                        .ok_or_else(|| anyhow!("Content Object needs ref"))?;
                    Ok(Content::from_referent(ref_value(ref_source, id_to_ref)?))
                }
                other => bail!("unsupported Content kind '{other}'"),
            }
        }
        _ => bail!("expected Content"),
    }
}

fn number_range_value(value: &Value) -> Result<NumberRange> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(NumberRange::new(
                f32_value(&values[0])?,
                f32_value(&values[1])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(NumberRange::new(
        f32_value(get_any(object, &["min", "Min"]).ok_or_else(|| anyhow!("missing min"))?)?,
        f32_value(get_any(object, &["max", "Max"]).ok_or_else(|| anyhow!("missing max"))?)?,
    ))
}

fn rect_value(value: &Value) -> Result<Rect> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(Rect::new(
                vector2_value(&values[0])?,
                vector2_value(&values[1])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Rect::new(
        vector2_value(get_any(object, &["min", "Min"]).ok_or_else(|| anyhow!("missing min"))?)?,
        vector2_value(get_any(object, &["max", "Max"]).ok_or_else(|| anyhow!("missing max"))?)?,
    ))
}

fn ray_value(value: &Value) -> Result<Ray> {
    let object = object_value(value)?;
    Ok(Ray::new(
        vector3_value(
            get_any(object, &["origin", "Origin"]).ok_or_else(|| anyhow!("missing origin"))?,
        )?,
        vector3_value(
            get_any(object, &["direction", "Direction"])
                .ok_or_else(|| anyhow!("missing direction"))?,
        )?,
    ))
}

fn region3_value(value: &Value) -> Result<Region3> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(Region3::new(
                vector3_value(&values[0])?,
                vector3_value(&values[1])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Region3::new(
        vector3_value(get_any(object, &["min", "Min"]).ok_or_else(|| anyhow!("missing min"))?)?,
        vector3_value(get_any(object, &["max", "Max"]).ok_or_else(|| anyhow!("missing max"))?)?,
    ))
}

fn region3int16_value(value: &Value) -> Result<Region3int16> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(Region3int16::new(
                vector3int16_value(&values[0])?,
                vector3int16_value(&values[1])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(Region3int16::new(
        vector3int16_value(
            get_any(object, &["min", "Min"]).ok_or_else(|| anyhow!("missing min"))?,
        )?,
        vector3int16_value(
            get_any(object, &["max", "Max"]).ok_or_else(|| anyhow!("missing max"))?,
        )?,
    ))
}

fn number_sequence_value(value: &Value) -> Result<NumberSequence> {
    let keypoints = sequence_items(value)?;
    Ok(NumberSequence {
        keypoints: keypoints
            .iter()
            .map(number_sequence_keypoint_value)
            .collect::<Result<Vec<_>>>()?,
    })
}

fn number_sequence_keypoint_value(value: &Value) -> Result<NumberSequenceKeypoint> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(NumberSequenceKeypoint::new(
                f32_value(&values[0])?,
                f32_value(&values[1])?,
                values.get(2).map(f32_value).transpose()?.unwrap_or(0.0),
            ));
        }
    }

    let object = object_value(value)?;
    Ok(NumberSequenceKeypoint::new(
        f32_value(get_any(object, &["time", "Time"]).ok_or_else(|| anyhow!("missing time"))?)?,
        f32_value(get_any(object, &["value", "Value"]).ok_or_else(|| anyhow!("missing value"))?)?,
        get_any(object, &["envelope", "Envelope"])
            .map(f32_value)
            .transpose()?
            .unwrap_or(0.0),
    ))
}

fn color_sequence_value(value: &Value) -> Result<ColorSequence> {
    let keypoints = sequence_items(value)?;
    Ok(ColorSequence {
        keypoints: keypoints
            .iter()
            .map(color_sequence_keypoint_value)
            .collect::<Result<Vec<_>>>()?,
    })
}

fn color_sequence_keypoint_value(value: &Value) -> Result<ColorSequenceKeypoint> {
    if let Value::Array(values) = value {
        if values.len() >= 2 {
            return Ok(ColorSequenceKeypoint::new(
                f32_value(&values[0])?,
                color3_value(&values[1])?,
            ));
        }
    }

    let object = object_value(value)?;
    Ok(ColorSequenceKeypoint::new(
        f32_value(get_any(object, &["time", "Time"]).ok_or_else(|| anyhow!("missing time"))?)?,
        color3_value(
            get_any(object, &["color", "Color"]).ok_or_else(|| anyhow!("missing color"))?,
        )?,
    ))
}

fn sequence_items(value: &Value) -> Result<&[Value]> {
    if let Value::Array(values) = value {
        return Ok(values);
    }

    let object = object_value(value)?;
    array_value(
        get_any(object, &["keypoints", "Keypoints"])
            .ok_or_else(|| anyhow!("sequence needs keypoints"))?,
    )
}

fn axes_value(value: &Value) -> Result<Axes> {
    if matches!(value, Value::Number(_)) {
        return Axes::from_bits(u8_value(value)?).ok_or_else(|| anyhow!("invalid Axes bitset"));
    }
    de_value(value)
}

fn faces_value(value: &Value) -> Result<Faces> {
    if matches!(value, Value::Number(_)) {
        return Faces::from_bits(u8_value(value)?).ok_or_else(|| anyhow!("invalid Faces bitset"));
    }
    de_value(value)
}

fn font_value(value: &Value) -> Result<Font> {
    if let Ok(font) = de_value::<Font>(value) {
        return Ok(font);
    }

    let object = object_value(value)?;
    let family = get_any(object, &["family", "Family"])
        .and_then(value_to_string)
        .unwrap_or_else(|| "rbxasset://fonts/families/SourceSansPro.json".to_owned());
    let weight = get_any(object, &["weight", "Weight"])
        .map(font_weight_value)
        .transpose()?
        .unwrap_or_default();
    let style = get_any(object, &["style", "Style"])
        .map(font_style_value)
        .transpose()?
        .unwrap_or_default();
    let cached_face_id = get_any(object, &["cachedFaceId", "CachedFaceId", "cached_face_id"])
        .and_then(value_to_string);

    Ok(Font {
        family,
        weight,
        style,
        cached_face_id,
    })
}

fn font_weight_value(value: &Value) -> Result<FontWeight> {
    if matches!(value, Value::Number(_)) {
        return FontWeight::from_u16(u16_value(value)?)
            .ok_or_else(|| anyhow!("invalid FontWeight"));
    }

    let text = string_value(value)?;
    match text.as_str() {
        "Thin" => Ok(FontWeight::Thin),
        "ExtraLight" => Ok(FontWeight::ExtraLight),
        "Light" => Ok(FontWeight::Light),
        "Regular" => Ok(FontWeight::Regular),
        "Medium" => Ok(FontWeight::Medium),
        "SemiBold" => Ok(FontWeight::SemiBold),
        "Bold" => Ok(FontWeight::Bold),
        "ExtraBold" => Ok(FontWeight::ExtraBold),
        "Heavy" => Ok(FontWeight::Heavy),
        _ => text
            .parse::<u16>()
            .ok()
            .and_then(FontWeight::from_u16)
            .ok_or_else(|| anyhow!("invalid FontWeight '{text}'")),
    }
}

fn font_style_value(value: &Value) -> Result<FontStyle> {
    if matches!(value, Value::Number(_)) {
        return FontStyle::from_u8(u8_value(value)?).ok_or_else(|| anyhow!("invalid FontStyle"));
    }

    let text = string_value(value)?;
    match text.as_str() {
        "Normal" => Ok(FontStyle::Normal),
        "Italic" => Ok(FontStyle::Italic),
        _ => text
            .parse::<u8>()
            .ok()
            .and_then(FontStyle::from_u8)
            .ok_or_else(|| anyhow!("invalid FontStyle '{text}'")),
    }
}
