import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import path from 'path'

// 支持的音频文件格式
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac']

// 缓存配置
let musicCache: {
  data: any[]
  timestamp: number
  lastModified: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

interface MusicFile {
  id: string
  title: string
  artist: string
  src: string
  filename: string
  size: number
  lastModified: number
}

// 解析文件名获取歌曲信息
function parseFileName(filename: string): { title: string; artist: string } {
  // 移除文件扩展名
  const nameWithoutExt = path.parse(filename).name

  // 规则1: "部分1 - 部分2" 格式
  const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/)
  if (dashMatch) {
    const [, part1, part2] = dashMatch

    // 检查是否是数字开头（如 "01 - 歌曲名"）
    if (/^\d+$/.test(part1.trim())) {
      return {
        title: part2.trim(),
        artist: '未知艺术家',
      }
    }

    // 智能判断哪个是歌曲名，哪个是艺术家
    // 常见的艺术家名称模式（通常包含这些词的更可能是艺术家）
    const artistIndicators = [
      'band',
      'group',
      'orchestra',
      'choir',
      'ensemble',
      // 常见艺术家后缀
      'ft',
      'feat',
      'featuring',
      'vs',
      'and',
      '&',
    ]

    const part1Lower = part1.toLowerCase()
    const part2Lower = part2.toLowerCase()

    // 检查是否有明显的艺术家指示词
    const part1HasArtistIndicator = artistIndicators.some((indicator) =>
      part1Lower.includes(indicator)
    )
    const part2HasArtistIndicator = artistIndicators.some((indicator) =>
      part2Lower.includes(indicator)
    )

    // 如果其中一个有艺术家指示词，那个就是艺术家
    if (part1HasArtistIndicator && !part2HasArtistIndicator) {
      return {
        title: part2.trim(),
        artist: part1.trim(),
      }
    } else if (part2HasArtistIndicator && !part1HasArtistIndicator) {
      return {
        title: part1.trim(),
        artist: part2.trim(),
      }
    }

    // 对于您的情况 "Yellow-Coldplay"，我们可以添加已知艺术家列表
    const knownArtists = [
      'coldplay',
      'beatles',
      'queen',
      'radiohead',
      'u2',
      'oasis',
      'blur',
      'adele',
      'ed sheeran',
      'taylor swift',
      'beyonce',
      'rihanna',
      'eminem',
      'kanye west',
      'drake',
      'jay-z',
      'kendrick lamar',
    ]

    const part1IsKnownArtist = knownArtists.includes(part1Lower)
    const part2IsKnownArtist = knownArtists.includes(part2Lower)

    if (part1IsKnownArtist && !part2IsKnownArtist) {
      return {
        title: part2.trim(),
        artist: part1.trim(),
      }
    } else if (part2IsKnownArtist && !part1IsKnownArtist) {
      return {
        title: part1.trim(),
        artist: part2.trim(),
      }
    }

    // 默认情况：假设第一部分是歌曲名，第二部分是艺术家
    // 这适用于 "Yellow-Coldplay" 这样的格式
    return {
      title: part1.trim(),
      artist: part2.trim(),
    }
  }

  // 规则2: 只有歌曲名
  return {
    title: nameWithoutExt.replace(/[-_]/g, ' ').trim(),
    artist: '未知艺术家',
  }
}

// 生成唯一ID
function generateId(filename: string): string {
  return Buffer.from(filename)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 16)
}

// 获取目录最后修改时间
async function getDirectoryLastModified(dirPath: string): Promise<number> {
  try {
    const files = await readdir(dirPath)
    let latestTime = 0

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stats = await stat(filePath)
      if (stats.mtime.getTime() > latestTime) {
        latestTime = stats.mtime.getTime()
      }
    }

    return latestTime
  } catch (error) {
    return 0
  }
}

// 扫描音乐文件
async function scanMusicFiles(): Promise<MusicFile[]> {
  const musicDir = path.join(process.cwd(), 'public', 'static', 'music')

  try {
    // 检查目录是否存在
    try {
      await stat(musicDir)
    } catch (error) {
      console.log('音乐目录不存在:', musicDir)
      return []
    }

    const files = await readdir(musicDir)
    const musicFiles: MusicFile[] = []

    for (const file of files) {
      const filePath = path.join(musicDir, file)
      const fileExt = path.extname(file).toLowerCase()

      // 跳过非音频文件和隐藏文件
      if (!SUPPORTED_AUDIO_FORMATS.includes(fileExt) || file.startsWith('.')) {
        continue
      }

      try {
        const stats = await stat(filePath)

        // 跳过目录
        if (stats.isDirectory()) {
          continue
        }

        const { title, artist } = parseFileName(file)

        musicFiles.push({
          id: generateId(file),
          title,
          artist,
          src: `/static/music/${file}`,
          filename: file,
          size: stats.size,
          lastModified: stats.mtime.getTime(),
        })
      } catch (error) {
        console.error(`处理文件 ${file} 时出错:`, error)
        continue
      }
    }

    // 按文件名排序
    return musicFiles.sort((a, b) => a.filename.localeCompare(b.filename))
  } catch (error) {
    console.error('扫描音乐文件时出错:', error)
    return []
  }
}

// GET - 获取音乐文件列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const musicDir = path.join(process.cwd(), 'public', 'static', 'music')
    const currentTime = Date.now()

    // 检查缓存是否有效
    if (!forceRefresh && musicCache) {
      const cacheAge = currentTime - musicCache.timestamp

      if (cacheAge < CACHE_DURATION) {
        // 检查目录是否有更新
        const dirLastModified = await getDirectoryLastModified(musicDir)

        if (dirLastModified <= musicCache.lastModified) {
          return NextResponse.json({
            success: true,
            songs: musicCache.data,
            total: musicCache.data.length,
            cached: true,
            cacheAge: Math.round(cacheAge / 1000),
          })
        }
      }
    }

    // 扫描音乐文件
    const songs = await scanMusicFiles()
    const dirLastModified = await getDirectoryLastModified(musicDir)

    // 更新缓存
    musicCache = {
      data: songs,
      timestamp: currentTime,
      lastModified: dirLastModified,
    }

    return NextResponse.json({
      success: true,
      songs,
      total: songs.length,
      cached: false,
      scannedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('获取音乐列表时出错:', error)

    return NextResponse.json(
      {
        success: false,
        error: '获取音乐列表失败',
        songs: [],
        total: 0,
      },
      { status: 500 }
    )
  }
}

// POST - 刷新音乐缓存
export async function POST(request: NextRequest) {
  try {
    // 清除缓存
    musicCache = null

    // 重新扫描
    const songs = await scanMusicFiles()
    const musicDir = path.join(process.cwd(), 'public', 'static', 'music')
    const dirLastModified = await getDirectoryLastModified(musicDir)

    // 更新缓存
    musicCache = {
      data: songs,
      timestamp: Date.now(),
      lastModified: dirLastModified,
    }

    return NextResponse.json({
      success: true,
      message: '音乐缓存已刷新',
      songs,
      total: songs.length,
      refreshedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('刷新音乐缓存时出错:', error)

    return NextResponse.json(
      {
        success: false,
        error: '刷新缓存失败',
      },
      { status: 500 }
    )
  }
}
