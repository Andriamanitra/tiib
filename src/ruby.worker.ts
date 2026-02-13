import { RubyVM } from "@ruby/wasm-wasi/dist/vm";
import { ConsoleStdout, File, OpenFile, WASI } from "@bjorn3/browser_wasi_shim";
import rubyWasmUrl from "@ruby/4.0-wasm-wasi/dist/ruby+stdlib.wasm?url";
import type { RunParams, RunResult } from "./exec";

const RUBY_WASM_MODULE: Promise<WebAssembly.Module> = WebAssembly.compileStreaming(fetch(rubyWasmUrl));

async function runRuby(params: RunParams): Promise<RunResult> {
  const { code, args, input } = params;
  const utf8 = new TextEncoder();
  const stdoutOutput: string[] = [];
  const stderrOutput: string[] = [];
  const module = await RUBY_WASM_MODULE;
  const stdin = new OpenFile(new File(utf8.encode(input)));
  const stdout = ConsoleStdout.lineBuffered((msg) => stdoutOutput.push(msg));
  const stderr = ConsoleStdout.lineBuffered((msg) => stderrOutput.push(msg));
  const wasip1 = new WASI([], [], [stdin, stdout, stderr]);
  const { vm } = await RubyVM.instantiateModule({ module, wasip1 });
  vm.eval(`
        $0 = "solution.rb"
        ARGS = ${JSON.stringify(args)}
    `);
  let exitcode = -1;
  try {
    const ret = vm.eval(code);
    console.log({ ret });
    exitcode = 0;
  } catch (err) {
    stderrOutput.push(String(err));
    exitcode = 1;
  }
  return {
    exitcode,
    stdout: stdoutOutput.join("\n"),
    stderr: stderrOutput.join("\n"),
  };
}

addEventListener("message", async (ev: MessageEvent<RunParams>) => {
  const response: RunResult = await runRuby(ev.data);
  postMessage(response);
});
