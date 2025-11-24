
import ApiService from '../services/ApiService';

// 更新小说卷轴信息
export const updateVolumesAPI = async (novelId: number, volumes: Array<{
  novel_id: number;
  volume_id: number;
  title: string;
  start_chapter: number;
  end_chapter: number;
  chapter_count: number;
}>) => {
  const response = await ApiService.request(`/novels/${novelId}/volumes`, {
    method: 'PUT',
    body: JSON.stringify({ volumes }),
  });

  if (!response.success) {
    throw new Error(response.message || 'Failed to update volumes');
  }

  return response.data;
};

// 更新章节的volume_id
export const updateChaptersVolumeIdAPI = async (novelId: number, chapterUpdates: Array<{
  novel_id: number;
  chapter_number: number;
  volume_id: number;
}>) => {
  const response = await ApiService.request(`/novels/${novelId}/chapters/volume-id`, {
    method: 'PUT',
    body: JSON.stringify({ chapterUpdates }),
  });

  if (!response.success) {
    throw new Error(response.message || 'Failed to update chapters volume_id');
  }

  return response.data;
};

