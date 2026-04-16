import { AsyncLocalStorage } from "async_hooks";
import type { IContextProvider } from "./types";

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

/**
 * Safe read of optional context provider (never throws).
 */
export const resolveDetectorContext = (
  contextProvider?: IContextProvider,
): { requestId?: string; userId?: string } => {
  try {
    return contextProvider?.getContext() ?? {};
  } catch {
    return {};
  }
};
