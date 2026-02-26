-- Add columns for different vote types and comments to the votes table

ALTER TABLE public.votes
  ADD COLUMN rating_value integer NULL,
  ADD COLUMN ranked_option_ids uuid[] NULL, -- Use uuid array for ranking
  ADD COLUMN text_response text NULL,
  ADD COLUMN comment text NULL; 