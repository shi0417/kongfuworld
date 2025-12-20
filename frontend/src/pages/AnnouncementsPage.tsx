import React from 'react';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';

const AnnouncementsPage: React.FC = () => {
  return (
    <div>
      <NavBar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', color: '#fff' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Announcements</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)' }}>
          Announcements page WIP. (This page is added to support "View All" from the homepage and will be expanded later.)
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default AnnouncementsPage;


