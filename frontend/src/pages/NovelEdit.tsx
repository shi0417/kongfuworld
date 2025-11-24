import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config';
import { updateVolumesAPI, updateChaptersVolumeIdAPI } from '../api/novel';
import styles from './NovelEdit.module.css';

interface Novel {
  id: number;
  title: string;
  author: string;
  translator: string;
  description: string;
  chapters: number;
  licensed_from: string;
  status: string;
  cover: string;
  rating: number;
  reviews: number;
}

interface Volume {
  id?: number;
  novel_id: number;
  volume_id: number;
  title: string;
  start_chapter: number | null;
  end_chapter: number | null;
  chapter_count: number;
}

const NovelEdit: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTitle, setSearchTitle] = useState('');
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isQueryingChapters, setIsQueryingChapters] = useState(false);
  const [isUpdatingVolumes, setIsUpdatingVolumes] = useState(false);
  const [volumes, setVolumes] = useState<Volume[]>([]);

  // 表单状态
  const [formData, setFormData] = useState({
    id: 0,
    title: '',
    status: '',
    cover: '',
    rating: 0,
    reviews: 0,
    author: '',
    translator: '',
    licensed_from: '',
    description: '',
    chapters: 0
  });

  // 封面图片预览
  const [coverPreview, setCoverPreview] = useState<string>('');

  // 搜索小说
  const handleSearch = async () => {
    if (!searchTitle.trim()) {
      setMessage('请输入小说名称');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(API_ENDPOINTS.SEARCH_NOVEL_BY_TITLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: searchTitle }),
      });

      const data = await response.json();

      if (response.ok && data.novels.length > 0) {
        // 直接选择第一个搜索结果
        await handleSelectNovel(data.novels[0]);
      } else {
        setMessage('未找到相关小说');
      }
    } catch (error) {
      setMessage('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 选择小说
  const handleSelectNovel = async (novel: Novel) => {
    setSelectedNovel(novel);
    setFormData({
      id: novel.id,
      title: novel.title,
      status: novel.status || '',
      cover: novel.cover || '',
      rating: novel.rating || 0,
      reviews: novel.reviews || 0,
      author: novel.author || '',
      translator: novel.translator || '',
      licensed_from: novel.licensed_from || '',
      description: novel.description || '',
      chapters: novel.chapters || 0
    });
    
    // 设置封面预览
    if (novel.cover) {
      if (novel.cover.startsWith('http')) {
        setCoverPreview(novel.cover);
      } else {
        setCoverPreview(`http://localhost:5000${novel.cover}`);
      }
    } else {
      setCoverPreview('');
    }
    
    setMessage('');
    
    // 自动获取章节数量和卷信息
    await Promise.all([
      fetchChapterCount(novel.id),
      fetchVolumes(novel.id)
    ]);
  };

  // 获取章节数量
  const fetchChapterCount = async (novelId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.GET_CHAPTER_COUNT}/${novelId}/chapter-count`);
      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          chapters: data.chapterCount
        }));
      }
    } catch (error) {
      console.error('获取章节数量失败:', error);
    }
  };

  // 获取卷信息
  const fetchVolumes = async (novelId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.GET_VOLUMES}/${novelId}/volumes`);
      const data = await response.json();

      if (response.ok) {
        setVolumes(data.volumes || []);
      }
    } catch (error) {
      console.error('获取卷信息失败:', error);
    }
  };

  // 手动查询章节数量
  const handleQueryChapters = async () => {
    if (!selectedNovel) {
      setMessage('请先选择小说');
      return;
    }

    setIsQueryingChapters(true);
    setMessage('正在查询章节数量...');

    try {
      const response = await fetch(`${API_ENDPOINTS.GET_CHAPTER_COUNT}/${selectedNovel.id}/chapter-count`);
      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          chapters: data.chapterCount
        }));
        setMessage(`查询成功，章节数量：${data.chapterCount}`);
      } else {
        setMessage(data.message || '查询失败');
      }
    } catch (error) {
      setMessage('网络错误，请稍后重试');
    } finally {
      setIsQueryingChapters(false);
    }
  };

  // 添加卷
  const addVolume = () => {
    const newVolumeNumber = volumes.length + 1;
    const newVolume: Volume = {
      novel_id: selectedNovel!.id,
      volume_id: newVolumeNumber,
      title: `第${newVolumeNumber}卷`,
      start_chapter: null,
      end_chapter: null,
      chapter_count: 0
    };
    setVolumes([...volumes, newVolume]);
  };

  // 删除卷
  const removeVolume = (index: number) => {
    const newVolumes = volumes.filter((_, i) => i !== index);
    // 重新编号
    const renumberedVolumes = newVolumes.map((volume, i) => ({
      ...volume,
      volume_id: i + 1,
      title: `第${i + 1}卷`
    }));
    setVolumes(renumberedVolumes);
  };

  // 更新卷信息
  const updateVolume = (index: number, field: keyof Volume, value: any) => {
    const newVolumes = [...volumes];
    newVolumes[index] = {
      ...newVolumes[index],
      [field]: value
    };
    setVolumes(newVolumes);
  };

  // 更新卷信息到数据库
  const handleUpdateVolumes = async () => {
    if (!selectedNovel || volumes.length === 0) {
      setMessage('请先选择小说并添加卷轴信息');
      return;
    }

    setIsUpdatingVolumes(true);
    try {
      console.log('开始更新卷轴信息，选中的小说:', selectedNovel);
      console.log('当前卷轴数据:', volumes);

      // 更新volume表
      const volumeUpdates = volumes.map(volume => {
        // 从标题中提取volume_id，例如"第1卷红楼梦开场戏"中的1
        const volumeIdMatch = volume.title.match(/第(\d+)卷/);
        const volumeId = volumeIdMatch ? parseInt(volumeIdMatch[1]) : 1;

        const volumeData = {
          novel_id: selectedNovel.id,
          volume_id: volumeId,
          title: volume.title,
          start_chapter: volume.start_chapter || 1,
          end_chapter: volume.end_chapter || 1,
          chapter_count: (volume.end_chapter || 1) - (volume.start_chapter || 1) + 1
        };
        
        console.log('处理卷轴数据:', volumeData);
        return volumeData;
      });

      console.log('准备发送的volume更新数据:', volumeUpdates);

      // 调用API更新volume表
      const volumeResult = await updateVolumesAPI(selectedNovel.id, volumeUpdates);
      console.log('volume更新结果:', volumeResult);

      // 更新chapter表中的volume_id
      const chapterUpdates = volumes.flatMap(volume => {
        const volumeNumberMatch = volume.title.match(/第(\d+)卷/);
        const volumeId = volumeNumberMatch ? parseInt(volumeNumberMatch[1]) : 1;
        
        // 为每个章节范围生成更新
        const chapters = [];
        const startChapter = volume.start_chapter || 1;
        const endChapter = volume.end_chapter || 1;
        
        for (let chapterNum = startChapter; chapterNum <= endChapter; chapterNum++) {
          chapters.push({
            novel_id: selectedNovel.id,
            chapter_number: chapterNum,
            volume_id: volumeId
          });
        }
        return chapters;
      });

      console.log('准备发送的chapter更新数据:', chapterUpdates);

      // 调用API更新chapter表
      const chapterResult = await updateChaptersVolumeIdAPI(selectedNovel.id, chapterUpdates);
      console.log('chapter更新结果:', chapterResult);

      setMessage('小说卷轴信息更新成功');
      
      // 重新获取卷信息
      await fetchVolumes(selectedNovel.id);
      
    } catch (error) {
      console.error('更新小说卷轴信息失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setMessage(`更新小说卷轴信息失败: ${errorMessage}`);
    } finally {
      setIsUpdatingVolumes(false);
    }
  };

  // 处理封面图片上传
  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setMessage('请选择图片文件');
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('图片文件大小不能超过5MB');
      return;
    }

    setIsUploadingCover(true);
    setMessage('正在上传封面图片...');

    try {
      const formData = new FormData();
      formData.append('cover', file);
      formData.append('novelId', selectedNovel?.id.toString() || '');

      const response = await fetch(`${API_ENDPOINTS.UPLOAD_COVER}/${selectedNovel?.id}/cover`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          cover: data.coverUrl
        }));
        setCoverPreview(`http://localhost:5000${data.coverUrl}`);
        setMessage('封面图片上传成功！');
      } else {
        setMessage(data.message || '封面图片上传失败');
      }
    } catch (error) {
      setMessage('网络错误，请稍后重试');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 更新小说信息
  const handleUpdate = async () => {
    if (!selectedNovel) {
      setMessage('请先选择小说');
      return;
    }

    setIsUpdating(true);
    setMessage('正在更新...');

    try {
      const response = await fetch(`${API_ENDPOINTS.UPDATE_NOVEL}/${selectedNovel.id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('更新成功！');
        setSelectedNovel(prev => prev ? { ...prev, ...formData } : null);
      } else {
        setMessage(data.message || '更新失败');
      }
    } catch (error) {
      setMessage('网络错误，请稍后重试');
    } finally {
      setIsUpdating(false);
    }
  };

  // 处理表单输入变化
  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 生成章节选项
  const generateChapterOptions = () => {
    const options = [];
    for (let i = 1; i <= formData.chapters; i++) {
      options.push(
        <option key={i} value={i}>
          第{i}章
        </option>
      );
    }
    return options;
  };



  return (
    <div className={styles['novel-edit-container']}>
      <div className={styles['novel-edit-header']}>
        <button 
          className={styles['back-button']}
          onClick={() => navigate('/')}
        >
          返回首页
        </button>
        <h1>小说信息修改</h1>
      </div>

      <div className={styles['search-section']}>
        <label>搜索小说:</label>
        <div className={styles['search-form']}>
          <input
            type="text"
            placeholder="请输入小说名称"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`${styles.message} ${message.includes('成功') ? styles.success : styles.error}`}>
          {message}
        </div>
      )}

      {selectedNovel && (
        <div className={styles['edit-section']}>
          <div className={styles['edit-layout']}>
            {/* 左侧：表单区域 */}
            <div className={styles['form-section']}>
              <div className={styles['form-fields']}>
                <div className={styles['form-row']}>
                  <label>小说ID:</label>
                  <input
                    type="number"
                    value={formData.id}
                    readOnly
                    className={styles['readonly-input']}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说title:</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="请输入小说标题"
                    maxLength={255}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说status:</label>
                  <input
                    type="text"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    placeholder="请输入小说状态"
                    maxLength={50}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说cover:</label>
                  <input
                    type="text"
                    value={formData.cover}
                    onChange={(e) => handleInputChange('cover', e.target.value)}
                    placeholder="封面图片路径"
                    maxLength={255}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说rating:</label>
                  <input
                    type="number"
                    value={formData.rating}
                    onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || 0)}
                    placeholder="评分"
                    step="0.1"
                    min="0"
                    max="5"
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说review:</label>
                  <input
                    type="number"
                    value={formData.reviews}
                    onChange={(e) => handleInputChange('reviews', parseInt(e.target.value) || 0)}
                    placeholder="评论数量"
                    min="0"
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说author:</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                    placeholder="请输入作者"
                    maxLength={100}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说translater:</label>
                  <input
                    type="text"
                    value={formData.translator}
                    onChange={(e) => handleInputChange('translator', e.target.value)}
                    placeholder="请输入译者"
                    maxLength={100}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说licensed_from:</label>
                  <input
                    type="text"
                    value={formData.licensed_from}
                    onChange={(e) => handleInputChange('licensed_from', e.target.value)}
                    placeholder="请输入版权来源"
                    maxLength={100}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说description:</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="请输入小说简介"
                    rows={6}
                    maxLength={1000}
                  />
                </div>

                <div className={styles['form-row']}>
                  <label>小说chapters:</label>
                  <div className={styles['chapters-input-group']}>
                    <input
                      type="number"
                      value={formData.chapters}
                      readOnly
                      className={styles['readonly-input']}
                    />
                    <button 
                      onClick={handleQueryChapters}
                      disabled={isQueryingChapters}
                      className={styles['query-button']}
                    >
                      {isQueryingChapters ? '查询中...' : '查询'}
                    </button>
                  </div>
                </div>

                <div className={styles['query-hint']}>
                  根据小说的id查询 chapter表中有多少个 章节
                </div>
              </div>

              <div className={styles['form-actions']}>
                <button 
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className={styles['update-button']}
                >
                  {isUpdating ? '更新中...' : '更新小说信息'}
                </button>
              </div>
            </div>

            {/* 右侧：图片显示区域 */}
            <div className={styles['image-section']}>
              <div className={styles['image-container']}>
                {coverPreview ? (
                  <div className={styles['image-preview']}>
                    <img src={coverPreview} alt="小说封面" />
                    <div className={styles['image-overlay']}>
                      <button 
                        onClick={triggerFileSelect}
                        disabled={isUploadingCover}
                        className={styles['change-image-btn']}
                      >
                        {isUploadingCover ? '上传中...' : '更换图片'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles['image-placeholder']} onClick={triggerFileSelect}>
                    <div className={styles['placeholder-text']}>
                      <p>小说图片显示位置</p>
                      <p>尺寸大小为4cm*6cm</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* 卷管理区域 */}
          <div className={styles['volume-section']}>
            <hr className={styles['section-divider']} />
            <div className={styles['volume-header']}>
              <h3>小说卷轴管理</h3>
              <p>这里让用户给指定卷号和对应的章节</p>
            </div>

            <div className={styles['volume-list']}>
              {volumes.map((volume, index) => (
                <div key={index} className={styles['volume-item']}>
                  <div className={styles['volume-header-row']}>
                    <label>{volume.title}:</label>
                    <button
                      onClick={() => removeVolume(index)}
                      className={styles['remove-volume-btn']}
                      disabled={volumes.length === 1}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className={styles['volume-inputs']}>
                    <input
                      type="text"
                      value={volume.title}
                      onChange={(e) => updateVolume(index, 'title', e.target.value)}
                      placeholder="卷标题"
                      className={styles['volume-title-input']}
                    />
                    
                    <div className={styles['chapter-range']}>
                      <span>第</span>
                      <select
                        value={volume.start_chapter || ''}
                        onChange={(e) => updateVolume(index, 'start_chapter', e.target.value ? parseInt(e.target.value) : null)}
                        className={styles['chapter-select']}
                      >
                        <option value="">选择章节</option>
                        {generateChapterOptions()}
                      </select>
                      <span>章, 到第</span>
                      <select
                        value={volume.end_chapter || ''}
                        onChange={(e) => updateVolume(index, 'end_chapter', e.target.value ? parseInt(e.target.value) : null)}
                        className={styles['chapter-select']}
                      >
                        <option value="">选择章节</option>
                        {generateChapterOptions()}
                      </select>
                      <span>章</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles['volume-actions']}>
              <button
                onClick={addVolume}
                className={styles['add-volume-btn']}
              >
                +
              </button>
              <span className={styles['add-volume-hint']}>
                点击+号可以无限的顺序增加第2卷, 第3卷...
              </span>
            </div>

            <div className={styles['volume-constraint']}>
              这里下拉框章节的最大数为上面查询到的小说chapters的数值
            </div>

            <div className={styles['volume-update-actions']}>
              <button
                onClick={handleUpdateVolumes}
                disabled={isUpdatingVolumes}
                className={styles['update-volumes-btn']}
              >
                {isUpdatingVolumes ? '更新中...' : '更新小说卷轴信息'}
              </button>
              <div className={styles['volume-update-hint']}>
                点击这里更新volume表格, 对应novel_id的号码
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovelEdit;
