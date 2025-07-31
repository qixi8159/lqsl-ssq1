/*
  # 创建游戏会话管理表

  1. 新表结构
    - `game_sessions` 表用于管理游戏会话
      - `id` (text, 主键) - 游戏ID
      - `session_token` (uuid, 唯一) - 会话令牌
      - `status` (text) - 会话状态: active, completed, expired
      - `browser_fingerprint` (text) - 浏览器指纹
      - `ip_address` (inet) - IP地址
      - `user_agent` (text) - 用户代理
      - `last_heartbeat` (timestamptz) - 最后心跳时间
      - `created_at` (timestamptz) - 创建时间
      - `expires_at` (timestamptz) - 过期时间
      - `game_result` (text) - 游戏结果
      - `amount` (decimal) - 奖金金额

  2. 安全机制
    - 唯一约束确保一个游戏ID只能有一个活跃会话
    - 自动过期清理机制
    - 浏览器指纹验证

  3. 性能优化
    - 添加必要的索引
    - 自动清理过期会话的触发器
*/

-- 创建游戏会话表
CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    session_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    browser_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
    game_result TEXT CHECK (game_result IN ('cashed_out', 'busted')),
    amount DECIMAL(10,2) DEFAULT 0
);

-- 唯一约束确保一个游戏ID只能有一个活跃会话
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session 
ON game_sessions (id) 
WHERE status = 'active';

-- 性能优化索引
CREATE INDEX IF NOT EXISTS idx_session_token ON game_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_last_heartbeat ON game_sessions (last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_expires_at ON game_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_status ON game_sessions (status);

-- 启用行级安全
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- 允许所有操作的策略（因为这是游戏应用，需要公开访问）
CREATE POLICY "Allow all operations on game_sessions"
  ON game_sessions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 自动清理过期会话的函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE game_sessions 
    SET status = 'expired' 
    WHERE expires_at < NOW() AND status = 'active';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_cleanup_expired'
    ) THEN
        CREATE TRIGGER trigger_cleanup_expired
            AFTER INSERT OR UPDATE ON game_sessions
            FOR EACH STATEMENT
            EXECUTE FUNCTION cleanup_expired_sessions();
    END IF;
END $$;

-- 批量清理过期会话的存储过程
CREATE OR REPLACE FUNCTION batch_cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE game_sessions 
    SET status = 'expired' 
    WHERE expires_at < NOW() - INTERVAL '1 hour' 
    AND status = 'active';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;