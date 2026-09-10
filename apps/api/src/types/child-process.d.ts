// @types/node in this Bun toolchain omits EventEmitter members on ChildProcess.
import "node:child_process";
declare module "node:child_process" {
  interface ChildProcess {
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  }
}
