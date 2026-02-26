-- Users Table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Store hash from bcrypt
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_username_key UNIQUE (username)
);

-- Polls Table (Renamed from Elections)
CREATE TABLE polls (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    voting_mechanism VARCHAR(50) NOT NULL DEFAULT 'multiple-choice',
    rating_scale JSONB NULL,
    allow_comments BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT elections_pkey PRIMARY KEY (id),
    CONSTRAINT "CHK_2fc824c98fd180e98e8d186baa" CHECK (end_time > start_time)
);

-- Options Table (Choices within a Poll)
CREATE TABLE options (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    poll_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT options_pkey PRIMARY KEY (id),
    CONSTRAINT "FK_4e0972d6db48eb74f59164ebd61" FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

-- Votes Table
CREATE TABLE votes (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    poll_id UUID NOT NULL,
    option_id UUID NULL,
    rating_value INTEGER NULL,
    ranked_option_ids UUID[] NULL,
    text_response TEXT NULL,
    selected_option_ids UUID[] NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT votes_pkey PRIMARY KEY (id),
    CONSTRAINT unique_user_poll_vote UNIQUE (user_id, poll_id),
    CONSTRAINT "FK_27be2cab62274f6876ad6a31641" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04" FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE RESTRICT,
    CONSTRAINT "FK_b947c0f7a7b8ba58186971818f3" FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE RESTRICT
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_polls_start_time ON polls(start_time);
CREATE INDEX idx_polls_end_time ON polls(end_time);
CREATE INDEX idx_polls_voting_mechanism ON polls(voting_mechanism);
CREATE INDEX idx_options_poll_id ON options(poll_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_option_id ON votes(option_id);

-- Optional: Trigger function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to tables
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_elections
BEFORE UPDATE ON polls
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_options
BEFORE UPDATE ON options
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();