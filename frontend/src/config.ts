// API配置
// 开发环境：优先使用 REACT_APP_API_URL，否则使用 localhost:5000
// 生产环境：优先使用 REACT_APP_API_URL，如果未设置则使用 window.location.origin（同源）
const getApiOrigin = (): string => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：运行时使用当前页面的 origin
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // 构建时无法获取 window，返回空字符串（相对路径）
    return '';
  }
  // 开发环境默认值
  return 'http://localhost:5000';
};

export const API_ORIGIN = getApiOrigin();
export const API_BASE_URL = API_ORIGIN;

// 静态资源（头像/封面/上传文件）Base URL
// 开发环境：优先使用 REACT_APP_ASSET_URL，否则使用 localhost:5000
// 生产环境：优先使用 REACT_APP_ASSET_URL，如果未设置则使用 window.location.origin（同源）
const getAssetOrigin = (): string => {
  if (process.env.REACT_APP_ASSET_URL) {
    return process.env.REACT_APP_ASSET_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：运行时使用当前页面的 origin
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // 构建时无法获取 window，返回空字符串（相对路径）
    return '';
  }
  // 开发环境默认值
  return 'http://localhost:5000';
};

export const ASSET_BASE_URL = getAssetOrigin();

/**
 * 将相对路径转换为完整的资源 URL
 * @param pathOrUrl - 相对路径（如 "/avatars/user.jpg"）或完整 URL
 * @returns 完整的资源 URL（生产环境为相对路径，开发环境为完整 URL）
 */
export function toAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  // 如果已经是完整 URL，原样返回
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  // 如果 ASSET_BASE_URL 为空（生产环境），直接返回路径
  if (!ASSET_BASE_URL) {
    return pathOrUrl;
  }
  // 确保路径以 / 开头
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  // 确保 ASSET_BASE_URL 末尾没有 /
  const base = ASSET_BASE_URL.endsWith('/') ? ASSET_BASE_URL.slice(0, -1) : ASSET_BASE_URL;
  return `${base}${normalizedPath}`;
}

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