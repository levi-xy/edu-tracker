// Known-correct and deliberately wrong solutions, used to prove each grader passes
// right answers and rejects wrong ones.
export const refs = {
  'w0-indoor-voice': {
    good: 'print(input().lower())',
    bad: ['print(input())', 'print(input().upper())'],
  },
  'w0-playback-speed': {
    good: 'print(input().replace(" ", "..."))',
    bad: ['print(input())', 'print(input().replace(" ", ".."))'],
  },
  'w0-making-faces': {
    good: 'def convert(t):\n    return t.replace(":)", "🙂").replace(":(", "🙁")\ndef main():\n    print(convert(input()))\nif __name__ == "__main__":\n    main()',
    bad: ['def main():\n    print(input().replace(":)", "🙂"))\nmain()', 'def convert(t):\n    return t\ndef main():\n    print(convert(input()))\nmain()'],
  },
  'w0-einstein': {
    good: 'm = int(input())\nprint(m * 300000000 ** 2)',
    bad: ['m = int(input())\nprint(m * 300000000)', 'm = int(input())\nprint(float(m * 300000000 ** 2))'],
  },
  'w0-tip-calculator': {
    good: 'def main():\n    d = dollars_to_float(input())\n    p = percent_to_float(input())\n    print(f"Leave ${d * p:.2f}")\ndef dollars_to_float(d):\n    return float(d.replace("$", ""))\ndef percent_to_float(p):\n    return float(p.replace("%", "")) / 100\nif __name__ == "__main__":\n    main()',
    bad: ['d = float(input().replace("$", ""))\np = float(input().replace("%", ""))/100\nprint(f"Leave ${d*p:.2f}")', 'def main():\n    print("Leave $0.00")\ndef dollars_to_float(d):\n    return 0\ndef percent_to_float(p):\n    return 0\nmain()'],
  },
  'w1-deep-thought': {
    good: 'a = input().strip().lower()\nprint("Yes" if a in ("42", "forty-two", "forty two") else "No")',
    bad: ['print("Yes" if input() == "42" else "No")', 'print("Yes")'],
  },
  'w1-home-federal': {
    good: 'g = input().strip().lower()\nif g.startswith("hello"):\n    print("$0")\nelif g.startswith("h"):\n    print("$20")\nelse:\n    print("$100")',
    bad: ['g = input().lower()\nif g.startswith("hello"):\n    print("$0")\nelif g.startswith("h"):\n    print("$20")\nelse:\n    print("$100")', 'print("$100")'],
  },
  'w1-file-extensions': {
    good: 'f = input().strip().lower()\nm = {"gif":"image/gif","jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","pdf":"application/pdf","txt":"text/plain","zip":"application/zip"}\next = f.rsplit(".", 1)[-1] if "." in f else ""\nprint(m.get(ext, "application/octet-stream"))',
    bad: ['f = input().lower()\nprint("image/gif" if "gif" in f else "application/octet-stream")', 'f = input().strip()\nprint("image/jpeg" if f.endswith(".jpg") else "application/octet-stream")'],
  },
  'w1-math-interpreter': {
    good: 'x, op, y = input().split(" ")\nx, y = float(x), float(y)\nr = {"+": x+y, "-": x-y, "*": x*y, "/": x/y}[op]\nprint(f"{r:.1f}")',
    bad: ['x, op, y = input().split(" ")\nprint(int(x) + int(y))', 'x, op, y = input().split(" ")\nx, y = float(x), float(y)\nprint(x+y)'],
  },
  'w1-meal-time': {
    good: 'def main():\n    t = convert(input().strip())\n    if 7 <= t <= 8:\n        print("breakfast time")\n    elif 12 <= t <= 13:\n        print("lunch time")\n    elif 18 <= t <= 19:\n        print("dinner time")\ndef convert(time):\n    h, m = time.split(":")\n    return int(h) + int(m) / 60\nif __name__ == "__main__":\n    main()',
    bad: ['def main():\n    t = convert(input())\n    if 7 <= t < 8:\n        print("breakfast time")\n    elif 12 <= t <= 13:\n        print("lunch time")\n    elif 18 <= t <= 19:\n        print("dinner time")\ndef convert(time):\n    h, m = time.split(":")\n    return int(h) + int(m) / 60\nmain()', 'print("lunch time")'],
  },
  'w2-camel-case': {
    good: 'o = ""\nfor c in input():\n    o += "_" + c.lower() if c.isupper() else c\nprint(o)',
    bad: ['print(input().lower())', 'print(input().replace("N", "_n"))'],
  },
  'w2-coke-machine': {
    good: 'due = 50\nwhile due > 0:\n    print(f"Amount Due: {due}")\n    c = int(input())\n    if c in (25, 10, 5):\n        due -= c\nprint(f"Change Owed: {-due}")',
    bad: ['due = 50\nwhile due > 0:\n    print(f"Amount Due: {due}")\n    due -= int(input())\nprint(f"Change Owed: {-due}")', 'due = 50\nwhile due > 0:\n    print(f"Amount Due: {due}")\n    c = int(input())\n    if c in (25, 10, 5):\n        due -= c\nprint("Change Owed: 0")'],
  },
  'w2-twttr': {
    good: 'print("".join(c for c in input() if c.lower() not in "aeiou"))',
    bad: ['print(input().replace("a", "").replace("e", "").replace("i", "").replace("o", "").replace("u", ""))', 'print(input())'],
  },
};
