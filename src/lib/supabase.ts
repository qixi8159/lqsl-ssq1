import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  console.error('Required variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 数据库操作函数
export interface GameId {
  id: string;
  status: 'unused' | 'in_progress' | 'cashed_out' | 'busted';
  amount: number;
  created_at: string;
}

// 新的会话接口
export interface GameSession {
  id: string;
  session_token: string;
  status: 'active' | 'completed' | 'expired';
  browser_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  last_heartbeat: string;
  created_at: string;
  expires_at: string;
  game_result?: 'cashed_out' | 'busted';
  amount: number;
}

// 会话创建结果接口
export interface SessionCreationResult {
  success: boolean;
  sessionToken?: string;
  error?: string;
}

// 会话验证结果接口
export interface SessionValidationResult {
  valid: boolean;
  session?: GameSession;
  error?: string;
}

// 生成浏览器指纹
export function generateBrowserFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.platform,
    navigator.cookieEnabled.toString()
  ];
  
  // 使用简单哈希避免暴露敏感信息
  return btoa(components.join('|')).slice(0, 32);
}

// 生成安全的会话令牌
export function generateSecureSessionToken(): string {
  // 使用crypto.randomUUID()生成UUID
  return crypto.randomUUID();
}

// 创建游戏会话
export async function createGameSession(
  gameId: string, 
  browserFingerprint: string,
  ipAddress?: string,
  userAgent?: string
): Promise<SessionCreationResult> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return { success: false, error: 'Supabase未初始化' };
  }

  const sessionToken = generateSecureSessionToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期
  
  try {
    // 首先检查是否已有活跃会话
    const { data: existingSession, error: checkError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', gameId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('检查现有会话错误:', checkError);
      return { success: false, error: '系统错误，请重试' };
    }
    
    // 如果已有活跃会话且不是同一浏览器，拒绝创建新会话
    if (existingSession && existingSession.browser_fingerprint !== browserFingerprint) {
      return { 
        success: false, 
        error: '此ID正在其他浏览器中使用，请稍后再试' 
      };
    }
    
    // 检查ID是否存在
    const { data: existingRecord, error: existError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();
    
    if (existError || !existingRecord) {
      return { success: false, error: '游戏ID不存在' };
    }
    
    // 检查游戏是否已完成
    if (existingRecord.game_result) {
      const statusText = existingRecord.game_result === 'cashed_out' 
        ? `已兑奖 ${existingRecord.amount} 元` 
        : '已踩雷';
      return { success: false, error: `此ID已被使用 - ${statusText}` };
    }
    
    // 更新会话为活跃状态
    const { data, error } = await supabase
      .from('game_sessions')
      .update({
        session_token: sessionToken,
        status: 'active',
        browser_fingerprint: browserFingerprint,
        ip_address: ipAddress,
        user_agent: userAgent,
        last_heartbeat: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        game_result: null,
        amount: 0
      })
      .eq('id', gameId)
      .select()
      .single();
    
    if (error) {
      console.error('更新会话错误:', error);
      return { success: false, error: '创建会话失败' };
    }
    
    return { 
      success: true, 
      sessionToken: sessionToken 
    };
    
  } catch (error) {
    console.error('创建会话失败:', error);
    return { 
      success: false, 
      error: '系统错误，请重试' 
    };
  }
}

// 验证会话
export async function validateSession(
  gameId: string, 
  sessionToken: string
): Promise<SessionValidationResult> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return { valid: false, error: 'Supabase未初始化' };
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', gameId)
      .eq('session_token', sessionToken)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) {
      return { 
        valid: false, 
        error: '会话无效或已过期，请重新获取游戏ID' 
      };
    }
    
    // 更新心跳时间
    await supabase
      .from('game_sessions')
      .update({ 
        last_heartbeat: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
      .eq('session_token', sessionToken);
    
    return { 
      valid: true, 
      session: data 
    };
    
  } catch (error) {
    console.error('验证会话失败:', error);
    return { 
      valid: false, 
      error: '验证失败' 
    };
  }
}

// 更新会话心跳
export async function updateSessionHeartbeat(sessionToken: string): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('game_sessions')
      .update({ 
        last_heartbeat: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
      .eq('session_token', sessionToken)
      .eq('status', 'active');
    
    return !error;
  } catch (error) {
    console.error('更新心跳失败:', error);
    return false;
  }
}

// 完成游戏会话
export async function completeGameSession(
  sessionToken: string,
  gameResult: 'cashed_out' | 'busted',
  amount: number
): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('game_sessions')
      .update({
        status: 'completed',
        game_result: gameResult,
        amount: amount
      })
      .eq('session_token', sessionToken);
    
    return !error;
  } catch (error) {
    console.error('完成游戏会话失败:', error);
    return false;
  }
}

// 检查会话状态
export async function checkSessionStatus(sessionToken: string): Promise<GameSession | null> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('检查会话状态失败:', error);
    return null;
  }
}

// 获取所有游戏ID
export async function getAllGameIds(): Promise<GameId[]> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return [];
  }

  // 从新的会话表获取数据，并转换为旧格式以保持兼容性
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching game IDs:', error.message);
    if (error.message.includes('Failed to fetch')) {
      console.error('Connection failed. Please check your Supabase URL and API key.');
    }
    return [];
  }
  
  // 转换为旧的GameId格式
  return (data || []).map(session => ({
    id: session.id,
    status: session.game_result === 'cashed_out' ? 'cashed_out' : 
            session.game_result === 'busted' ? 'busted' : 
            session.status === 'active' ? 'in_progress' : 'unused',
    amount: session.amount,
    created_at: session.created_at
  }));
}

// 创建新的游戏ID
export async function createGameId(id: string): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return false;
  }

  // 创建一个未使用的记录
  const now = new Date();
  const pastTime = new Date(now.getTime() - 1000); // 1秒前，确保过期
  
  const { error } = await supabase
    .from('game_sessions')
    .insert([{ 
      id, 
      session_token: generateSecureSessionToken(),
      status: 'expired',
      amount: 0,
      expires_at: pastTime.toISOString(),
      last_heartbeat: pastTime.toISOString()
    }]);
  
  if (error) {
    console.error('Error creating game ID:', error.message);
    return false;
  }
  
  return true;
}

// 检查ID是否存在（保持兼容性）
export async function checkIdExists(id: string): Promise<GameId | null> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return null;
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    return null;
  }
  
  if (!data) {
    return null;
  }
  
  // 转换为旧格式
  return {
    id: data.id,
    status: data.game_result === 'cashed_out' ? 'cashed_out' : 
            data.game_result === 'busted' ? 'busted' : 
            data.status === 'active' ? 'in_progress' : 'unused',
    amount: data.amount,
    created_at: data.created_at
  };
}

// 删除游戏ID
export async function deleteGameId(id: string): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check environment variables.');
    return false;
  }

  const { error } = await supabase
    .from('game_sessions')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting game ID:', error);
    return false;
  }
  
  return true;
}