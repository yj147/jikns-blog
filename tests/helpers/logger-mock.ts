import { vi } from "vitest"

export type LoggerMock = ReturnType<typeof createLoggerMock>
export type LoggerModuleMock = ReturnType<typeof createLoggerModuleMock>

export function createLoggerMock() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    setContext: vi.fn(),
    clearContext: vi.fn(),
    time: vi.fn(() => vi.fn()),
    http: vi.fn(),
    auth: vi.fn(),
    db: vi.fn(),
    security: vi.fn(),
  } as any

  logger.child = vi.fn(() => logger)

  return logger as {
    debug: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    fatal: ReturnType<typeof vi.fn>
    setContext: ReturnType<typeof vi.fn>
    clearContext: ReturnType<typeof vi.fn>
    time: ReturnType<typeof vi.fn>
    http: ReturnType<typeof vi.fn>
    auth: ReturnType<typeof vi.fn>
    db: ReturnType<typeof vi.fn>
    security: ReturnType<typeof vi.fn>
    child: ReturnType<typeof vi.fn>
  }
}

export function createLoggerModuleMock() {
  const logger = createLoggerMock()

  const log = {
    debug: vi.fn((message: string, ...args: any[]) => logger.debug(message, args)),
    info: vi.fn((message: string, ...args: any[]) => logger.info(message, args)),
    warn: vi.fn((message: string, ...args: any[]) => logger.warn(message, args)),
    error: vi.fn((message: string, ...args: any[]) => logger.error(message, args)),
  }

  return {
    logger,
    createLogger: vi.fn(() => logger),
    middlewareLogger: logger,
    apiLogger: logger,
    authLogger: logger,
    dbLogger: logger,
    securityLogger: logger,
    commentsLogger: logger,
    logCommentOperation: vi.fn(),
    log,
  }
}
