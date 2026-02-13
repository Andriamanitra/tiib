import { LuaFactory } from "wasmoon";
import type { RunParams, RunResult } from "./exec";

async function runLua(params: RunParams): Promise<RunResult> {
  const { code, args, input } = params;
  const stdoutOutput: string[] = [];
  const stderrOutput: string[] = [];
  const factory = new LuaFactory();
  factory.mountFile("solution.lua", code);
  factory.mountFile("JS_input", input);
  const lua = await factory.createEngine();
  lua.global.set("JS_stdout", (msg: any) => stdoutOutput.push(String(msg)));
  lua.global.set("JS_stderr", (msg: any) => stderrOutput.push(String(msg)));
  const argsStr = args.map((a) => JSON.stringify(a)).join(", ");
  lua.doString(`
        arg = {[0] = "solution.lua", ${argsStr}}
        function print(...)
            local args = table.pack(...)
            for i = 1, args.n do
                args[i] = tostring(args[i])
            end
            JS_stdout(table.concat(args, "\\t"))
        end
        function eprint(...)
            local args = table.pack(...)
            for i = 1, args.n do
                args[i] = tostring(args[i])
            end
            JS_stderr(table.concat(args, "\\t"))
        end
        io.input("JS_input")
        `);
  let exitcode = -1;
  try {
    const ret = await lua.doFile("solution.lua");
    console.log({ ret });
    exitcode = 0;
  } catch (err) {
    stderrOutput.push(String(err));
    exitcode = 1;
  } finally {
    lua.global.close();
  }
  return {
    exitcode,
    stdout: stdoutOutput.join("\n"),
    stderr: stderrOutput.join("\n"),
  };
}

addEventListener("message", async (ev: MessageEvent<RunParams>) => {
  const response: RunResult = await runLua(ev.data);
  postMessage(response);
});
