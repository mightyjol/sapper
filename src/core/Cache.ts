import { statSync, promises as fs, Stats } from 'fs'

type CacheEntry = { filePath: string, hash: string, code: string }
type CacheState = { cached: boolean, changed: boolean, stats?: Stats }
// const cache = new Map<string, CacheEntry | undefined>()
const cache: { [filePath: string]: CacheEntry | undefined } = {}

function hashFromStats(stats?: Stats): string | undefined {
  return stats?.mtime.toJSON()
}

function state (current?: CacheEntry, stats?: Stats) {
  const hash = hashFromStats(stats);
  return { cached: !!current, changed: !current || (hash && hash !== current.hash), stats }
}

export default {
  cache,
  set (filePath: string, stats: Stats, code: string) {
    // let current = cache.get(filePath)
    let current = cache[filePath]
    const hash = hashFromStats(stats);

    if (!current) {
      current = { filePath, hash, code }
      // cache.set(filePath, current)
      cache[filePath] = current
    }

    if (current.hash !== hash) {
      current.hash = hash
      current.code = code
    }

    return current
  },
  entry (entry: CacheEntry) {
    if (!entry || !entry.filePath || !entry.code || !entry.hash) throw new Error('Cache entry not valid.')
    cache[entry.filePath] = entry
  },
  parse (json: string) {
    const parsed = JSON.parse(json)
    for (const key in parsed) {
      this.entry(parsed[key])
    }
  },
  async add (filePath: string, code: string, stats?: Stats): Promise<CacheEntry> {
    stats = stats || await fs.stat(filePath)
    return this.set(filePath, stats, code)
  },
  addSync (filePath: string, code: string, stats?: Stats): CacheEntry {
    stats = stats || statSync(filePath)
    return this.set(filePath, stats, code)
  },
  get (filePath: string): CacheEntry | undefined {
    // return cache.get(filePath)
    return cache[filePath]
  },
  async state (filePath: string): Promise<CacheState> {
    // const current = cache.get(filePath)
    const current = cache[filePath]
    let stats
    if (current) {
      stats = await fs.stat(filePath)
    }
    return state(current, stats)
  },
  stateSync (filePath: string): CacheState {
    // const current = cache.get(filePath)
    const current = cache[filePath]
    let stats
    if (current) {
      stats = statSync(filePath)
    }
    return state(current, stats)
  }
}