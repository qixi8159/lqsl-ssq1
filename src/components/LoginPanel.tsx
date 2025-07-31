import React from 'react';
import { User } from 'lucide-react';

interface LoginPanelProps {
  userIdInput: string;
  setUserIdInput: (value: string) => void;
  adminPasswordInput: string;
  setAdminPasswordInput: (value: string) => void;
  loading: boolean;
  loginError: string;
  handleUserLogin: () => void;
  handleAdminLogin: () => void;
}

const LoginPanel: React.FC<LoginPanelProps> = React.memo(({
  userIdInput,
  setUserIdInput,
  adminPasswordInput,
  setAdminPasswordInput,
  loading,
  loginError,
  handleUserLogin,
  handleAdminLogin,
}) => {
  return (
    <div className="panel">
      <div className="panel-body">
        <div className="welcome-lines">
          <div className="welcome-line-1">扫雷游戏</div>
          <div className="welcome-line-2">输入您的游戏ID开始</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="user-id-input">
            <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            游戏ID (4位数字)
          </label>
          <input
            type="text"
            id="user-id-input"
            placeholder="例如：1234"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyPress={(e) => e.key === 'Enter' && handleUserLogin()}
            maxLength={4}
            disabled={loading}
          />
        </div>
        
        <button onClick={handleUserLogin} className="btn" disabled={loading}>
          {loading ? '验证中...' : '开始游戏'}
        </button>
        
        <div className="login-separator">
          管理员登录
        </div>
        
        <div className="form-group">
          <label htmlFor="admin-password-input">管理员密码</label>
          <input
            type="password"
            id="admin-password-input"
            placeholder="输入管理员密码"
            value={adminPasswordInput}
            onChange={(e) => setAdminPasswordInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
            disabled={loading}
          />
        </div>
        
        <button onClick={handleAdminLogin} className="btn" disabled={loading}>
          管理员登录
        </button>
        
        {loginError && <div className="error-message">{loginError}</div>}
      </div>
    </div>
  );
});

LoginPanel.displayName = 'LoginPanel';

export default LoginPanel;