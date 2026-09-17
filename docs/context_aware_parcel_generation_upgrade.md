# Context-Aware Parcel Generation Upgrade

## 1. Objective

Upgrade the existing backend parcel seed-generation system so that it produces realistic, cadastral-style parcel geometries instead of purely random polygons.

The current system already:

- Generates randomly sized/shaped parcel polygons.
- Maintains common/shared boundaries between neighboring parcels.
- Stores generated parcels in the database.
- Serves those parcels through the existing backend/API.
- Renders the database geometries directly in the MapLibre frontend.
- Uses OpenStreetMap data.
- Uses MapLibre for map rendering.
- Has Google Earth Engine API/integration available for spatial/remote-sensing data.

**Do not rebuild this architecture.**

The main change should be to improve the parcel-generation algorithm in the backend seed pipeline.

---

## 2. Existing Architecture

Preserve the existing flow:

```text
Backend Seed Script
        |
        v
Parcel Generation
        |
        v
Database / PostGIS
        |
        v
Backend API
        |
        v
MapLibre Frontend
        |
        v
Parcel Rendering
```

The frontend must continue rendering parcel geometry retrieved from the database.

Do not move parcel generation to the frontend.

Do not replace MapLibre.

Do not replace OpenStreetMap.

Do not replace the existing database unless there is a technical requirement to extend it.

---

## 3. Current Problem

The current seed script generates random parcel geometries with shared/common boundaries.

The shared-boundary behavior is useful and must be preserved.

However, the generated geometry is spatially blind.

Currently, parcels can:

- Ignore road geometry.
- Ignore building footprints.
- Ignore land-use context.
- Have arbitrary orientations.
- Produce unrealistic subdivisions.
- Cut through areas occupied by buildings.
- Look like mathematical/random polygons rather than realistic land parcels.

The current result should be upgraded from:

```text
Random polygons
+
Random sizes
+
Shared boundaries
```

to:

```text
Road-aware blocks
+
Building constraints
+
Land-use/context awareness
+
Natural-feature constraints
+
Controlled randomness
+
Shared-boundary topology
```

---

# 4. Target Result

The target visual result should resemble a realistic cadastral/land-parcel map similar to the provided reference image.

The reference should be treated as a visual and spatial design reference only.

Do not reproduce the image literally.

Desired characteristics:

- Irregular parcel polygons.
- Different parcel sizes.
- Different parcel shapes.
- Shared boundaries.
- Road-aligned parcel boundaries.
- Natural subdivision patterns.
- Smaller parcels in dense/developed areas.
- Larger parcels in agricultural/open areas.
- Parcel IDs inside polygons.
- Buildings clearly visible.
- Roads clearly visible.
- Basemap/satellite imagery visible underneath.

The result should not resemble a uniform grid.

---

# 5. Core Design Principle

Do not remove the existing controlled-random parcel generation.

Instead, transform it into a:

> **Context-Aware Random Parcel Generator**

Randomness should remain, but it must operate within geographic constraints.

Conceptually:

```text
                 OSM
          +---------------+
          |               |
        Roads          Buildings
          |               |
          +-------+-------+
                  |
                  v
           Spatial Context
                  |
        +---------+---------+
        |         |         |
      Blocks   Constraints  Land Use
        |         |         |
        +---------+---------+
                  |
                  v
       Context-Aware Random
          Parcel Generator
                  |
                  v
        Shared Boundary /
        Topology Validation
                  |
                  v
               PostGIS
                  |
                  v
              MapLibre
```

---

# 6. Inspect Existing Implementation First

Before modifying code, inspect the current codebase.

Identify:

- Existing parcel seed script.
- Parcel-generation functions.
- Random parcel size logic.
- Random polygon/splitting logic.
- Shared-boundary implementation.
- Parcel database schema.
- Geometry column type.
- Geometry SRID.
- Existing road data.
- Existing building data.
- Existing OSM integration.
- Existing Google Earth Engine integration.
- Backend API returning parcel geometry.
- MapLibre parcel layer.
- Parcel selection/highlighting logic.
- Parcel numbering logic.

