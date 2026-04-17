declare module "@prisma/client" {
  export interface PrismaClient {
    $queryRaw: (...args: unknown[]) => Promise<unknown>;
    $executeRaw: (...args: unknown[]) => Promise<unknown>;
    $queryRawUnsafe: (...args: unknown[]) => Promise<unknown>;
    $transaction: <T = unknown>(
      fnOrQueries: ((tx: Prisma.TransactionClient) => Promise<T>) | Prisma.PrismaPromise<unknown>[],
      options?: unknown,
    ) => Promise<T>;
  }

  export namespace Prisma {
    export type PrismaPromise<T> = Promise<T>;
    export type TransactionClient = PrismaClient;
  }
}
