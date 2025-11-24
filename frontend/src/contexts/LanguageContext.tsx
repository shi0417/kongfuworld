import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译数据
const translations = {
  en: {
    // Header
    'header.title': 'Writers\' Center',
    'header.writerExchange': 'Writer Exchange',
    'header.contractPolicy': 'Contract Policy',
    'header.messages': 'Messages',
    
    // Navigation
    'nav.home': 'Home',
    'nav.workManagement': 'Work Management',
    'nav.novel': 'Novel',
    'nav.shortStory': 'Short Story',
    'nav.script': 'Script',
    'nav.interactionManagement': 'Interaction Management',
    'nav.commentManagement': 'Comment Management',
    'nav.readerCorrections': 'Reader Corrections',
    'nav.workData': 'Work Data',
    'nav.incomeManagement': 'Income Management',
    'nav.learningExchange': 'Learning & Exchange',
    'nav.writerAcademy': 'Writer Academy',
    'nav.leaveManagement': 'Leave Management',
    'nav.personalInfo': 'Personal Information',
    'nav.myContracts': 'My Contracts',
    'nav.myPosts': 'My Posts',
    
    // Main Content
    'greeting': 'Good morning',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening': 'Good evening',
    'stats.works': 'Works',
    'stats.daysJoined': 'Days Joined',
    'stats.income': 'Cumulative Income',
    'stats.wordCount': 'Cumulative Word Count',
    'works.noWorks': 'You currently have no works',
    'works.createFirst': 'Go create your first work!',
    'works.createNovel': 'Create New Novel',
    'works.more': 'More >',
    'calendar.title': 'Update Calendar',
    'calendar.rules': 'Statistical Rules',
    'calendar.applyLeave': 'Apply for Leave',
    'calendar.updated': 'Updated in',
    'calendar.today': 'Today',
    'calendar.notUpdated': 'Not Updated',
    'announcements.title': 'Official Announcements',
    'announcements.more': 'More >',
    'contests.title': 'Writing Contests',
    'courses.title': 'Recommended Courses',
    'topics.title': 'Trending Topics',
    
    // Buttons
    'btn.viewNow': 'View Now',
    'btn.create': 'Create',
  },
  zh: {
    // Header
    'header.title': '作家中心',
    'header.writerExchange': '作家交流区',
    'header.contractPolicy': '签约政策',
    'header.messages': '消息',
    
    // Navigation
    'nav.home': '专区首页',
    'nav.workManagement': '作品管理',
    'nav.novel': '小说',
    'nav.shortStory': '短故事',
    'nav.script': '剧本',
    'nav.interactionManagement': '互动管理',
    'nav.commentManagement': '评论管理',
    'nav.readerCorrections': '读者纠错',
    'nav.workData': '作品数据',
    'nav.incomeManagement': '收入管理',
    'nav.learningExchange': '学习交流',
    'nav.writerAcademy': '作家学院',
    'nav.leaveManagement': '请假管理',
    'nav.personalInfo': '个人信息',
    'nav.myContracts': '我的合同',
    'nav.myPosts': '我的帖子',
    
    // Main Content
    'greeting': '上午好',
    'greeting.afternoon': '下午好',
    'greeting.evening': '晚上好',
    'stats.works': '作品数量',
    'stats.daysJoined': '入驻天数',
    'stats.income': '累计收入',
    'stats.wordCount': '累计字数',
    'works.noWorks': '你目前还没有作品',
    'works.createFirst': '快去创建第一本作品吧!',
    'works.createNovel': '新建小说',
    'works.more': '更多>',
    'calendar.title': '更新日历',
    'calendar.rules': '统计规则说明',
    'calendar.applyLeave': '申请休假',
    'calendar.updated': '已更新',
    'calendar.today': '今',
    'calendar.notUpdated': '未更新',
    'announcements.title': '官方动态',
    'announcements.more': '更多>',
    'contests.title': '有奖征文',
    'courses.title': '推荐课程',
    'topics.title': '热议话题',
    
    // Buttons
    'btn.viewNow': '立即查看',
    'btn.create': '创建',
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language;
    return saved || 'zh';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