Do not immediately create a second independent parcel-generation system.

Modify and extend the existing implementation wherever practical.

Preserve existing API contracts and database relationships unless changes are genuinely necessary.

---

# 7. Preserve Shared Boundaries

The existing shared-boundary behavior is a core requirement.

If Parcel A and Parcel B share a boundary, both polygons must use the same geometric boundary.

Avoid independently generating adjacent edges.

The result must not contain:

- Gaps.
- Overlaps.
- Slightly offset duplicate boundaries.
- Floating-point slivers.
- Inconsistent neighboring edges.

Use topology-preserving subdivision.

Conceptually:

```text
        Parcel A
   +--------------+
   |              |
   |              |
   |              |
   +--------------+ Parcel B
                  |
                  |
```

The common edge must be identical.

This requirement is more important than producing visually complicated polygons.

---

# 8. Road-Aware Parcel Generation

Use available OpenStreetMap road geometry as a major spatial constraint and orientation reference.

The generator should:

1. Obtain road geometries for the seed area.
2. Classify roads by importance where possible.
3. Identify major roads and local roads.
4. Use roads to identify logical land blocks.
5. Generate parcels primarily inside those blocks.
6. Prefer parcel boundaries aligned with nearby road orientations.
7. Prevent parcels from crossing major roads.
8. Terminate parcel boundaries naturally at roads.

Roads should influence parcel structure.

Do not simply buffer roads and treat the remaining area as parcels.

The objective is:

```text
Road Network
      |
      v
Logical Blocks
      |
      v
Parcel Subdivision
```

rather than:

```text
Study Area
      |
      v
Random polygons
```

---

# 9. Block Extraction

Introduce a logical block-generation stage before individual parcel generation.

Conceptually:

```text
Study Area
    |
    v
Road Network
    |
    v
Road-aware Blocks
    |
    v
Parcel Subdivision
```

A block represents a region bounded or strongly influenced by roads and other meaningful spatial features.

Parcel generation should happen inside the block rather than across the entire study area without regard to roads.

Blocks should support:

- road orientation
- parcel frontage
- contextual parcel sizing
- building constraints
- natural feature constraints

---

# 10. Building-Aware Constraints

Use available OpenStreetMap building footprints.

Buildings are spatial constraints, **not automatic parcel boundaries**.

Do not assume:

```text
1 Building = 1 Parcel
```

Instead:

```text
             PARCEL
+-----------------------------+
|                             |
|       +-----------+         |
|       |  BUILDING |         |
|       +-----------+         |
|                             |
+-----------------------------+
```

The parcel generator must avoid placing a parcel boundary through a building footprint.

For every proposed subdivision:

- Check intersections with building footprints.
- Reject or adjust subdivision lines that cross buildings.
- Keep buildings completely inside a parcel wherever the generated data permits.
- Maintain reasonable surrounding parcel space.
- Allow multiple buildings inside one parcel.
- Allow parcels without buildings.

Building geometry should constrain parcel generation without becoming the sole source of parcel geometry.

---

# 11. Building Density

Building density should influence parcel fragmentation.

Example:

```text
High Building Density
        |
        v
Smaller / More Fragmented Parcels
```

and:

```text
Low Building Density
        |
        v
Larger Parcels
```

For agricultural/open regions:

```text
Open / Agricultural
        |
        v
Larger / Less Fragmented Parcels
```

For dense settlements:

```text
Dense Settlement
        |
        v
Smaller / More Irregular Parcels
```

Do not make every parcel identical.

---

# 12. Context-Aware Randomness

Replace purely uniform randomness with constrained randomness.

Instead of:

```text
parcel_size = random()
```

use a conceptually weighted approach such as:

```text
parcel_size =
    base_size
    * density_factor
    * land_use_factor
    * road_access_factor
    * random_variation
```

The exact formula should be selected after inspecting the existing generator.

