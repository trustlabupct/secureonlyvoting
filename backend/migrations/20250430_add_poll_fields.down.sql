-- Remove rating_scale and allow_comments columns from the polls table

ALTER TABLE public.polls
  DROP COLUMN rating_scale,
  DROP COLUMN allow_comments; 