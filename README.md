# tiib - try it in browser

just a little something to execute code on the client side in the browser

maybe a base for a coding minigame platform of some sort


## how?

using js and wasm:

* js is eval'd in an iframe to get a fresh namespace
* lua uses [wasmoon](https://github.com/ceifa/wasmoon)
* python uses [pyodide](https://pyodide.org/)
* ruby will use [ruby.wasm](https://github.com/ruby/ruby.wasm)

you can try it out:

```console
$ deno install    # install dependencies
$ deno run dev    # live preview in browser
$ deno run build  # build static website under dist/
```