Randomness should still create variation.

Do not eliminate randomness completely.

The goal is:

> Random within geographic rules.

---

# 13. Land-Use Context

Use available OSM land-use information where possible.

Potential categories:

- Residential.
- Commercial.
- Industrial.
- Agricultural/farmland.
- Forest.
- Recreation.
- Mixed/open land.

Land-use context should influence parcel size and fragmentation.

Suggested behavior:

| Context | Expected Parcel Pattern |
|---|---|
| Dense residential | Small, fragmented parcels |
| Low-density residential | Medium parcels |
| Agricultural | Large parcels |
| Industrial | Larger, more regular parcels |
| Developing/mixed | Medium and irregular parcels |
| Open land | Larger parcels |

Do not invent land-use information when no reliable data exists.

If land-use data is unavailable, fall back to road density, building density, and controlled randomness.

---

# 14. Google Earth Engine Integration

Use the existing Google Earth Engine integration where it provides useful physical context.

Potential information includes:

- Satellite imagery.
- Built-up area.
- Land-cover classification.
- Vegetation.
- Water.
- Terrain/elevation.
- Development/change information.

GEE should provide spatial context rather than authoritative cadastral boundaries.

Important:

Do **not** implement:

```text
Satellite Image
      |
      v
AI guesses ownership boundary
      |
      v
Official cadastral parcel
```

Instead:

```text
Satellite / Remote Sensing
      |
      v
Physical Context
      |
      v
Derived Parcel Generation / Validation
```

Unless authoritative cadastral geometry exists, generated parcels must be treated as derived/simulated geometry.

---

# 15. Natural Features

Where reliable spatial data exists, consider:

- Rivers.
- Streams.
- Canals.
- Lakes.
- Reservoirs.
- Major terrain boundaries.
- Other meaningful physical features.

Use these as spatial constraints where appropriate.

Avoid unnecessarily fragmenting parcels because of insignificant mapped features.

---

# 16. Parcel Shape Variation

Generated parcels should contain realistic variation.

Allow:

- Rectangular parcels.
- Elongated parcels.
- Trapezoidal parcels.
- Irregular polygons.
- Narrow parcels.
- Large agricultural polygons.
- Road-following edges.
- Slightly curved boundaries where appropriate.

Do not make every parcel extremely irregular simply for visual effect.

The target is realistic variation.

---

# 17. Road Frontage

Where appropriate, parcels should have access/frontage toward roads.

Avoid generating large numbers of inaccessible parcels when the spatial context suggests road access.

Road hierarchy should influence frontage:

### Major roads

Prefer fewer direct access points.

### Local roads

Allow more parcel frontage.

Do not create artificial roads just to improve parcel appearance.

---

# 18. Topology and Geometry Validation

Every generated parcel must be validated.

Check for:

- Valid polygon geometry.
- Self-intersections.
- Overlap with neighboring parcels.
- Gaps.
- Sliver polygons.
- Duplicate boundaries.
- Invalid area.
- Incorrect road intersections.
- Building intersections.
- Excessive fragmentation.

Repair geometry when safely possible.

Reject and regenerate geometry when it cannot be safely repaired.

Use PostGIS/spatial operations already available in the project.

---

# 19. Parcel Continuity

The complete study area should form a coherent parcel network.

Avoid:

- Random disconnected islands.
- Unexplained holes.
- Overlapping parcels.
- Gaps between parcels.
- Tiny sliver polygons.
- Abrupt parcel-size changes without spatial context.

The output should visually resemble a continuous cadastral subdivision.

---

# 20. Parcel Numbering

Preserve the existing parcel-numbering mechanism if one exists.

Each parcel must have a unique identifier.

Parcel IDs should be displayed inside the parcel where possible.

Label placement should:

- Use an interior point/appropriate centroid.
- Avoid obvious building overlap.
- Avoid neighboring label collisions where possible.
- Scale appropriately with zoom.
- Hide or reduce labels at low zoom levels when necessary.

