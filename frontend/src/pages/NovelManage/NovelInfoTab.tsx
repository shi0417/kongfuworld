import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import ApiService from '../../services/ApiService';
import styles from './NovelInfoTab.module.css';
import { toAssetUrl, API_BASE_URL } from '../../config';

interface Genre {
  id: number;
  name: string;
  chinese_name: string;
}

interface Language {
  id: number;
  language: string;
}

interface Novel {
  id: number;
  title: string;
  status: string;
  cover: string | null;
  description: string;
  recommendation: string | null;
  languages: string | null;
  user_id?: number;
}

const NovelInfoTab: React.FC<{ novelId: number; novel: Novel }> = ({ novelId, novel: initialNovel }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [title, setTitle] = useState(initialNovel.title || '');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [protagonists, setProtagonists] = useState<string[]>(['']);
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus'>(initialNovel.status as any || 'ongoing');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(initialNovel.languages || null);
  const [recommendation, setRecommendation] = useState(initialNovel.recommendation || '');
  const [description, setDescription] = useState(initialNovel.description || '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialNovel.cover ? toAssetUrl(initialNovel.cover) : null);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showGenreModal, setShowGenreModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');

  // 保存原始数据用于比较是否有修改
  const [originalData, setOriginalData] = useState<{
    title: string;
    genres: Genre[];
    protagonists: string[];
    status: string;
    language: string | null;
    recommendation: string;
    description: string;
    cover: string | null;
  } | null>(null);

  // 加载小说详细信息（包括标签等）
  useEffect(() => {
    const loadData = async () => {
      try {
        const [genresRes, languagesRes, novelDetailRes] = await Promise.all([
          ApiService.get('/genre/all'),
          ApiService.get('/languages/all'),
          ApiService.get(`/novel/${novelId}/detail`)
        ]);

        setGenres(genresRes.data || genresRes || []);
        setLanguages(languagesRes.data || languagesRes || []);
        
        // 如果后端返回了小说的标签等信息，设置它们
        const novelDetail = novelDetailRes.data || novelDetailRes;
        
        // 设置表单数据
        if (novelDetail.title) {
          setTitle(novelDetail.title);
        }
        if (novelDetail.status) {
          setStatus(novelDetail.status as any);
        }
        if (novelDetail.recommendation) {
          setRecommendation(novelDetail.recommendation);
        }
        if (novelDetail.description) {
          setDescription(novelDetail.description);
        }
        if (novelDetail.languages) {
          setSelectedLanguage(novelDetail.languages);
        }
        
        const loadedGenres: Genre[] = novelDetail.genres || [];
        setSelectedGenres(loadedGenres);
        
        // 设置主角名（从protagonist表查询的结果）
        const loadedProtagonists: string[] = (novelDetail.protagonists && Array.isArray(novelDetail.protagonists) && novelDetail.protagonists.length > 0) 
          ? novelDetail.protagonists 
          : [''];
        setProtagonists(loadedProtagonists);
        
        // 保存原始数据用于比较
        setOriginalData({
          title: novelDetail.title || initialNovel.title || '',
          genres: loadedGenres,
          protagonists: loadedProtagonists.filter(p => p.trim()),
          status: novelDetail.status || initialNovel.status || 'ongoing',
          language: novelDetail.languages || initialNovel.languages || null,
          recommendation: novelDetail.recommendation || initialNovel.recommendation || '',
          description: novelDetail.description || initialNovel.description || '',
          cover: novelDetail.cover || initialNovel.cover || null
        });
      } catch (error) {
        console.error('加载数据失败:', error);
        setError('加载数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [novelId]);

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

  // 检查数据是否有变化
  const hasChanges = (): boolean => {
    if (!originalData) return false;

    const currentTitle = title.trim();
    const currentGenres = selectedGenres.map(g => g.id).sort();
    const originalGenres = originalData.genres.map(g => g.id).sort();
    const currentProtagonists = protagonists.filter(p => p.trim()).sort();
    const originalProtagonists = originalData.protagonists.sort();
    const currentStatus = status;
    const currentLanguage = selectedLanguage || '';
    const originalLanguage = originalData.language || '';
    const currentRecommendation = recommendation.trim();
    const currentDescription = description.trim();

    // 比较各个字段
    if (currentTitle !== originalData.title) return true;
    if (JSON.stringify(currentGenres) !== JSON.stringify(originalGenres)) return true;
    if (JSON.stringify(currentProtagonists) !== JSON.stringify(originalProtagonists)) return true;
    if (currentStatus !== originalData.status) return true;
    if (currentLanguage !== originalLanguage) return true;
    if (currentRecommendation !== originalData.recommendation) return true;
    if (currentDescription !== originalData.description) return true;
    if (coverFile !== null) return true; // 有新上传的封面文件

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 检查是否有修改
    if (!hasChanges()) {
      alert(language === 'zh' ? '没有检测到任何修改，无需保存。' : 'No changes detected, no need to save.');
      return;
    }

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

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('novel_id', novelId.toString());
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('recommendation', recommendation.trim());
      formData.append('status', status);
      formData.append('language', selectedLanguage || '');
      formData.append('genre_id_1', selectedGenres[0]?.id.toString() || '');
      formData.append('genre_id_2', selectedGenres[1]?.id.toString() || '');

      const validProtagonists = protagonists.filter(p => p.trim());
      validProtagonists.forEach((name, index) => {
        formData.append(`protagonist_${index}`, name.trim());
      });

      if (coverFile) {
        formData.append('cover', coverFile);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/novel/update`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to update novel');
      }

      alert(language === 'zh' ? '小说信息更新成功！' : 'Novel information updated successfully!');
      
      // 更新原始数据，以便下次比较
      const updatedOriginalData = {
        title: title.trim(),
        genres: selectedGenres,
        protagonists: protagonists.filter(p => p.trim()),
        status: status,
        language: selectedLanguage,
        recommendation: recommendation.trim(),
        description: description.trim(),
        cover: initialNovel.cover // 如果有新封面，这里应该更新，但需要后端返回新的cover路径
      };
      setOriginalData(updatedOriginalData);
      setCoverFile(null); // 清空封面文件，因为已经提交
    } catch (error: any) {
      console.error('更新小说失败:', error);
      setError(error.message || (language === 'zh' ? '更新小说失败，请重试' : 'Failed to update novel, please try again'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>;
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Cover Image Section */}
        <div className={styles.coverSection}>
          <div className={styles.coverPreview}>
            {coverPreview ? (
              <img src={coverPreview} alt="Cover preview" />
            ) : (
              <div className={styles.coverPlaceholder}>
                <div className={styles.coverPlaceholderText}>{title || (language === 'zh' ? '书名示例' : 'Book Title Example')}</div>
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
          {/* Book ID */}
          <div className={styles.field}>
            <label>{language === 'zh' ? '书号' : 'Book ID'}</label>
            <input
              type="text"
              value={novelId}
              readOnly
              className={styles.readonlyInput}
            />
          </div>

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

          {error && <div className={styles.error}>{error}</div>}

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
                ? (language === 'zh' ? '更新中...' : 'Updating...') 
                : (language === 'zh' ? '确认修改' : 'Confirm Update')}
            </button>
          </div>
        </div>
      </form>

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
                  className={styles.modalOption}
                  onClick={() => handleLanguageSelect(lang.language)}
                >
                  {lang.language}
                </button>
              ))}
            </div>
            <div className={styles.newLanguageSection}>
              <input
                type="text"
                value={newLanguageName}
                onChange={(e) => setNewLanguageName(e.target.value)}
                placeholder={language === 'zh' ? '输入新语言名称' : 'Enter new language name'}
                className={styles.newLanguageInput}
              />
              <button
                type="button"
                className={styles.newLanguageBtn}
                onClick={handleAddNewLanguage}
              >
                {language === 'zh' ? '添加' : 'Add'}
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
    </div>
  );
};

export default NovelInfoTab;

