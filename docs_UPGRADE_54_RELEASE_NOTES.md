# U54 Release Notes

## Persistent repository
- One shared persistent data root outside application release folders.
- Relative legacy backend/data settings cannot redirect a shared release into its own folder. Custom storage requires explicit opt-in.
- Database opens retry transient Windows locks and startup performs quick-check + write-transaction preflight before starting services.
- Legacy migration uses SQLite online backup; source releases are not modified.
- New release installer does not create a second project repository when the shared store already exists.

## GIS integrity
- RiskMap never uses schematic map_x/map_y coordinates.
- Parcel/project GeoJSON geometry takes spatial precedence.
- Project point, geocoded place, demo district centroid, and unresolved states are visually distinct.
- Demo synthetic coordinates are corrected only for records explicitly sourced from DEMO_DISTRICT_CENTROID.
- Unresolved locations are never plotted.
- Search results show returned district/state and mismatch confirmation is required before saving a conflicting geocoder result.
- OpenStreetMap/Nominatim remains user-triggered place search; cadastral precision requires authorized geometry.

## Operations
- Existing AI, evidence, workflow, temporal, prediction, alert, action, feedback, replay and governance stacks remain part of the same database.
- Docker is optional. It uses a persistent named volume; Windows local mode remains the default development/demo path.
