import { AsyncLocalStorage } from "async_hooks";

export type DbContext = {
  requestId?: string;
  userId?: string;
};

const dbContextStorage = new AsyncLocalStorage<DbContext>();

export const runWithDbContext = async <T>(context: DbContext, fn: () => Promise<T>): Promise<T> => {
  return await dbContextStorage.run(context, fn);
};

export const getDbContext = (): DbContext => {
  return dbContextStorage.getStore() ?? {};
};
