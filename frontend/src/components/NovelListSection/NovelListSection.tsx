import React from 'react';
import SectionTitle from '../SectionTitle/SectionTitle';
import NovelCard from '../NovelCard/NovelCard';
import { Novel } from '../../services/homepageService';
import styles from './NovelListSection.module.css';

interface NovelListSectionProps {
  title: string;
  novels: Novel[];
  onNovelClick?: (novel: Novel) => void;
}

const NovelListSection: React.FC<NovelListSectionProps> = ({ title, novels, onNovelClick }) => (
  <section className={styles.section}>
    <SectionTitle>{title}</SectionTitle>
    <div className={styles.list}>
      {novels.map(novel => (
        <NovelCard 
          key={novel.id} 
          {...novel} 
          onClick={() => onNovelClick?.(novel)}
        />
      ))}
    </div>
  </section>
);

export default NovelListSection; 