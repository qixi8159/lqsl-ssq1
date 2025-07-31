import { useEffect, useRef } from 'react';
import { updateSessionHeartbeat, checkSessionStatus } from '../lib/supabase';

interface SessionHeartbeatProps {
  sessionToken: string | null;
  onSessionInvalid: () => void;
}

export const SessionHeartbeat: React.FC<SessionHeartbeatProps> = ({
  sessionToken,
  onSessionInvalid
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionToken) {
      // 清理定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 开始心跳检测
    const startHeartbeat = () => {
      intervalRef.current = setInterval(async () => {
        try {
          // 发送心跳
          const heartbeatSuccess = await updateSessionHeartbeat(sessionToken);
          
          if (!heartbeatSuccess) {
            console.error('心跳更新失败');
            onSessionInvalid();
            return;
          }

          // 检查会话状态
          const sessionStatus = await checkSessionStatus(sessionToken);
          
          if (!sessionStatus || sessionStatus.status !== 'active') {
            console.log('会话已失效或被其他地方操作');
            onSessionInvalid();
            return;
          }

          // 检查是否过期
          const now = new Date();
          const expiresAt = new Date(sessionStatus.expires_at);
          
          if (now >= expiresAt) {
            console.log('会话已过期');
            onSessionInvalid();
            return;
          }

        } catch (error) {
          console.error('心跳检测失败:', error);
          onSessionInvalid();
        }
      }, 30000); // 每30秒检查一次
    };

    startHeartbeat();

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionToken, onSessionInvalid]);

  // 页面可见性变化时的处理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时停止心跳
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (sessionToken) {
        // 页面重新可见时恢复心跳
        if (!intervalRef.current) {
          const startHeartbeat = () => {
            intervalRef.current = setInterval(async () => {
              try {
                const heartbeatSuccess = await updateSessionHeartbeat(sessionToken);
                if (!heartbeatSuccess) {
                  onSessionInvalid();
                  return;
                }

                const sessionStatus = await checkSessionStatus(sessionToken);
                if (!sessionStatus || sessionStatus.status !== 'active') {
                  onSessionInvalid();
                  return;
                }

                const now = new Date();
                const expiresAt = new Date(sessionStatus.expires_at);
                if (now >= expiresAt) {
                  onSessionInvalid();
                  return;
                }
              } catch (error) {
                console.error('心跳检测失败:', error);
                onSessionInvalid();
              }
            }, 30000);
          };
          startHeartbeat();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionToken, onSessionInvalid]);

  return null; // 这是一个逻辑组件，不渲染任何UI
};