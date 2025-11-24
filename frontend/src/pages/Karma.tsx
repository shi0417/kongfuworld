import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Karma: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 重定向到用户中心页面的Karma选项卡
    navigate('/user-center?tab=karma', { replace: true });
  }, [navigate]);

  return null; // 不渲染任何内容，因为会立即重定向
};

export default Karma;
