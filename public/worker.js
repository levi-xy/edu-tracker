// Runs student Python in a Web Worker so an infinite loop can be killed from the page.
importScripts('/pyodide/pyodide.js');

const HARNESS = `
import sys, io, json, builtins, traceback, contextlib

def _exec(code, lines, echo, name):
    out, err = io.StringIO(), io.StringIO()
    it = iter(lines)
    def _input(prompt=""):
        if echo:
            out.write(str(prompt))
        try:
            v = next(it)
        except StopIteration:
            raise EOFError("EOF when reading a line")
        if echo:
            out.write(v + "\\n")
        return v
    b = dict(vars(builtins))
    b["input"] = _input
    g = {"__name__": name, "__builtins__": b}
    error = None
    old_in = sys.stdin
    sys.stdin = io.StringIO("\\n".join(lines) + "\\n")
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            try:
                exec(compile(code, "main.py", "exec"), g)
            except SystemExit as e:
                if e.code not in (None, 0):
                    err.write(str(e.code) + "\\n")
            except BaseException as e:
                tb = e.__traceback__.tb_next if e.__traceback__ else None
                error = "".join(traceback.format_exception(type(e), e, tb)).rstrip()
    finally:
        sys.stdin = old_in
    return g, out.getvalue(), err.getvalue(), error

def _norm(s):
    lines = [l.rstrip() for l in s.replace("\\r\\n", "\\n").split("\\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\\n".join(lines)

def _lines(s):
    parts = s.split("\\n")
    if parts and parts[-1] == "":
        parts.pop()
    return parts

def _handle(raw):
    p = json.loads(raw)
    if p["mode"] == "run":
        _, out, err, error = _exec(p["code"], _lines(p.get("stdin", "")), True, "__main__")
        text = out + err
        if error:
            text += ("" if text.endswith("\\n") or not text else "\\n") + error
        return json.dumps({"output": text, "error": bool(error)})
    results = []
    for t in p["tests"]:
        check = t.get("check")
        g, out, err, error = _exec(p["code"], _lines(t.get("stdin", "")), False, "solution" if check else "__main__")
        r = {"name": t.get("name", "test"), "ok": False, "stdin": t.get("stdin", ""), "expected": t.get("stdout"), "got": out}
        if error:
            r["error"] = error
        elif check:
            try:
                exec(compile(check, "<check>", "exec"), g)
                r["ok"] = True
            except BaseException as e:
                src = check.splitlines()
                tb = traceback.extract_tb(e.__traceback__)
                line = ""
                for fr in tb:
                    if fr.filename == "<check>" and 0 < fr.lineno <= len(src):
                        line = src[fr.lineno - 1]
                r["error"] = (line + "\\n" if line else "") + type(e).__name__ + (": " + str(e) if str(e) else "")
        else:
            r["ok"] = _norm(out) == _norm(t.get("stdout", ""))
        results.append(r)
    return json.dumps({"results": results})
`;

const ready = loadPyodide({ indexURL: '/pyodide/' }).then((py) => {
  py.runPython(HARNESS);
  postMessage({ ready: true });
  return py;
}).catch((e) => postMessage({ fatal: String(e) }));

self.onmessage = async (e) => {
  const { id, payload } = e.data;
  try {
    const py = await ready;
    py.globals.set('_payload', JSON.stringify(payload));
    const out = py.runPython('_handle(_payload)');
    postMessage({ id, result: JSON.parse(out) });
  } catch (err) {
    postMessage({ id, failure: String(err) });
  }
};
