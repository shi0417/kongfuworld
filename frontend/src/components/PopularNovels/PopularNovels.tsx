import React from 'react';
import styles from './PopularNovels.module.css';

const novels = [
  { id: 1, title: '斗破苍穹', cover: 'https://picsum.photos/120/160?1', author: '天蚕土豆' },
  { id: 2, title: '全职高手', cover: 'https://picsum.photos/120/160?2', author: '蝴蝶蓝' },
  { id: 3, title: '凡人修仙传', cover: 'https://picsum.photos/120/160?3', author: '忘语' },
];

const PopularNovels: React.FC = () => (
  <section className={styles.section}>
    <h2>热门小说</h2>
    <div className={styles.list}>
      {novels.map(novel => (
        <div key={novel.id} className={styles.novel}>
          <img src={novel.cover} alt={novel.title} />
          <div className={styles.info}>
            <div className={styles.title}>{novel.title}</div>
            <div className={styles.author}>{novel.author}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default PopularNovels; 