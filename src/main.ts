import './style.css'
import { run } from './lang-runner.ts'

function output(elem: HTMLElement, str: string) {
  elem.innerText = str;
  elem.classList.toggle("hidden", str.length === 0);
}

const inputEl = document.getElementById("stdin") as HTMLTextAreaElement;

for (const section of document.getElementsByClassName("lang")) {
  const solutionEl = section.querySelector("textarea") as HTMLTextAreaElement;
  const stdoutEl = section.querySelector(".stdout") as HTMLElement;
  const stderrEl = section.querySelector(".stderr") as HTMLElement;
  const lang = solutionEl.getAttribute("data-lang");
  solutionEl.addEventListener("input", async () => {
    const argElements = [...document.querySelectorAll("#cli-args input[type=text]")] as HTMLInputElement[];
    const args = argElements.map((el: HTMLInputElement) => el.value);
    const input = inputEl.value;
    const result = await run(lang, { code: solutionEl.value, args, input });
    console.log(result)
    if (result.exitcode !== 0) {
      solutionEl.classList.add("error");
    } else {
      solutionEl.classList.remove("error");
    }
    output(stdoutEl, result.stdout);
    output(stderrEl, result.stderr);
  })
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
