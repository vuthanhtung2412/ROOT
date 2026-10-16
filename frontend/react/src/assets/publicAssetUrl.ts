const PATH_SEPARATOR = '/'

/**
 * URL of a `public/` file under Vite's `base`:
 * `/` locally and natively, `/ROOT/` on GitHub Pages (`ROOT_WEB_BASE_PATH`).
 */
export function publicAssetUrl(assetPath: string): string {
  const relativePath: string = assetPath.startsWith(PATH_SEPARATOR)
    ? assetPath.slice(PATH_SEPARATOR.length)
    : assetPath
  return `${import.meta.env.BASE_URL}${relativePath}`
}
