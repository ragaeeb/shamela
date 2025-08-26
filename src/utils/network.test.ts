import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { URL } from 'node:url'

// NOTE: Testing framework: Jest/Vitest compatible syntax (describe/it/expect).
// - If the project uses Jest, this runs as-is.
// - If the project uses Vitest, ensure test runner maps jest.* to vi.* or replace jest with vi.
// The tests use module mocking for 'node:https' consistent with Jest/Vitest patterns.

type HttpsModule = {
  get: (url: any, cb: (res: any) => void) => { on: (event: string, handler: (err: Error) => void) => any }
}

// Helper to safely restore environment variables per test
const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  // Restore env to avoid test pollution
  process.env = { ...ORIGINAL_ENV }
  // Clear all mocks between tests
  // Supports both Jest and Vitest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any
  if (typeof g.jest !== 'undefined' && typeof g.jest.clearAllMocks === 'function') {
    g.jest.clearAllMocks()
    g.jest.resetModules()
  } else {
    try {
      // Vitest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vitest: any = g
      vitest.vi?.clearAllMocks?.()
      vitest.vi?.resetModules?.()
    } catch {
      // ignore
    }
  }
})

describe('buildUrl', () => {
  // Import inside tests to ensure env var changes take effect without module-level caching
  const importUnderTest = async () => {
    const mod = await import('./network') // prefer src/utils/network.ts as implementation file
    return mod as unknown as {
      buildUrl: (endpoint: string, queryParams: Record<string, any>, useAuth?: boolean) => URL
    }
  }

  it('builds URL with query params and api_key (default useAuth=true)', async () => {
    process.env.SHAMELA_API_KEY = 'test_api_key'
    const { buildUrl } = await importUnderTest()

    const url = buildUrl('https://api.example.com/items', { active: true, page: 2, q: 'book' })
    const u = new URL(url.toString())

    expect(u.origin + u.pathname).toBe('https://api.example.com/items')
    const params = u.searchParams
    expect(params.get('q')).toBe('book')
    expect(params.get('page')).toBe('2') // coerced via toString()
    expect(params.get('active')).toBe('true') // coerced via toString()
    expect(params.get('api_key')).toBe('test_api_key')
  })

  it('omits api_key when useAuth=false', async () => {
    process.env.SHAMELA_API_KEY = 'secret'
    const { buildUrl } = await importUnderTest()

    const url = buildUrl('https://svc.example.org/data', { lang: 'en' }, false)
    const u = new URL(url.toString())

    expect(u.searchParams.get('lang')).toBe('en')
    expect(u.searchParams.has('api_key')).toBe(false)
  })

  it('handles empty query params but still appends api_key by default', async () => {
    process.env.SHAMELA_API_KEY = 'k123'
    const { buildUrl } = await importUnderTest()

    const url = buildUrl('https://x.y/z', {})
    const u = new URL(url.toString())

    expect([...u.searchParams.keys()].length).toBe(1)
    expect(u.searchParams.get('api_key')).toBe('k123')
  })

  it('coerces object values using toString and includes them as [object Object]', async () => {
    process.env.SHAMELA_API_KEY = 'k'
    const { buildUrl } = await importUnderTest()

    const url = buildUrl('https://x.y/z', { meta: { a: 1 } }, false)
    const u = new URL(url.toString())

    expect(u.searchParams.get('meta')).toBe('[object Object]')
  })

  it('throws when a query param value is null (cannot toString null)', async () => {
    process.env.SHAMELA_API_KEY = 'k'
    const { buildUrl } = await importUnderTest()

    expect(() => buildUrl('https://x.y/z', { bad: null as any }, false)).toThrow(TypeError)
  })

  it('throws when a query param value is undefined (cannot toString undefined)', async () => {
    process.env.SHAMELA_API_KEY = 'k'
    const { buildUrl } = await importUnderTest()

    expect(() => buildUrl('https://x.y/z', { bad: undefined as any }, false)).toThrow(TypeError)
  })
})

