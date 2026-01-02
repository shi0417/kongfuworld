import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import ApiService from '../services/ApiService';
import { getApiBaseUrl } from '../config';
import { AuthorSidebar, useAuthorSidebarState } from '../components/AuthorCenter';
import styles from './CreateNovel.module.css';

interface Genre {
  id: number;
  name: string;
  chinese_name: string;
}

interface Language {
  id: number;
  language: string;
}

const CreateNovel: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const { expandedMenus, toggleMenu } = useAuthorSidebarState();

  // Form state
  const [title, setTitle] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [protagonists, setProtagonists] = useState<string[]>(['']);
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus'>('ongoing');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Data loading state
  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login?redirect=/create-novel');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // Load genres and languages
  useEffect(() => {
    const loadData = async () => {
      try {
        const [genresRes, languagesRes] = await Promise.all([
          ApiService.get('/genre/all'),
          ApiService.get('/languages/all')
        ]);

        setGenres(genresRes.data || genresRes || []);
        setLanguages(languagesRes.data || languagesRes || []);
      } catch (error) {
        console.error('加载数据失败:', error);
        setError('加载数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle cover image selection
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(language === 'zh' ? '封面图片大小不能超过5MB' : 'Cover image size cannot exceed 5MB');
        return;
      }
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle genre selection
  const handleGenreSelect = (genre: Genre) => {
    if (selectedGenres.length >= 2) {
      alert(language === 'zh' ? '最多只能选择2个标签' : 'Maximum 2 tags allowed');
      return;
    }
    if (!selectedGenres.find(g => g.id === genre.id)) {
      setSelectedGenres([...selectedGenres, genre]);
    }
    setShowGenreModal(false);
  };

  const handleGenreRemove = (genreId: number) => {
    setSelectedGenres(selectedGenres.filter(g => g.id !== genreId));
  };

  // Handle protagonist input
  const handleProtagonistChange = (index: number, value: string) => {
    const newProtagonists = [...protagonists];
    newProtagonists[index] = value;
    setProtagonists(newProtagonists);
  };

  const handleAddProtagonist = () => {
    setProtagonists([...protagonists, '']);
  };

  const handleRemoveProtagonist = (index: number) => {
    if (protagonists.length > 1) {
      setProtagonists(protagonists.filter((_, i) => i !== index));
    }
  };

  // Handle language selection
  const handleLanguageSelect = (lang: string) => {
    setSelectedLanguage(lang);
    setShowLanguageModal(false);
  };

  const handleLanguageRemove = () => {
    setSelectedLanguage(null);
  };

  const handleAddNewLanguage = async () => {
    if (!newLanguageName.trim()) {
      alert(language === 'zh' ? '请输入语言名称' : 'Please enter language name');
      return;
    }

    try {
      const response = await ApiService.post('/languages/create', {
        language: newLanguageName.trim()
      });

      const newLang = response.data || response;
      setLanguages([...languages, newLang]);
      setSelectedLanguage(newLanguageName.trim());
      setNewLanguageName('');
      setShowLanguageModal(false);
    } catch (error: any) {
      console.error('添加语言失败:', error);
      alert(error.response?.data?.message || (language === 'zh' ? '添加语言失败' : 'Failed to add language'));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError(language === 'zh' ? '请输入作品名称' : 'Please enter work name');
      return;
    }

    if (title.trim().length > 18) {
      setError(language === 'zh' ? '作品名称不能超过18个字' : 'Work name cannot exceed 18 characters');
      return;
    }

    if (selectedGenres.length === 0) {
      setError(language === 'zh' ? '请至少选择一个标签' : 'Please select at least one tag');
      return;
    }

    if (recommendation.trim().length > 30) {
      setError(language === 'zh' ? '推荐语不能超过30个字' : 'Recommendation cannot exceed 30 characters');
      return;
    }

    if (description.trim().length > 500) {
      setError(language === 'zh' ? '作品简介不能超过500个字' : 'Description cannot exceed 500 characters');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('recommendation', recommendation.trim());
      formData.append('status', status);
      formData.append('language', selectedLanguage || '');
      formData.append('user_id', user!.id.toString());
      formData.append('genre_id_1', selectedGenres[0]?.id.toString() || '');
      formData.append('genre_id_2', selectedGenres[1]?.id.toString() || '');

      // Add protagonists
      const validProtagonists = protagonists.filter(p => p.trim());
      validProtagonists.forEach((name, index) => {
        formData.append(`protagonist_${index}`, name.trim());
      });

      if (coverFile) {
        formData.append('cover', coverFile);
      }

      // 直接使用 fetch 发送 FormData，因为 ApiService 可能不支持 FormData
      const token = localStorage.getItem('token');
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/novel/create`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
          // 不要手动设置 Content-Type，让浏览器自动设置（包含 boundary）
        },
        body: formData
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create novel');
      }

      if (result.id || result.data?.id) {
        alert(language === 'zh' ? '小说创建成功！' : 'Novel created successfully!');
        navigate('/writers-zone');
      } else {
        throw new Error('创建失败');
      }
    } catch (error: any) {
      console.error('创建小说失败:', error);
      setError(error.message || (language === 'zh' ? '创建小说失败，请重试' : 'Failed to create novel, please try again'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${styles[theme]}`}>
        <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles[theme]}`}>
      <NavBar />
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('header.title')}</h1>
          <div className={styles.headerActions}>
            <button className={styles.headerBtn} onClick={() => navigate('/writers-exchange')}>
              {t('header.writerExchange')}
            </button>
            <button className={styles.headerBtn} onClick={() => navigate('/contract-policy')}>
              {t('header.contractPolicy')}
            </button>
            <button className={styles.headerBtn}>
              {t('header.messages')}
            </button>
            <div className={styles.userDropdown}>
              <span>{user?.username || 'User'}</span>
              <span className={styles.dropdownArrow}>▼</span>
            </div>
            <button 
              className={styles.langBtn}
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              title={language === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              {language === 'zh' ? 'EN' : '中文'}
            </button>
            <button 
              className={styles.themeBtn}
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : '切换到夜间模式'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.mainLayout}>
        {/* Left Sidebar Navigation */}
        <AuthorSidebar
          t={t}
          navigate={(to) => navigate(to)}
          styles={styles}
          activeKey="novels"
          expandedMenus={expandedMenus}
          onToggleMenu={toggleMenu}
        />

        {/* Main Content */}
        <main className={styles.content}>
          <div className={styles.mainContent}>
        <div className={styles.formContainer}>
          <h2 className={styles.title}>{language === 'zh' ? '作品信息' : 'Work Information'}</h2>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Cover Image Section */}
            <div className={styles.coverSection}>
              <div className={styles.coverPreview}>
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    <div className={styles.coverPlaceholderText}>
                      {language === 'zh' ? '书名示例' : 'Book Title Example'}
                    </div>
                    <div className={styles.coverPlaceholderAuthor}>
                      {language === 'zh' ? '作者示例' : 'Author Example'}
                    </div>
                  </div>
                )}
              </div>
              <label className={styles.coverButton}>
                {language === 'zh' ? '封面设置' : 'Cover Settings'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  style={{ display: 'none' }}
                />
              </label>
              <p className={styles.coverWarning}>
                {language === 'zh' 
                  ? '若修改了作品名或笔名，请重新保存封面并点击确认修改。' 
                  : 'If the work name or pen name has been modified, please re-save the cover and click confirm to modify.'}
              </p>
            </div>

            {/* Form Fields */}
            <div className={styles.formFields}>
              {/* Work Name */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '作品名称' : 'Work Name'}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'zh' ? '请输入作品名称,最多18个字' : 'Please enter work name, max 18 characters'}
                  maxLength={18}
                />
                <span className={styles.charCount}>{title.length}/18</span>
              </div>

              {/* Genres/Tags */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '作品标签' : 'Work Tags'}</label>
                <div className={styles.tagContainer}>
                  {selectedGenres.map(genre => (
                    <span key={genre.id} className={styles.tag}>
                      {language === 'zh' ? genre.chinese_name : genre.name}
                      <button
                        type="button"
                        onClick={() => handleGenreRemove(genre.id)}
                        className={styles.tagRemove}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedGenres.length < 2 && (
                    <button
                      type="button"
                      className={styles.addTagBtn}
                      onClick={() => setShowGenreModal(true)}
                    >
                      + {language === 'zh' ? '添加标签' : 'Add Tag'}
                    </button>
                  )}
                </div>
              </div>

              {/* Protagonists */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '主角名' : 'Protagonist Name'}</label>
                <div className={styles.protagonistContainer}>
                  {protagonists.map((protagonist, index) => (
                    <div key={index} className={styles.protagonistInput}>
                      <input
                        type="text"
                        value={protagonist}
                        onChange={(e) => handleProtagonistChange(index, e.target.value)}
                        placeholder={language === 'zh' ? '请输入主角名' : 'Enter protagonist name'}
                      />
                      {protagonists.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProtagonist(index)}
                          className={styles.removeProtagonistBtn}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addProtagonistBtn}
                    onClick={handleAddProtagonist}
                  >
                    + {language === 'zh' ? '添加角色' : 'Add Role'}
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '作品状态' : 'Work Status'}</label>
                <div className={styles.radioGroup}>
                  <label>
                    <input
                      type="radio"
                      value="ongoing"
                      checked={status === 'ongoing'}
                      onChange={(e) => setStatus(e.target.value as any)}
                    />
                    {language === 'zh' ? '连载中' : 'Ongoing'}
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="completed"
                      checked={status === 'completed'}
                      onChange={(e) => setStatus(e.target.value as any)}
                    />
                    {language === 'zh' ? '已完结' : 'Completed'}
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="hiatus"
                      checked={status === 'hiatus'}
                      onChange={(e) => setStatus(e.target.value as any)}
                    />
                    {language === 'zh' ? '暂停' : 'Hiatus'}
                  </label>
                </div>
              </div>

              {/* Language */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '语言' : 'Language'}</label>
                <div className={styles.tagContainer}>
                  {selectedLanguage && (
                    <span className={styles.tag}>
                      {selectedLanguage}
                      <button
                        type="button"
                        onClick={handleLanguageRemove}
                        className={styles.tagRemove}
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {!selectedLanguage && (
                    <button
                      type="button"
                      className={styles.addTagBtn}
                      onClick={() => setShowLanguageModal(true)}
                    >
                      + {language === 'zh' ? '选择语言' : 'Select Language'}
                    </button>
                  )}
                </div>
              </div>

              {/* Recommendation */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '推荐语' : 'Recommendation'}</label>
                <input
                  type="text"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  placeholder={language === 'zh' ? '请输入推荐语,最多30个字' : 'Please enter recommendation, max 30 characters'}
                  maxLength={30}
                />
                <span className={styles.charCount}>{recommendation.length}/30</span>
              </div>

              {/* Description */}
              <div className={styles.field}>
                <label>{language === 'zh' ? '作品简介' : 'Work Introduction'}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={language === 'zh' ? '请简要介绍作品,最多500个字' : 'Please briefly introduce the work, max 500 characters'}
                  maxLength={500}
                  rows={6}
                />
                <span className={styles.charCount}>{description.length}/500</span>
              </div>

              {/* Error Message */}
              {error && <div className={styles.error}>{error}</div>}

              {/* Warning */}
              <div className={styles.warning}>
                {language === 'zh' 
                  ? '严禁上传任何抄袭、涉黄、涉赌、涉毒、涉政、涉黑等违规内容。一经查实，全书屏蔽整改并取消福利，情节严重的会追究其法律责任。' 
                  : 'Strictly prohibited to upload any plagiarized, pornographic, gambling, drug-related, political, or black-market content.'}
              </div>

              {/* Action Buttons */}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => navigate('/writers-zone')}
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting 
                    ? (language === 'zh' ? '创建中...' : 'Creating...') 
                    : (language === 'zh' ? '确认创建' : 'Confirm Creation')}
                </button>
              </div>
            </div>
          </form>
        </div>
          </div>
        </main>
      </div>

      {/* Genre Selection Modal */}
      {showGenreModal && (
        <div className={styles.modalOverlay} onClick={() => setShowGenreModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>{language === 'zh' ? '选择标签' : 'Select Tag'}</h3>
            <div className={styles.modalContent}>
              {genres.map(genre => (
                <button
                  key={genre.id}
                  type="button"
                  className={styles.modalOption}
                  onClick={() => handleGenreSelect(genre)}
                  disabled={selectedGenres.find(g => g.id === genre.id) !== undefined}
                >
                  {language === 'zh' ? genre.chinese_name : genre.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setShowGenreModal(false)}
            >
              {language === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLanguageModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>{language === 'zh' ? '选择语言' : 'Select Language'}</h3>
            <div className={styles.modalContent}>
              {languages.map(lang => (
                <button
                  key={lang.id}
                  type="button"
                  className={`${styles.modalOption} ${selectedLanguage === lang.language ? styles.selected : ''}`}
                  onClick={() => handleLanguageSelect(lang.language)}
                >
                  {lang.language}
                </button>
              ))}
            </div>
            <div className={styles.addNewLanguage}>
              <input
                type="text"
                value={newLanguageName}
                onChange={(e) => setNewLanguageName(e.target.value)}
                placeholder={language === 'zh' ? '输入新语言名称' : 'Enter new language name'}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewLanguage();
                  }
                }}
              />
              <button
                type="button"
                className={styles.addLanguageBtn}
                onClick={handleAddNewLanguage}
              >
                + {language === 'zh' ? '新增' : 'Add New'}
              </button>
            </div>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setShowLanguageModal(false)}
            >
              {language === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
};

export default CreateNovel;

