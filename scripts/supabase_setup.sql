-- Maya Groom Pro Backup Table
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yhobisgwofxhauriskpu/sql/new

-- Create the maya_backups table
CREATE TABLE IF NOT EXISTS maya_backups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    backup_at TIMESTAMPTZ DEFAULT NOW(),
    count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_maya_backups_user_id ON maya_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_maya_backups_collection ON maya_backups(collection);
CREATE INDEX IF NOT EXISTS idx_maya_backups_backup_at ON maya_backups(backup_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE maya_backups ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since we're using service key from backend)
-- For production, you'd want more restrictive policies
CREATE POLICY "Allow all operations" ON maya_backups
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON maya_backups TO anon;
GRANT ALL ON maya_backups TO authenticated;
