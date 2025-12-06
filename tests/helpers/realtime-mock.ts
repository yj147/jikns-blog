import { vi } from "vitest"

type StatusHandler = (status: string) => void
type ChangeHandler = (payload: any) => void

interface MockChannel {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  emitStatus: (status: string) => void
  emitChange: (payload: any) => Promise<unknown> | void
}

export interface SupabaseRealtimeMock {
  supabase: any
  channels: MockChannel[]
  tables: Record<string, Record<string, any>>
}

export function createSupabaseRealtimeMock(): SupabaseRealtimeMock {
  const channels: MockChannel[] = []
  const tables: Record<string, Record<string, any>> = {}

  const ensureTable = (name: string) => {
    if (!tables[name]) {
      tables[name] = {}
    }
    return tables[name]
  }

  const createChannel = (): MockChannel => {
    let statusHandler: StatusHandler | null = null
    let changeHandler: ChangeHandler | null = null

    const channel: MockChannel = {
      on: vi.fn((_event, _filter, cb: ChangeHandler) => {
        changeHandler = cb
        return channel
      }),
      subscribe: vi.fn((cb: StatusHandler) => {
        statusHandler = cb
        return channel
      }),
      emitStatus: (status: string) => {
        statusHandler?.(status)
      },
      emitChange: (payload: any) => {
        return changeHandler?.(payload)
      },
    }

    channels.push(channel)
    return channel
  }

  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "user-1" }, expires_at: Date.now() / 1000 + 3600 } },
        error: null,
      })),
    },
    channel: vi.fn(() => createChannel()),
    removeChannel: vi.fn(),
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const builder = {
          eq: vi.fn((_field: string, id: string) => ({
            single: vi.fn(async () => ({
              data: ensureTable(table)[id] ?? null,
              error: null,
            })),
          })),
          in: vi.fn(async (_field: string, ids: string[]) => ({
            data: ids
              .map((id) => ensureTable(table)[id])
              .filter(Boolean),
            error: null,
          })),
        }
        return builder
      }),
    })),
  }

  return { supabase, channels, tables }
}
