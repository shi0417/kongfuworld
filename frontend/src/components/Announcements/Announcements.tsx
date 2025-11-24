import React from 'react';
import styles from './Announcements.module.css';

const announcements = [
  '欢迎来到武侠世界！',
  '新书上线，快来阅读！',
  '参与活动赢取奖励！',
];

const Announcements: React.FC = () => (
  <div className={styles.announcements}>
    <div>{announcements.join(' | ')}</div>
  </div>
);

export default Announcements; 