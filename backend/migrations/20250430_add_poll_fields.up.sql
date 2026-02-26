-- Add rating_scale and allow_comments columns to the polls table

ALTER TABLE public.polls
  ADD COLUMN rating_scale jsonb NULL,
  ADD COLUMN allow_comments boolean NOT NULL DEFAULT false; 