Do not break existing parcel-selection behavior.

---

# 21. Database

Continue storing generated parcel geometry in the existing database.

The database remains the source of truth for frontend parcel geometry.

Do not generate parcels in the frontend.

If useful, add metadata such as:

```text
source
generation_method
confidence
generation_version
```

Example:

```text
source = "derived"
generation_method = "road_building_context"
confidence = 0.78
```

Only modify the schema if necessary and maintain compatibility with the existing application.

---

# 22. Frontend and MapLibre

Do not create a second parcel-generation system in the frontend.

The frontend should continue to:

```text
Backend API
      |
      v
Database Geometry
      |
      v
GeoJSON
      |
      v
MapLibre
```

MapLibre remains responsible for visualization.

The parcel styling should be improved only where necessary.

Desired appearance:

- Clear parcel boundaries.
- Subtle parcel fills.
- Visible parcel IDs.
- Roads visible.
- Buildings visible.
- Basemap/satellite imagery visible.
- Selected parcel clearly highlighted.

Avoid large opaque polygons covering the map.

---

# 23. Layer Order

Use a logical layer order such as:

```text
Basemap
    |
    v
Road Network
    |
    v
Parcel Fill
    |
    v
Parcel Boundaries
    |
    v
Building Footprints
    |
    v
Parcel Labels
    |
    v
Selected Parcel / Highlight
```

Ensure buildings remain visually distinguishable from parcel fills.

---

# 24. Performance

Parcel generation happens during database seeding.

Therefore:

- Prioritize geometry correctness over real-time generation.
- Avoid expensive repeated external API calls.
- Cache/reuse OSM data where possible.
- Cache/reuse GEE-derived data where appropriate.
- Perform spatial processing during seeding.
- Store the resulting geometry in the database.
- Do not regenerate parcels whenever a user opens the map.

The frontend should only retrieve and render stored geometry.

---

# 25. Data Source Hierarchy

If multiple parcel data sources are available, use this priority:

```text
1. Authoritative cadastral geometry
          |
          v
2. Existing stored parcel geometry
          |
          v
3. Road-aware derived geometry
          |
          v
4. Building-aware derived geometry
          |
          v
5. Land-use/context-aware geometry
          |
          v
6. Existing controlled-random fallback
```

If authoritative cadastral data is not available, generated geometry must be treated as derived/simulated geometry.

---

# 26. Fallback Behavior

The system must continue working when OSM or GEE data is incomplete.

For example:

If roads are available but buildings are not:

```text
Road-aware generation
```

If buildings are available but land-use is not:

```text
Road + building-aware generation
```

If external data is unavailable:

```text
Existing controlled-random generator
```

Do not allow missing optional spatial data to crash the entire seed process.

---

# 27. Preserve Existing Random Generator

The existing random generator should remain available as a fallback.

Do not delete it until the new approach is proven stable.

The intended evolution is:

```text
CURRENT

Random Polygon Generator
        +
Shared Boundaries
```

to:

```text
TARGET

Context-Aware Random Generator
        +
Shared Boundaries
        +
Road Constraints
        +
Block Structure
        +
Building Constraints
        +
Land-Use Context
        +
Natural Features
```

---

# 28. Do Not Overengineer

Do not introduce machine learning merely for the sake of using AI.

Do not introduce an AI model to hallucinate cadastral boundaries.

Do not rebuild the backend.

Do not replace the database.

Do not replace MapLibre.

Do not replace OpenStreetMap.

Do not remove the existing shared-boundary system.

Do not move parcel generation to the frontend.

Upgrade the current seed-generation algorithm.

---

# 29. Implementation Strategy

Implement incrementally.

### Phase 1: Understand existing generator

Inspect and document:

- Current polygon generation.
- Shared-boundary logic.
- Random sizing.
- Database insertion.

### Phase 2: Add road awareness

Introduce:

- Road loading.
- Road classification.
- Block extraction.
- Road orientation.
- Road constraints.

