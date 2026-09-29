# PRD: Project Editor Screen (Map View)

## 1. Overview
The Project Editor is the core workspace of GeoNexo. It provides an interactive map interface where users can visualize, add, and edit geographic features across multiple layers. It combines a spatial viewer with a structural management panel.

## 2. User Goals
- Visualize geographic features on a map.
- Create, move, or delete features (Points, LineStrings, Polygons).
- Toggle layer visibility and manage layer properties.
- Edit feature attributes (name, metadata).
- Save changes to the project.

## 3. UI Layout (Desktop)
```
+---------------------------------------------------+
| Header (Project Name, Save/Undo/Redo, User Profile) |
+---------------------------------------------------+
|  Layer Panel (Left) | Map Canvas (Center/Right)     |
|  ┌────────────────┐|                               |
|  │ Search Layers  │|  [ 🔍 ] [ ➕ Feature ] [ 🗑️ ]   |
|  │ ────────────────│|                               |
|  │ [X] Roads      │|                               |
|  │ [X] Lakes      │|                               |
|  │ [ ] Borders     │|       (Interactive Map)       |
|  │                │|                               |
|  │                │|                               |
|  │                │|                               |
|  │                │|                               |
|  └────────────────┘|                               |
+---------------------------------------------------+
|  Bottom Bar: Coordinates (X, Y), Zoom Level, Status  |
+---------------------------------------------------+
```

* **Layer Panel**: A collapsible sidebar on the left for managing project layers.
* **Map Canvas**: Full-screen interactive map (e.g., using Leaflet or OpenLayers).
* **Tool Overlay**: Floating buttons on the map for feature creation (`➕`) and selection/deletion (`🗑️`).
* **Bottom Bar**: Real-time telemetry showing current mouse coordinates and map state.

## 4. Components & Behaviors
| Element | Type | Behavior |
|----------|------|----------|
| Layer Toggle | Checkbox | Toggles visibility of all features in that layer on the map. |
| Layer Item | List Item | Clicking a layer selects it as the "active" layer for feature creation. |
| Map Canvas | Interactive Map | Supports pan, zoom, and click events. Clicking a feature selects it and opens the Attribute Panel. |
| Add Feature | Button | Activates the drawing tool for the selected geometry type (Point/Line/Polygon). |
| Feature Tool | Drawing Tool | Allows user to click map to place coordinates. Finalizes feature on "Enter" or double-click. |
| Attribute Panel| Floating Modal | Appears when a feature is selected; allows editing name and metadata. |
| Save Button | Button | Sends `PUT /projects/:id` to persist all current map changes. |

## 5. Data Interactions
* **Load Project**: On entry, calls `GET /api/v1/projects/:id` and `GET /api/v1/layers?projectId=:id` to populate the map and layer panel.
* **Create Feature**: Calls `POST /api/v1/features` with `{projectId, layerId, geometry, name}`. Returns `INVALID_GEOMETRY` if coordinates are malformed.
* **Save Project**: Persists state to the server. |

## 6. Loading & Error States
* **Map Loading**: Shows a loading spinner until base tiles and project features are fetched.
* **Geometry Error**: If a feature fails validation, a toast notification appears: "Invalid Geometry: [Details]".
* **Connectivity Loss**: Warning banner at the top: "Offline - changes are not being saved".

## 7. Accessibility
* High-contrast modes for map features.
* Keyboard shortcuts for tools (e.g., `P` for Point, `L` for Line, `Esc` to cancel drawing).
* ARIA labels for map controls and layer toggles.

---