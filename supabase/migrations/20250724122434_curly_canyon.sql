-- Drop existing trigger and function if they exist to prevent conflicts
DROP TRIGGER IF EXISTS trigger_cleanup_expired ON public.game_sessions;
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();

-- Drop the table if it exists to ensure a clean slate
DROP TABLE IF EXISTS public.game_sessions CASCADE;

-- Create the game_sessions table
CREATE TABLE public.game_sessions (
    id text NOT NULL,
    session_token uuid NOT NULL DEFAULT gen_random_uuid(),
    status text NOT NULL DEFAULT 'active'::text,
    browser_fingerprint text NULL,
    ip_address inet NULL,
    user_agent text NULL,
    last_heartbeat timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL DEFAULT (now() + '01:00:00'::interval),
    game_result text NULL,
    amount numeric(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT game_sessions_session_token_key UNIQUE (session_token),
    CONSTRAINT game_sessions_game_result_check CHECK ((game_result = ANY (ARRAY['cashed_out'::text, 'busted'::text]))),
    CONSTRAINT game_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text])))
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow all operations for public role
CREATE POLICY "Allow all operations on game_sessions" ON public.game_sessions FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_expires_at ON public.game_sessions USING btree (expires_at);
CREATE INDEX idx_last_heartbeat ON public.game_sessions USING btree (last_heartbeat);
CREATE INDEX idx_session_token ON public.game_sessions USING btree (session_token);
CREATE INDEX idx_status ON public.game_sessions USING btree (status);

-- Unique index for active sessions (ensures only one active session per ID)
CREATE UNIQUE INDEX idx_unique_active_session ON public.game_sessions USING btree (id) WHERE (status = 'active'::text);