### Phase 3: Add building constraints

Introduce:

- Building footprint loading.
- Intersection checks.
- Subdivision rejection/adjustment.

### Phase 4: Add contextual sizing

Introduce:

- Building density.
- Road density.
- Land-use context.
- Controlled random variation.

### Phase 5: Add natural features/GEE context

Use only where data is available and useful.

### Phase 6: Validate topology

Add:

- Geometry validation.
- Shared-boundary validation.
- Gap/overlap detection.
- Sliver detection.
- Regeneration/repair.

### Phase 7: Seed and verify

Run the actual seed process and confirm that the generated geometry is inserted into the existing database.

### Phase 8: Frontend verification

Open the existing MapLibre frontend and confirm that it is rendering the newly generated database geometry.

---

# 30. Critical End-to-End Verification

Do not consider the task complete merely because new generator functions have been created.

Verify the entire chain:

```text
New Generator
      |
      v
Actual Seed Script
      |
      v
Database
      |
      v
Existing Backend API
      |
      v
Existing MapLibre Frontend
      |
      v
NEW Parcel Geometry Visible
```

The new generator must actually be called by the seed pipeline.

The generated geometry must actually be inserted into the database.

The existing API must actually return the new geometry.

The frontend must actually render the new geometry.

---

# 31. Acceptance Criteria

The implementation is successful when:

- [ ] Existing seed architecture remains intact.
- [ ] Existing shared-boundary logic is preserved.
- [ ] Random parcel sizing remains.
- [ ] Parcel generation becomes road-aware.
- [ ] Logical blocks are considered before parcel subdivision.
- [ ] Buildings act as spatial constraints.
- [ ] Parcel boundaries do not intentionally cut through buildings.
- [ ] Building footprints remain separate from parcel geometry.
- [ ] Parcel sizes respond to spatial context.
- [ ] Dense areas can produce smaller parcels.
- [ ] Open/agricultural areas can produce larger parcels.
- [ ] Parcel shapes have realistic variation.
- [ ] Roads influence parcel orientation.
- [ ] Major roads prevent inappropriate parcel crossing.
- [ ] Natural features can act as constraints where appropriate.
- [ ] OSM remains part of the spatial data pipeline.
- [ ] GEE can provide physical context where useful.
- [ ] Geometry remains topologically valid.
- [ ] Adjacent parcels share exact boundaries.
- [ ] Gaps and overlaps are minimized/eliminated.
- [ ] Parcel IDs continue to work.
- [ ] Parcel selection continues to work.
- [ ] MapLibre continues to render parcels.
- [ ] No frontend parcel-generation logic is introduced.
- [ ] Existing APIs are preserved where possible.
- [ ] Missing external data does not crash the seed process.
- [ ] The old random-grid-like appearance is substantially reduced.
- [ ] The final map visually resembles a cadastral parcel network.
- [ ] The actual frontend displays the newly seeded geometry.

---

# 32. Final Target Architecture

The final architecture should remain lightweight and compatible with the current system:

```text
                         DATA SOURCES
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
            OSM              GEE        Cadastral Data
       Roads/Buildings   Remote Sensing     (if available)
             |                |                |
             +----------------+----------------+
                              |
                              v
                    Spatial Seed Pipeline
                              |
                +-------------+-------------+
                |             |             |
                v             v             v
             Blocks      Buildings      Context
                |             |             |
                +-------------+-------------+
                              |
                              v
                Context-Aware Random
                   Parcel Generator
                              |
                              v
                   Topology Validation
                              |
                              v
                         PostGIS
                              |
                              v
                       Backend API
                              |
                              v
                          GeoJSON
                              |
                              v
                         MapLibre
                              |
                              v
                    Cadastral-Style Map
```

The objective is not to create legally authoritative cadastral boundaries from random generation.

The objective is to create a **realistic, spatially constrained derived parcel network** using the existing backend seed system, while keeping the architecture ready for authoritative cadastral data when it becomes available.
