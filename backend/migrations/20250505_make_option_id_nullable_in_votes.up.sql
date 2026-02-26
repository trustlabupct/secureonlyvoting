-- Make option_id nullable in the votes table
ALTER TABLE votes
ALTER COLUMN option_id DROP NOT NULL; 