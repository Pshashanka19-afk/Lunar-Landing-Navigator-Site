declare module 'timecraftjs' {
  export class Spice {
    public init(): Promise<Spice>;
    public erract(op: string, action?: string): string;
    public errprt(op: string, list?: string): string;
    public failed(): number;
    public getmsg(option: string): string;
    public reset(): void;
    public loadKernel(buffer: ArrayBuffer | Uint8Array | Buffer, key?: string | null): void;
    public unloadKernel(key: string): void;
    public furnsh(kernelPath: string): void;
    public unload(kernelPath: string): void;
    public utc2et(utc: string): number;
    public et2utc(et: number, format?: string, prec?: number): string;
    public str2et(str: string): number;
    public spkpos(
      targ: string,
      et: number,
      ref: string,
      abcorr: string,
      obs: string
    ): { ptarg: [number, number, number]; lt: number };
  }
}
