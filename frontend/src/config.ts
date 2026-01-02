export const getApiOrigin = (): string => {
  const envApi = (process.env.REACT_APP_API_URL || '').trim();
  const runtimeOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return (envApi || runtimeOrigin).replace(/\/$/, '');
};

export const getApiBaseUrl = (): string => {
  const origin = getApiOrigin();
  return origin ? `${origin}/api` : '';
};

export const API_BASE_URL = getApiOrigin();

export const API_ENDPOINTS = {
  FIND_SIMILAR_NOVELS: `${getApiBaseUrl()}/novel/find-similar`,
  GET_ALL_NOVELS: `${getApiBaseUrl()}/novels`,
  SEARCH_NOVELS: `${getApiBaseUrl()}/novels/search`,
  GET_NOVEL_INFO: `${getApiBaseUrl()}/novel`,
  PARSE_CHAPTERS: `${getApiBaseUrl()}/novel/parse-chapters`,
  PARSE_MULTIPLE_FILES: `${getApiBaseUrl()}/novel/parse-multiple-files`,
  UPLOAD_NOVEL: `${getApiBaseUrl()}/novel/upload`,
  LOGIN: `${getApiBaseUrl()}/login`,
  REGISTER: `${getApiBaseUrl()}/register`,
  USER_PROFILE: `${getApiBaseUrl()}/user`,
  USER_AVATAR: `${getApiBaseUrl()}/user`,
  USER_SETTINGS: `${getApiBaseUrl()}/user`,
  SEARCH_NOVEL_BY_TITLE: `${getApiBaseUrl()}/novel/search-by-title`,
  GET_NOVEL_DETAILS: `${getApiBaseUrl()}/novel`,
  GET_CHAPTER_COUNT: `${getApiBaseUrl()}/novel`,
  UPDATE_NOVEL: `${getApiBaseUrl()}/novel`,
  UPLOAD_COVER: `${getApiBaseUrl()}/novel`,
  GET_VOLUMES: `${getApiBaseUrl()}/novel`,
  UPDATE_VOLUMES: `${getApiBaseUrl()}/novel`,
}; 