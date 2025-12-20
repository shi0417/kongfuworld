import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import ChapterReader from './pages/ChapterReader';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import NovelUpload from './pages/NovelUpload';
import NovelEdit from './pages/NovelEdit';
import PaymentSuccess from './pages/PaymentSuccess';
// import PaymentError from './pages/PaymentError'; // 暂时取消错误页面功能
import Karma from './pages/Karma';
import Champion from './pages/Champion';
import UserCenter from './pages/UserCenter';
import DailyRewards from './pages/DailyRewards';
import Bookmarks from './pages/Bookmarks';
import EmailVerification from './pages/EmailVerification';
import WritersZone from './pages/WritersZone';
import Inbox from './pages/WritersZone/Inbox';
import InboxV2 from './pages/WritersZone/InboxV2';
import CreateNovel from './pages/CreateNovel';
import NovelManage from './pages/NovelManage';
import ChapterWriter from './pages/ChapterWriter';
import AdminPanel from './pages/AdminPanel';
import AdminInboxV2 from './pages/AdminPanel/InboxV2';
import AdminRegister from './pages/AdminRegister';
import Series from './pages/Series';
import Forum from './pages/Forum';
import Resources from './pages/Resources';
import Updates from './pages/Updates';
import AnnouncementsPage from './pages/AnnouncementsPage';
import NewsDetail from './pages/NewsDetail';
import NewsList from './pages/NewsList';
import LegalDocumentPage from './pages/LegalDocumentPage';
import ContractPolicyPage from './pages/ContractPolicyPage';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '804347936135-h7t7lvcfobidto0vma40jfq30f6jgp08.apps.googleusercontent.com';
  
  return (
    <ThemeProvider>
      <LanguageProvider>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book/:id" element={<BookDetail />} />
        <Route path="/novel/:novelId/chapter/:chapterId" element={<ChapterReader />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/upload" element={<NovelUpload />} />
        <Route path="/edit" element={<NovelEdit />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        {/* <Route path="/payment/error" element={<PaymentError />} /> */} {/* 暂时取消错误页面功能 */}
        <Route path="/karma" element={<Karma />} />
        <Route path="/champion" element={<Champion />} />
        <Route path="/user-center" element={<UserCenter />} />
        <Route path="/daily-rewards" element={<DailyRewards />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/email-verification" element={<EmailVerification />} />
        <Route path="/writers-zone" element={<WritersZone />} />
        <Route path="/writers-zone/inbox" element={<Inbox />} />
        <Route path="/writers-zone/inbox-v2" element={<InboxV2 />} />
        <Route path="/create-novel" element={<CreateNovel />} />
        <Route path="/novel-manage/:novelId" element={<NovelManage />} />
        <Route path="/novel-upload" element={<ChapterWriter />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/inbox-v2" element={<AdminInboxV2 />} />
        <Route path="/admin-register" element={<AdminRegister />} />
        {/* Home V2 相关占位页：避免 NavBar 404，并支撑 View All 跳转 */}
        <Route path="/series" element={<Series />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/legal/:docKey" element={<LegalDocumentPage />} />
        <Route path="/contract-policy" element={<ContractPolicyPage />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
