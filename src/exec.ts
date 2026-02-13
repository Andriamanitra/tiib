import { JsExecutor } from "./javascript";
import LuaWorker from "./lua.worker.ts?worker";
import PythonWorker from "./python.worker.ts?worker";
import RubyWorker from "./ruby.worker.ts?worker";

export type RunParams = {
  language: string;
  code: string;
  args: string[];
  input: string;
};

export type RunResult = {
  exitcode: number;
  stdout: string;
  stderr: string;
  return_value?: any;
};

export interface LanguageExecutor {
  language: string;
  execute(params: RunParams): Promise<RunResult>;
}

function webWorkerExecutor(language: string, mkWorker: () => Worker, timeout_seconds: number = 5.0): LanguageExecutor {
  let worker = mkWorker();
  const timeout_milliseconds = 1000 * timeout_seconds;
  return {
    language,
    execute(params: RunParams): Promise<RunResult> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          worker.terminate();
          reject(new Error("Execution timed out"));
          worker = mkWorker();
        }, timeout_milliseconds);
        const listener = (ev: MessageEvent<RunResult>) => {
          cleanup();
          resolve(ev.data);
        };
        const cleanup = () => {
          clearTimeout(timeout);
          worker.removeEventListener("message", listener);
        };
        worker.addEventListener("message", listener);
        worker.postMessage(params);
      });
    },
  };
}

export const executors: { readonly [language: string]: LanguageExecutor } = {
  "js": new JsExecutor(),
  "lua": webWorkerExecutor("lua", () => new LuaWorker()),
  "python": webWorkerExecutor("python", () => new PythonWorker()),
  "ruby": webWorkerExecutor("ruby", () => new RubyWorker()),
};
