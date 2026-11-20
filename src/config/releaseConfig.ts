declare const __APP_VERSION__: string | undefined;

/** Build-injected semantic version read from package.json via Vite `define`. */
export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0
    ? __APP_VERSION__
    : '2.0.1';

export const GITHUB_REPO_OWNER = 'Tarek-Ahmed4a';
export const GITHUB_REPO_NAME = 'Anatomy-Atlas';

export const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const GITHUB_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const GITHUB_ANNOUNCEMENT_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/announcement.json`;
