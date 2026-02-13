import { loadPyodide, type PyodideAPI } from "pyodide";
import type { RunParams, RunResult } from "./exec";

function lineReader(input: string) {
  if (input.length === 0) {
    return () => null;
  } else {
    const inputLines = input.split("\n").reverse();
    return () => inputLines.pop() || null;
  }
}

const PYTHON_FILENAME = "solution.py";
const PYODIDE: Promise<PyodideAPI> = loadPyodide({ args: [PYTHON_FILENAME] });

async function runPython(params: RunParams): Promise<RunResult> {
  const { code, args, input } = params;
  const stdoutOutput: string[] = [];
  const stderrOutput: string[] = [];
  const pyodide = await PYODIDE;
  pyodide.setStdout({ batched: (output: string) => stdoutOutput.push(output) });
  pyodide.setStderr({ batched: (output: string) => stderrOutput.push(output) });
  pyodide.setStdin({ stdin: lineReader(input) });
  pyodide.runPython(`
        __import__("sys").argv[1:] = ${JSON.stringify(args)}
        for _name in [k for k in globals().keys() if not k.startswith('_')]:
            try:
                del globals()[_name]
            except:
                pass`);
  let exitcode = -1;
  try {
    const ret = pyodide.runPython(code, {
      filename: PYTHON_FILENAME,
      globals: pyodide.globals,
      locals: pyodide.globals,
    });
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
  const response: RunResult = await runPython(ev.data);
  postMessage(response);
});
