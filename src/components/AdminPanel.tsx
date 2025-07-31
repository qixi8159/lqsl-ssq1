import React from 'react';
import { Trash2, Plus, Copy, ExternalLink } from 'lucide-react';
import { GameId } from '../lib/supabase';

interface AdminPanelProps {
  gameIds: GameId[];
  loading: boolean;
  copySuccess: string;
  handleGenerateId: () => void;
  copyToClipboard: (text: string, id: string) => void;
  handleDeleteId: (id: string) => void;
  setViewMode: (mode: 'login' | 'admin' | 'game') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = React.memo(({
  gameIds,
  loading,
  copySuccess,
  handleGenerateId,
  copyToClipboard,
  handleDeleteId,
  setViewMode,
}) => {
  return (
    <div className="panel admin-panel">
      <h2 className="panel-title">管理员面板</h2>
      
      <div className="form-group">
        <button onClick={handleGenerateId} className="btn btn-primary" disabled={loading}>
          <Plus size={16} style={{ marginRight: '8px' }} />
          <span>{loading ? '生成中...' : '生成专属游戏链接'}</span>
        </button>
      </div>
      
      {copySuccess && (
        <div style={{
          backgroundColor: 'var(--accent-color)',
          color: 'white',
          padding: '10px',
          borderRadius: 'var(--border-radius)',
          textAlign: 'center',
          marginBottom: '15px',
          fontSize: '0.9rem'
        }}>
          {copySuccess}
        </div>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ marginBottom: '15px', color: 'var(--text-muted-color)' }}>
          已生成的链接 ({gameIds.length})
        </h3>
        
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted-color)', padding: '20px' }}>
            加载中...
          </p>
        ) : gameIds.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted-color)', padding: '20px' }}>
            暂无生成的链接
          </p>
        ) : (
          <ul className="admin-id-list">
            {gameIds.map(gameId => {
              const gameLink = `${window.location.origin}${window.location.pathname}?id=${gameId.id}`;
              
              let statusHTML = <span className="id-status unused">未使用</span>;

              if (gameId.status === 'cashed_out') {
                statusHTML = (
                  <>
                    <span className="id-status cashed_out">已兑奖</span>
                    <span className="id-amount">{gameId.amount.toFixed(2)}元</span>
                  </>
                );
              } else if (gameId.status === 'busted') {
                statusHTML = <span className="id-status busted">已踩雷</span>;
              }

              return (
                <li key={gameId.id}>
                  <div className="id-details">
                    <span className="admin-id-code">ID: {gameId.id}</span>
                    {statusHTML}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="admin-delete-btn"
                      onClick={() => copyToClipboard(gameLink, gameId.id)}
                      title="复制游戏链接"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      className="admin-delete-btn"
                      onClick={() => window.open(gameLink, '_blank')}
                      title="查看游戏状态"
                      style={{ color: 'var(--gem-color)' }}
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button
                      className="admin-delete-btn"
                      onClick={() => handleDeleteId(gameId.id)}
                      title="删除ID"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <button onClick={() => setViewMode('login')} className="btn btn-danger" style={{ marginTop: '20px' }}>
        <span>退出管理</span>
      </button>
    </div>
  );
});

AdminPanel.displayName = 'AdminPanel';

export default AdminPanel;