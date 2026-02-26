-- Remove columns for different vote types and comments from the votes table

ALTER TABLE public.votes
  DROP COLUMN rating_value,
  DROP COLUMN ranked_option_ids,
  DROP COLUMN text_response,
  DROP COLUMN comment; 