describe('httpsGet', () => {
  // Dynamic import to apply module mocks before loading
  const importUnderTest = async () => {
    const mod = await import('./network')
    return mod as unknown as {
      httpsGet: <T extends Buffer | Record<string, any>>(url: string | URL) => Promise<T>
    }
  }

  // Utilities to set up https mock compatible with Jest/Vitest
  function useHttpsMock(factory: () => HttpsModule) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any
    if (typeof g.jest !== 'undefined' && typeof g.jest.doMock === 'function') {
      g.jest.doMock('node:https', factory)
    } else if (g.vi && typeof g.vi.mock === 'function') {
      g.vi.mock('node:https', factory as any)
    } else if (typeof jest !== 'undefined' && typeof (jest as any).doMock === 'function') {
      ;(jest as any).doMock('node:https', factory)
    } else if (typeof vi !== 'undefined' && typeof (vi as any).mock === 'function') {
      ;(vi as any).mock('node:https', factory as any)
    } else {
      throw new Error('No supported mocking framework detected (Jest/Vitest expected)')
    }
  }

  it('resolves JSON when content-type includes application/json', async () => {
    useHttpsMock(() => {
      const req = new EventEmitter()

      const https: HttpsModule = {
        get: (url, cb) => {
          const res = new EventEmitter()
          ;(res as any).headers = { 'content-type': 'application/json; charset=utf-8' }
          // Invoke callback with the mock response
          setImmediate(() => {
            cb(res)
            // Emit data and end
            ;(res as any).emit('data', Buffer.from(JSON.stringify({ n: 42, ok: true }), 'utf-8'))
            ;(res as any).emit('end')
          })
          return {
            on: (event: string, handler: (err: Error) => void) => {
              req.on(event, handler)
              return req
            },
          }
        },
      }
      return https as unknown as HttpsModule
    })

    const { httpsGet } = await importUnderTest()
    const result = await httpsGet<Record<string, any>>('https://api.example.com/ok')
    expect(result).toEqual({ n: 42, ok: true })
  })

  it('rejects when JSON parsing fails', async () => {
    useHttpsMock(() => {
      const req = new EventEmitter()

      const https: HttpsModule = {
        get: (url, cb) => {
          const res = new EventEmitter()
          ;(res as any).headers = { 'content-type': 'application/json' }
          setImmediate(() => {
            cb(res)
            ;(res as any).emit('data', Buffer.from('{invalid-json', 'utf-8'))
            ;(res as any).emit('end')
          })
          return {
            on: (event: string, handler: (err: Error) => void) => {
              req.on(event, handler)
              return req
            },
          }
        },
      }
      return https as unknown as HttpsModule
    })

    const { httpsGet } = await importUnderTest()
    await expect(httpsGet<Record<string, any>>('https://api.example.com/bad-json')).rejects.toThrow(
      /Failed to parse JSON/i,
    )
  })

  it('resolves Buffer when content-type is not JSON', async () => {
    useHttpsMock(() => {
      const req = new EventEmitter()

      const https: HttpsModule = {
        get: (url, cb) => {
          const res = new EventEmitter()
          ;(res as any).headers = { 'content-type': 'text/plain' }
          setImmediate(() => {
            cb(res)
            ;(res as any).emit('data', Buffer.from('hello '))
            ;(res as any).emit('data', Buffer.from('world'))
            ;(res as any).emit('end')
          })
          return {
            on: (event: string, handler: (err: Error) => void) => {
              req.on(event, handler)
              return req
            },
          }
        },
      }
      return https as unknown as HttpsModule
    })

    const { httpsGet } = await importUnderTest()
    const buf = await httpsGet<Buffer>(new URL('https://files.example.com/asset.bin'))
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.toString('utf-8')).toBe('hello world')
  })

  it('rejects on request error event', async () => {
    useHttpsMock(() => {
      const req = new EventEmitter()

      const https: HttpsModule = {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        get: (_url, _cb) => {
          // Do not call cb; emit error from request
          setImmediate(() => {
            req.emit('error', new Error('network-failure'))
          })
          return {
            on: (event: string, handler: (err: Error) => void) => {
              req.on(event, handler)
              return req
            },
          }
        },
      }
      return https as unknown as HttpsModule
    })

    const { httpsGet } = await importUnderTest()
    await expect(httpsGet('https://down.example.org')).rejects.toThrow(/Error making request: network-failure/i)
  })

  it('accepts both string and URL inputs', async () => {
    let calledWith: any
    useHttpsMock(() => {
      const req = new EventEmitter()

      const https: HttpsModule = {
        get: (url, cb) => {
          calledWith = url
          const res = new EventEmitter()
          ;(res as any).headers = { 'content-type': 'application/json' }
          setImmediate(() => {
            cb(res)
            ;(res as any).emit('data', Buffer.from('{"ok":true}'))
            ;(res as any).emit('end')
          })
          return {
            on: (event: string, handler: (err: Error) => void) => {
              req.on(event, handler)
              return req
            },
          }
        },
      }
      return https as unknown as HttpsModule
    })

    const { httpsGet } = await importUnderTest()
    const res1 = await httpsGet('https://a.example/a')
    expect(res1).toEqual({ ok: true })
    expect(calledWith).toBe('https://a.example/a')

    const res2 = await httpsGet(new URL('https://b.example/b'))
    expect(res2).toEqual({ ok: true })
    // In second call, calledWith should have been overwritten with URL instance
    expect(calledWith).toBeInstanceOf(URL)
  })
})