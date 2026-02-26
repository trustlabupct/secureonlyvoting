-- Revert option_id to be non-nullable in the votes table
-- WARNING: This will fail if any rows have NULL in option_id.
-- Manual data cleanup might be required before running this down migration.
ALTER TABLE votes
ALTER COLUMN option_id SET NOT NULL; 