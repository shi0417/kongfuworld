import React from 'react';
import styles from './TrendingNovels.module.css';

const novels = [
  { id: 1, title: '雪中悍刀行', cover: 'https://picsum.photos/120/160?4', author: '烽火戏诸侯' },
  { id: 2, title: '庆余年', cover: 'https://picsum.photos/120/160?5', author: '猫腻' },
  { id: 3, title: '大奉打更人', cover: 'https://picsum.photos/120/160?6', author: '卖报小郎君' },
];

const TrendingNovels: React.FC = () => (
  <section className={styles.section}>
    <h2>趋势小说</h2>
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

export default TrendingNovels; 