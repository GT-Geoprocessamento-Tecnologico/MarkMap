# PRD: Layer Details Screen

## 1. Overview
The Layer Details screen displays metadata and configuration options for a specific layer within a project. It is accessed from the Layer Panel or the layer list on the map via the context menu.

## 2. User Goals
- View the layer’s name, visibility, and order.
- Adjust the visibility mask (style, opacity).
- Rename or delete the layer.
- Export the layer as GeoJSON.

## 3. UI Layout (Desktop)
```
+---------------------------------------------------+
| Header: Layer "Roads"  (back arrow, Save, Delete)|
+---------------------------------------------------+
|  General Settings                                  |
|  ┌─────────────────────────────────────┐          |
|  │ Layer Name: [ \"Roads\" ]         │          |
|  │ Visibility: [X] (checkbox)          │          |
|  │ Opacity: [ 80% ] (slider)          │          |
|  │ Color:   #ff0000 (color picker)   │          |
|  └─────────────────────────────────────┘          |
|                                                   |
|  Data Preview (small table of first 10 features)   |
|  Export   [GeoJSON]   [KML]   [Delete]             |
+---------------------------------------------------+
```

* Header provides navigation back to Layer Panel.
* Settings panel allows editing of available properties.
* Data preview gives a quick glance of the contained features.

## 4. Components & Behaviors
| Element | Type | Interaction |
|---------|------|-------------|
| Layer Name Input | TextField | Editing updates state in memory; Save commits to `/layers/:id`.
| Visibility Checkbox | Checkbox | Toggles layer visibility; `GET` shows/hides the layer on the map immediately.
| Opacity Slider | RangeInput | Adjusts `opacity` property; applies to map tiles.
| Color Picker | ColorInput | Changes rendering style of the layer.
| Export Buttons | Buttons | Trigger `/api/v1/layers/:id/export?type=geojson` etc.
| Delete Button | Button | Asks for confirmation; on success calls `DELETE /api/v1/layers/:id`.

## 5. Validation & Error Handling
* `Layer Name` must be non‑empty; otherwise the Save button becomes disabled.
* `Opacity` must be between 0 and 100.
* Server returns `400 VALIDATION_ERROR` for invalid fields, `500 INTERNAL_ERROR` for server issues.

## 6. Accessibility
* All inputs have corresponding `<label>` tags.
* Delete action is protected by a confirmation dialog.
* Color picker supports chroma wheel with ARIA labelling.

---