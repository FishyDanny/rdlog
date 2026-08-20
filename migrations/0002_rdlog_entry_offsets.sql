-- Records the UTC offset the recorder's clock was observing when the work occurred.
-- Rows written before this migration stay NULL and keep verifying under the v1
-- canonical entry hash; new rows carry an offset and use the v2 preimage.
ALTER TABLE rdlog_entries ADD COLUMN occurred_at_offset_minutes INTEGER
  CHECK (occurred_at_offset_minutes IS NULL
    OR (occurred_at_offset_minutes BETWEEN -840 AND 840));

INSERT OR IGNORE INTO _migrations (name, applied_at)
VALUES ('0002_rdlog_entry_offsets.sql', datetime('now'));
