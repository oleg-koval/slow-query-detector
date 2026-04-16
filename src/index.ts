export interface QuerydVersion {
  readonly name: "queryd";
  readonly version: string;
}

export const getVersion = (): QuerydVersion => {
  return {
    name: "queryd",
    version: "0.1.0",
  };
};
