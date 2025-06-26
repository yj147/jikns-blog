// 音乐文件处理工具函数

export interface ParsedMusicInfo {
  title: string
  artist: string
}

export interface MusicFileInfo {
  id: string
  title: string
  artist: string
  src: string
  filename: string
  size?: number
  lastModified?: number
  duration?: number
}

// 支持的音频文件格式
export const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac']

/**
 * 解析文件名获取歌曲信息
 * 支持多种命名格式：
 * - "艺术家 - 歌曲名.mp3"
 * - "01 - 歌曲名.mp3"
 * - "歌曲名.mp3"
 */
export function parseFileName(filename: string): ParsedMusicInfo {
  // 移除文件扩展名
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

  // 规则1: "艺术家 - 歌曲名" 格式
  const artistTitleMatch = nameWithoutExt.match(/^(.+?)\s*[-–—]\s*(.+)$/)
  if (artistTitleMatch) {
    const [, artist, title] = artistTitleMatch

    // 检查是否是数字开头（如 "01 - 歌曲名"）
    if (/^\d+$/.test(artist.trim())) {
      return {
        title: cleanTitle(title),
        artist: '未知艺术家',
      }
    }

    return {
      title: cleanTitle(title),
      artist: cleanArtist(artist),
    }
  }

  // 规则2: 检查是否以数字开头 "01 歌曲名"
  const numberTitleMatch = nameWithoutExt.match(/^(\d+)\s*[.\s]*(.+)$/)
  if (numberTitleMatch) {
    const [, , title] = numberTitleMatch
    return {
      title: cleanTitle(title),
      artist: '未知艺术家',
    }
  }

  // 规则3: 只有歌曲名
  return {
    title: cleanTitle(nameWithoutExt),
    artist: '未知艺术家',
  }
}

/**
 * 清理歌曲标题
 */
function cleanTitle(title: string): string {
  return title
    .replace(/[-_]/g, ' ') // 替换连字符和下划线为空格
    .replace(/\s+/g, ' ') // 合并多个空格
    .replace(/^\d+\s*[.\s]*/, '') // 移除开头的数字
    .trim()
}

/**
 * 清理艺术家名称
 */
function cleanArtist(artist: string): string {
  return artist
    .replace(/[-_]/g, ' ') // 替换连字符和下划线为空格
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim()
}

/**
 * 生成基于文件名的唯一ID
 */
export function generateMusicId(filename: string): string {
  // 使用文件名生成一个相对稳定的ID
  let hash = 0
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 转换为32位整数
  }

  // 转换为正数并转为36进制字符串
  return Math.abs(hash).toString(36).padStart(8, '0')
}

/**
 * 检查文件是否为支持的音频格式
 */
export function isSupportedAudioFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return SUPPORTED_AUDIO_FORMATS.includes(ext)
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化时间（秒转为 mm:ss 格式）
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * 验证音乐文件信息
 */
export function validateMusicFile(file: Partial<MusicFileInfo>): file is MusicFileInfo {
  return !!(file.id && file.title && file.artist && file.src && file.filename)
}

/**
 * 排序音乐文件
 */
export function sortMusicFiles(
  files: MusicFileInfo[],
  sortBy: 'title' | 'artist' | 'filename' = 'filename'
): MusicFileInfo[] {
  return [...files].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title, 'zh-CN', { numeric: true })
      case 'artist':
        return (
          a.artist.localeCompare(b.artist, 'zh-CN', { numeric: true }) ||
          a.title.localeCompare(b.title, 'zh-CN', { numeric: true })
        )
      case 'filename':
      default:
        return a.filename.localeCompare(b.filename, 'zh-CN', { numeric: true })
    }
  })
}

/**
 * 过滤音乐文件
 */
export function filterMusicFiles(files: MusicFileInfo[], query: string): MusicFileInfo[] {
  if (!query.trim()) return files

  const searchTerm = query.toLowerCase().trim()

  return files.filter(
    (file) =>
      file.title.toLowerCase().includes(searchTerm) ||
      file.artist.toLowerCase().includes(searchTerm) ||
      file.filename.toLowerCase().includes(searchTerm)
  )
}
