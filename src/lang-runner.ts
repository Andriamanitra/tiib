import { loadPyodide, type PyodideAPI } from 'pyodide';
import { LuaFactory } from 'wasmoon';
import { RubyVM } from '@ruby/wasm-wasi/dist/vm';
import { WASI, File, OpenFile, ConsoleStdout } from "@bjorn3/browser_wasi_shim";
import rubyWasmUrl from "@ruby/4.0-wasm-wasi/dist/ruby+stdlib.wasm?url";


type RunParams = {
    code: string;
    args: string[];
    input: string;
}
type RunResult = {
    exitcode: number;
    stdout: string;
    stderr: string;
}

function lineReader(input: string) {
    if (input.length === 0) {
        return () => null
    } else {
        const inputLines = input.split("\n").reverse();
        return () => inputLines.pop() || null
    }
}

const PYTHON_FILENAME = "solution.py"
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
                pass`)
    let exitcode = -1;
    try {
        const ret = pyodide.runPython(code, { filename: PYTHON_FILENAME, globals: pyodide.globals, locals: pyodide.globals });
        console.log({ret});
        exitcode = 0;
    } catch (err) {
        stderrOutput.push(String(err));
        exitcode = 1;
    }
    return {
        exitcode,
        stdout: stdoutOutput.join("\n"),
        stderr: stderrOutput.join("\n"),
    }
}

const RUBY_WASM_MODULE: Promise<WebAssembly.Module> = WebAssembly.compileStreaming(fetch(rubyWasmUrl));
async function runRuby(params: RunParams): Promise<RunResult> {
    const { code, args, input } = params;
    const utf8 = new TextEncoder();
    const stdoutOutput: string[] = [];
    const stderrOutput: string[] = [];
    const module = await RUBY_WASM_MODULE;
    const stdin = new OpenFile(new File(utf8.encode(input)));
    const stdout = ConsoleStdout.lineBuffered(msg => stdoutOutput.push(msg));
    const stderr = ConsoleStdout.lineBuffered(msg => stderrOutput.push(msg));
    const wasip1 = new WASI([], [], [stdin, stdout, stderr]);
    const { vm } = await RubyVM.instantiateModule({ module, wasip1 });
    vm.eval(`
        $0 = "solution.rb"
        ARGS = ${JSON.stringify(args)}
    `);
    let exitcode = -1;
    try {
        const ret = vm.eval(code);
        console.log({ret});
        exitcode = 0;
    } catch (err) {
        stderrOutput.push(String(err));
        exitcode = 1;
    }
    return {
        exitcode,
        stdout: stdoutOutput.join("\n"),
        stderr: stderrOutput.join("\n"),
    }
}

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
    lua.doString(`
        arg = {[0] = "solution.lua", ${args.map(a => JSON.stringify(a)).join(",")}}
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
        `)
    let exitcode = -1;
    try {
        const ret = await lua.doFile("solution.lua");
        console.log({ret});
        exitcode = 0;
    } catch (err) {
        stderrOutput.push(String(err))
        exitcode = 1;
    } finally {
        lua.global.close();
    }
    return {
        exitcode,
        stdout: stdoutOutput.join("\n"),
        stderr: stderrOutput.join("\n"),
    }
}

function runJs(params: RunParams): RunResult {
    const { code, args, input } = params;
    const stdoutOutput: string[] = [];
    const stderrOutput: string[] = [];
    const outputTo = (sink: string[]) => {
        return (...args: any) => {
            let line = args.map((a: any): string => {
                if (a instanceof Error) return String(a);
                switch (typeof a) {
                    case "string":
                        return a
                    case "object":
                        return JSON.stringify(a)
                    default:
                        return String(a)
                }
            }).join(" ");
            sink.push(line);
        }
    };
    const evalInFreshContext = (src: string) => {
        const iframe = document.createElement("iframe");
        iframe.sandbox = "allow-scripts allow-same-origin";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        try {
            const ret = iframe.contentWindow?.window.Function("ARGS", "print", "eprint", "readline", src)(
                args,
                outputTo(stdoutOutput),
                outputTo(stderrOutput),
                lineReader(input)
            );
            console.log({ret});
        } finally {
            document.body.removeChild(iframe);
        }
    };
    let exitcode = -1;
    try {
        evalInFreshContext(code);
        exitcode = 0;
    } catch (err) {
        stderrOutput.push(String(err));
        exitcode = 1;
    }
    return {
        exitcode,
        stdout: stdoutOutput.join("\n"),
        stderr: stderrOutput.join("\n"),
    }
}

export async function run(language: string | null, params: RunParams) {
    switch (language) {
        case "js":
            return runJs(params);
        case "python":
            return await runPython(params);
        case "ruby":
            return await runRuby(params);
        case "lua":
            return runLua(params);
        default:
            throw new Error(`no runner for '${language}'`)
    }
}
