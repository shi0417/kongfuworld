// API配置
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// API端点
export const API_ENDPOINTS = {
  FIND_SIMILAR_NOVELS: `${API_BASE_URL}/api/novel/find-similar`,
  GET_ALL_NOVELS: `${API_BASE_URL}/api/novels`,
  SEARCH_NOVELS: `${API_BASE_URL}/api/novels/search`,
  GET_NOVEL_INFO: `${API_BASE_URL}/api/novel`,
  PARSE_CHAPTERS: `${API_BASE_URL}/api/novel/parse-chapters`,
  PARSE_MULTIPLE_FILES: `${API_BASE_URL}/api/novel/parse-multiple-files`,
  UPLOAD_NOVEL: `${API_BASE_URL}/api/novel/upload`,
  LOGIN: `${API_BASE_URL}/api/login`,
  REGISTER: `${API_BASE_URL}/api/register`,
  USER_PROFILE: `${API_BASE_URL}/api/user`,
  USER_AVATAR: `${API_BASE_URL}/api/user`,
  USER_SETTINGS: `${API_BASE_URL}/api/user`,
  SEARCH_NOVEL_BY_TITLE: `${API_BASE_URL}/api/novel/search-by-title`,
  GET_NOVEL_DETAILS: `${API_BASE_URL}/api/novel`,
  GET_CHAPTER_COUNT: `${API_BASE_URL}/api/novel`,
  UPDATE_NOVEL: `${API_BASE_URL}/api/novel`,
  UPLOAD_COVER: `${API_BASE_URL}/api/novel`,
  GET_VOLUMES: `${API_BASE_URL}/api/novel`,
  UPDATE_VOLUMES: `${API_BASE_URL}/api/novel`,
}; 