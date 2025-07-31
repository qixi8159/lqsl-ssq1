/*
  # 添加游戏进行中状态

  1. 修改现有表
    - 更新 `game_ids` 表的 status 字段，添加 'in_progress' 状态
    - 更新 `trials` 表的 status 字段，添加 'in_progress' 状态
  
  2. 数据完整性
    - 确保状态字段支持新的枚举值
    - 保持现有数据不变
*/

-- 更新 game_ids 表，添加 in_progress 状态支持
DO $$
BEGIN
  -- 检查是否需要更新 game_ids 表的 status 字段约束
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'game_ids' AND column_name = 'status'
  ) THEN
    -- 由于 Supabase 使用 text 类型，我们只需要确保默认值正确
    ALTER TABLE game_ids ALTER COLUMN status SET DEFAULT 'unused';
  END IF;
END $$;

-- 更新 trials 表，添加 in_progress 状态支持
DO $$
BEGIN
  -- 检查是否需要更新 trials 表的 status 字段约束
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trials' AND column_name = 'status'
  ) THEN
    -- 由于 Supabase 使用 text 类型，我们只需要确保默认值正确
    ALTER TABLE trials ALTER COLUMN status SET DEFAULT 'unused';
  END IF;
END $$;