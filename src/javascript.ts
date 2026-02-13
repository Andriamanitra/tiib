import type { LanguageExecutor, RunParams, RunResult } from "./exec";

function lineReader(input: string) {
  if (input.length === 0) {
    return () => null;
  } else {
    const inputLines = input.split("\n").reverse();
    return () => inputLines.pop() || null;
  }
}

export class JsExecutor implements LanguageExecutor {
  language = "js";

  async execute(params: RunParams): Promise<RunResult> {
    const { code, args, input } = params;
    const stdoutOutput: string[] = [];
    const stderrOutput: string[] = [];
    const outputTo = (sink: string[]) => {
      return (...args: any) => {
        let line = args.map((a: any): string => {
          if (a instanceof Error) return String(a);
          switch (typeof a) {
            case "string":
              return a;
            case "object":
              return JSON.stringify(a);
            default:
              return String(a);
          }
        }).join(" ");
        sink.push(line);
      };
    };
    const evalInFreshContext = (src: string) => {
      const iframe = document.createElement("iframe");
      iframe.sandbox = "allow-scripts allow-same-origin";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      try {
        const ret = iframe.contentWindow?.window.Function(
          "ARGS",
          "print",
          "eprint",
          "readline",
          src,
        )(
          args,
          outputTo(stdoutOutput),
          outputTo(stderrOutput),
          lineReader(input),
        );
        console.log({ ret });
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
    };
  }
}
