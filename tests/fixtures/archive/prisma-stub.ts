const prismaProxy: Record<string, unknown> = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Prisma client is stubbed in archive tests. Use vi.mock to provide a mock implementation."
      )
    },
  }
)

export const prisma = prismaProxy
export default prismaProxy
