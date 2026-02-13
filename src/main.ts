import './style.css';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { RunParams, RunResult } from './exec.ts';
import { executors } from './exec.ts';

function clamp(v: number, min: number, max: number): number {
  return Math.max(Math.min(v, max), min);
}

function output(elem: HTMLElement, str: string) {
  elem.innerHTML = "";
  elem.classList.toggle("hidden", str.length === 0);
  if (str.length === 0) return;
  const term = new Terminal({
    convertEol: true,
    disableStdin: true,
    cursorBlink: false,
    cursorStyle: 'block',
    cursorInactiveStyle: 'none',
  });
  term.open(elem);
  const lengths = str.split("\n").map(line => line.length);
  term.resize(clamp(1 + Math.max(...lengths), 60, 100), lengths.length);
  term.write(str);
}

function getArgs(): string[] {
  const argElements = [...document.querySelectorAll("#cli-args input[type=text]")] as HTMLInputElement[];
  return argElements.map(el => el.value);
}

const inputEl = document.getElementById("stdin") as HTMLTextAreaElement;

function initLanguage(language: string, solutionEl: HTMLTextAreaElement, stdoutEl: HTMLElement, stderrEl: HTMLElement) {
  solutionEl.addEventListener("input", async () => {
    const request: RunParams = {
      language,
      code: solutionEl.value,
      args: getArgs(),
      input: inputEl.value,
    };
    executors[language].execute(request)
      .then((result: RunResult) => {
        solutionEl.classList.toggle("error", result.exitcode !== 0);
        output(stdoutEl, result.stdout);
        output(stderrEl, result.stderr);
      })
      .catch((err: Error) => {
        solutionEl.classList.add("error");
        output(stdoutEl, "");
        output(stderrEl, err.message);
      });
  })
}

for (const section of document.getElementsByClassName("lang")) {
  const solutionEl = section.querySelector("textarea") as HTMLTextAreaElement;
  const stdoutEl = section.querySelector(".stdout") as HTMLElement;
  const stderrEl = section.querySelector(".stderr") as HTMLElement;
  const language = solutionEl.getAttribute("data-lang");
  if (typeof language === "string") {
    initLanguage(language, solutionEl, stdoutEl, stderrEl);
  } else {
    console.error("solution element missing data-lang attribute", solutionEl);
  }
}

const rmArgButton = document.getElementById("rm-arg") as HTMLButtonElement;
rmArgButton.addEventListener("click", () => {
  const argElements = [...document.querySelectorAll("#cli-args input[type=text]")];
  const lastArg = argElements.pop();
  if (lastArg) lastArg.remove();
  rmArgButton.disabled = argElements.length === 0;
});

document.getElementById("add-arg")?.addEventListener("click", () => {
  const argElements = [...document.querySelectorAll("#cli-args input[type=text]")];
  const newArg = document.createElement("input");
  const newArgId = `arg${1 + argElements.length}`;
  newArg.type = "text";
  newArg.name = newArgId;
  newArg.id = newArgId;
  newArg.value = newArgId;
  rmArgButton.disabled = false;
  document.getElementById("cli-args")?.append(newArg);
});
