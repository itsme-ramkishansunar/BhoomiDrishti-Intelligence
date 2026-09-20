-- U52 precise GIS mapping metadata + cached geocoding results.
ALTER TABLE projects ADD COLUMN location_precision TEXT NOT NULL DEFAULT 'UNRESOLVED';
ALTER TABLE projects ADD COLUMN location_source TEXT;
ALTER TABLE projects ADD COLUMN location_label TEXT;
ALTER TABLE projects ADD COLUMN location_osm_type TEXT;
ALTER TABLE projects ADD COLUMN location_osm_id TEXT;
ALTER TABLE projects ADD COLUMN location_bbox_json TEXT;
ALTER TABLE projects ADD COLUMN location_resolved_at TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_location_precision ON projects(location_precision);
CREATE INDEX IF NOT EXISTS idx_projects_location_coords ON projects(latitude,longitude);

CREATE TABLE IF NOT EXISTS map_geocode_cache (
  query_key TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  result_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_map_geocode_cache_expiry ON map_geocode_cache(expires_at);
