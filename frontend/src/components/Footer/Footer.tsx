import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer: React.FC = () => (
  <footer className={styles.footer}>
    <div>Copyright © KongFuWorld 2026</div>
    <div>
      <Link to="/legal/terms" className={styles.link}>Terms of Service</Link>
      {' · '}
      <Link to="/legal/privacy" className={styles.link}>Privacy Policy</Link>
      {' · '}
      <Link to="/legal/cookies" className={styles.link}>Cookie Policy</Link>
    </div>
  </footer>
);

export default Footer; 