// CS50P course outline. Lecture topics follow the public syllabus; exercise text is
// written fresh for this app. Course material (c) CS50 / Harvard, CC BY-NC-SA 4.0.
const BASE = 'https://cs50.harvard.edu/python/2022/';

const lecture = (n, title, topics, minutes = 90) => ({
  slug: `w${n}-lecture`,
  type: 'video',
  title: `Lecture ${n}: ${title}`,
  media: `lecture-${n}`,
  source: `${BASE}weeks/${n}/`,
  minutes,
  body: `## What this lecture covers\n\n${topics.map((t) => `- ${t}`).join('\n')}\n\n` +
    `Official lecture page and notes: [cs50.harvard.edu](${BASE}weeks/${n}/). ` +
    `Put the video file at \`media/lecture-${n}.mp4\` and it plays here.`,
});

const ex = (slug, title, body, starter, tests, minutes = 20) => ({
  slug, type: 'exercise', title, body, starter, tests, minutes,
  source: `${BASE}psets/${slug[1]}/`, // official problem page, where CS50's own check50 instructions live
});

const quiz = (slug, title, questions) => ({
  slug, type: 'quiz', title, minutes: 10, tests: questions,
  body: `${questions.length} quick questions on this lecture. Score 70% or better to pass. You can retake it as often as you like.`,
});

const pset = (n, intro, problems) => ({
  slug: `w${n}-pset`,
  type: 'pset',
  title: `Problem set ${n}`,
  source: `${BASE}psets/${n}/`,
  minutes: 120,
  body: `${intro}\n\n` +
    (problems.length ? `## Problems (as I recall them; check the official page for the exact list)\n\n${problems.map((p) => `- ${p}`).join('\n')}\n\n` : '') +
    `Work through these on your own machine, then open the official page: [Problem set ${n}](${BASE}psets/${n}/).\n\n` +
    `Auto-graded versions of these can be added to this app. When you finish the set, press Continue.`,
});

const MAIN = (extra = '') => `def main():\n    ${extra || '...'}\n\n\nif __name__ == "__main__":\n    main()\n`;

export default {
  slug: 'cs50p',
  title: "CS50's Introduction to Programming with Python",
  description: 'Harvard CS50P: ten weeks of Python fundamentals, from functions to object-oriented programming.',
  source: BASE,
  license: 'Course material © CS50 / Harvard University, licensed CC BY-NC-SA 4.0. Non-commercial use only.',
  ord: 0,
  modules: [
    {
      slug: 'cs50p-w0',
      title: 'Week 0: Functions, Variables',
      summary: 'Talking to the computer: print, input, variables, strings, and your first functions.',
      lessons: [
        lecture(0, 'Functions, Variables', [
          'Functions, arguments, and return values', 'Variables, comments, and pseudocode',
          'Strings, parameters, and f-strings', 'int and float, rounding, and formatting numbers', 'Defining your own functions',
        ]),
        quiz('w0-quiz', 'Quiz: Functions and variables', [
          { q: 'Which line stores what the user types as a whole number?', options: ['`x = input()`', '`x = int(input())`', '`x = str(input())`', '`x = print(input())`'], answer: 1, why: '`input()` always gives back text. Wrapping it in `int()` converts that text to a whole number.' },
          { q: 'What type of value does `input()` return?', options: ['`int`', '`float`', '`str`', '`bool`'], answer: 2, why: 'Even if the user types 42, `input()` returns the text "42". You convert it yourself.' },
          { q: 'What does `print(f"{3 + 4}")` show?', options: ['`7`', '`3 + 4`', '`{3 + 4}`', 'An error'], answer: 0, why: 'Inside an f-string, the expression between the braces is evaluated, so you get 7.' },
          { q: 'What does `print("1" + "2")` show?', options: ['`3`', '`12`', '`"12"` with quotes', 'An error'], answer: 1, why: 'Both values are text, so `+` joins them end to end. print shows the text without quotes.' },
          { q: 'With `name = "Ada"`, what does `print("Hi", name)` show?', options: ['`HiAda`', '`Hi, Ada`', '`Hi Ada`', '`Hi name`'], answer: 2, why: 'When print gets several values, it puts a single space between them.' },
          { q: 'What does `round(3.7)` return?', options: ['`3`', '`4`', '`3.7`', '`4.0`'], answer: 1, why: 'round with one argument gives the nearest whole number, as an int.' },
          { q: 'Which line correctly starts a function named `greet` that takes one parameter?', options: ['`function greet(name):`', '`def greet name:`', '`def greet(name):`', '`greet(name) = def:`'], answer: 2, why: 'A Python function starts with `def`, then the name, parentheses holding the parameters, and a colon.' },
        ]),
        ex('w0-indoor-voice', 'Indoor Voice',
          'Read one line of text and print it in lowercase, as if you were speaking quietly.\n\nExample: `HELLO` prints `hello`.',
          MAIN('text = input()\n    # print it quietly'),
          [
            { name: 'shouting', stdin: 'HELLO\n', stdout: 'hello\n' },
            { name: 'mixed case with digits', stdin: 'This Is CS50\n', stdout: 'this is cs50\n' },
            { name: 'punctuation', stdin: 'Wait, WHAT?\n', stdout: 'wait, what?\n' },
          ], 10),
        ex('w0-playback-speed', 'Playback Speed',
          'Read a line of text and print it with every space replaced by three dots.\n\nExample: `This is CS50` prints `This...is...CS50`.',
          MAIN(),
          [
            { name: 'three words', stdin: 'This is CS50\n', stdout: 'This...is...CS50\n' },
            { name: 'one word', stdin: 'Hello\n', stdout: 'Hello\n' },
            { name: 'two words', stdin: 'a b\n', stdout: 'a...b\n' },
          ], 10),
        ex('w0-making-faces', 'Making Faces',
          'Read a line of text and print it with `:)` swapped for 🙂 and `:(` swapped for 🙁.\n\n' +
          'Define a function `convert(text)` that returns the new text, and call it from `main`.',
          `def convert(text):\n    ...\n\n\ndef main():\n    ...\n\n\nif __name__ == "__main__":\n    main()\n`,
          [
            { name: 'smile', stdin: 'Hello :)\n', stdout: 'Hello 🙂\n' },
            { name: 'frown', stdin: "I'm sad :(\n", stdout: "I'm sad 🙁\n" },
            { name: 'both', stdin: 'Good :) day :(\n', stdout: 'Good 🙂 day 🙁\n' },
            { name: 'no faces', stdin: 'no faces here\n', stdout: 'no faces here\n' },
            { name: 'convert() returns text', check: 'assert convert("hi :)") == "hi 🙂"\nassert convert("x") == "x"' },
          ]),
        ex('w0-einstein', 'Einstein',
          'Read a mass in kilograms (a whole number) and print the energy in joules using E = m × c², where c = 300000000 metres per second.\n\nPrint a plain integer.',
          MAIN(),
          [
            { name: '1 kg', stdin: '1\n', stdout: '90000000000000000\n' },
            { name: '14 kg', stdin: '14\n', stdout: '1260000000000000000\n' },
            { name: '50 kg', stdin: '50\n', stdout: '4500000000000000000\n' },
          ], 10),
        ex('w0-tip-calculator', 'Tip Calculator',
          'Read the meal cost like `$50.00`, then the tip percentage like `15%`, and print how much to leave, like `Leave $7.50`.\n\n' +
          'Write two helpers:\n\n- `dollars_to_float(d)` turns `"$50.00"` into `50.0`\n- `percent_to_float(p)` turns `"15%"` into `0.15`',
          `def main():\n    dollars = dollars_to_float(input())\n    percent = percent_to_float(input())\n    tip = ...\n    print(f"Leave \${tip:.2f}")\n\n\ndef dollars_to_float(d):\n    ...\n\n\ndef percent_to_float(p):\n    ...\n\n\nif __name__ == "__main__":\n    main()\n`,
          [
            { name: 'fifteen percent', stdin: '$50.00\n15%\n', stdout: 'Leave $7.50\n' },
            { name: 'whole dollars', stdin: '$100\n20%\n', stdout: 'Leave $20.00\n' },
            { name: 'rounding', stdin: '$32.50\n18%\n', stdout: 'Leave $5.85\n' },
            { name: 'dollars_to_float', check: 'assert dollars_to_float("$50.00") == 50.0\nassert dollars_to_float("$3") == 3.0' },
            { name: 'percent_to_float', check: 'assert percent_to_float("15%") == 0.15\nassert percent_to_float("100%") == 1.0' },
          ]),
      ],
    },
    {
      slug: 'cs50p-w1',
      title: 'Week 1: Conditionals',
      summary: 'Making decisions: if, elif, else, boolean logic, and match.',
      lessons: [
        lecture(1, 'Conditionals', [
          'Comparison operators and if / elif / else', 'Control flow and the modulo operator', 'Boolean expressions with and / or', 'bool values and clean boolean returns', 'The match statement',
        ]),
        quiz('w1-quiz', 'Quiz: Conditionals', [
          { q: 'What is `7 % 2`?', options: ['`3`', '`3.5`', '`1`', '`0`'], answer: 2, why: '`%` is the remainder after division. 7 divided by 2 is 3 with 1 left over.' },
          { q: 'Which condition is true when `x` is anywhere from 1 to 10, including both ends?', options: ['`x >= 1 or x <= 10`', '`1 <= x <= 10`', '`1 < x < 10`', '`x = 1 to 10`'], answer: 1, why: 'Python lets you chain comparisons. The `or` version is true for every number, and `1 < x < 10` leaves out 1 and 10.' },
          { q: 'In an `if` / `elif` / `else` chain, the first two conditions are both true. What runs?', options: ['Both branches', 'Only the first true branch', 'Only the last branch', 'The `else` branch'], answer: 1, why: 'Python takes the first branch whose condition is true and skips the rest of the chain.' },
          { q: 'Why does `if x = 5:` fail?', options: ['`=` assigns a value, and `==` compares', 'Numbers cannot be compared', 'It needs parentheses', 'It needs `then`'], answer: 0, why: 'A single `=` stores a value. To ask "is x equal to 5?" you write `x == 5`.' },
          { q: 'What does `"yes" == "Yes"` evaluate to?', options: ['`True`', '`False`', 'An error', '`None`'], answer: 1, why: 'Text comparison is case sensitive. Use `.lower()` first if you want to ignore case.' },
          { q: 'Which expression is `True`?', options: ['`True and False`', '`False or False`', '`not False and True`', '`not True`'], answer: 2, why: '`not False` is True, and `True and True` is True. The others all evaluate to False.' },
          { q: 'In a `match` statement, what does `case _:` do?', options: ['It ends the program', 'It matches anything not matched above, like `else`', 'It matches only an underscore', 'It raises an error'], answer: 1, why: 'The underscore is a catch-all pattern, so it works as the default case.' },
        ]),
        ex('w1-deep-thought', 'Deep Thought',
          'Ask the user for the answer to the Great Question of Life, the Universe, and Everything. Print `Yes` if they answer `42`, `forty-two`, or `forty two`, in any capitalisation and ignoring spaces around it. Otherwise print `No`.',
          MAIN(),
          [
            { name: '42', stdin: '42\n', stdout: 'Yes\n' },
            { name: 'spaces and caps', stdin: ' Forty-Two \n', stdout: 'Yes\n' },
            { name: 'forty two', stdin: 'forty two\n', stdout: 'Yes\n' },
            { name: 'wrong number', stdin: '43\n', stdout: 'No\n' },
            { name: 'wrong text', stdin: 'hello\n', stdout: 'No\n' },
          ], 15),
        ex('w1-home-federal', 'Home Federal Savings Bank',
          'Read a greeting. Ignore leading spaces and capitalisation.\n\n- starts with `hello`: print `$0`\n- otherwise starts with `h`: print `$20`\n- anything else: print `$100`',
          MAIN(),
          [
            { name: 'hello', stdin: 'Hello\n', stdout: '$0\n' },
            { name: 'hello, newman', stdin: 'Hello, Newman\n', stdout: '$0\n' },
            { name: 'starts with h', stdin: 'How you doing?\n', stdout: '$20\n' },
            { name: 'something else', stdin: "What's happening?\n", stdout: '$100\n' },
            { name: 'leading space, upper case', stdin: ' HELLO there\n', stdout: '$0\n' },
          ], 15),
        ex('w1-file-extensions', 'File Extensions',
          'Read a file name and print its media type. Ignore capitalisation and surrounding spaces.\n\n' +
          '| Extension | Media type |\n|---|---|\n| .gif | image/gif |\n| .jpg, .jpeg | image/jpeg |\n| .png | image/png |\n| .pdf | application/pdf |\n| .txt | text/plain |\n| .zip | application/zip |\n\n' +
          'Anything else prints `application/octet-stream`.',
          MAIN(),
          [
            { name: 'gif', stdin: 'cat.gif\n', stdout: 'image/gif\n' },
            { name: 'upper case jpg', stdin: 'CAT.JPG\n', stdout: 'image/jpeg\n' },
            { name: 'jpeg', stdin: 'cat.jpeg\n', stdout: 'image/jpeg\n' },
            { name: 'png', stdin: 'cat.png\n', stdout: 'image/png\n' },
            { name: 'pdf', stdin: 'paper.pdf\n', stdout: 'application/pdf\n' },
            { name: 'txt', stdin: 'notes.txt\n', stdout: 'text/plain\n' },
            { name: 'zip', stdin: 'archive.zip\n', stdout: 'application/zip\n' },
            { name: 'no extension', stdin: 'README\n', stdout: 'application/octet-stream\n' },
            { name: 'extension in the middle', stdin: 'cat.gif.exe\n', stdout: 'application/octet-stream\n' },
          ]),
        ex('w1-math-interpreter', 'Math Interpreter',
          'Read an expression of the form `x op y` with spaces between the parts, where op is `+`, `-`, `*`, or `/`. Numbers may have decimals. Print the result with exactly one digit after the decimal point.\n\nExample: `1 + 1` prints `2.0`.',
          MAIN(),
          [
            { name: 'add', stdin: '1 + 1\n', stdout: '2.0\n' },
            { name: 'multiply', stdin: '2 * 3\n', stdout: '6.0\n' },
            { name: 'divide', stdin: '5 / 2\n', stdout: '2.5\n' },
            { name: 'subtract decimals', stdin: '10 - 3.5\n', stdout: '6.5\n' },
          ], 15),
        ex('w1-meal-time', 'Meal Time',
          'Read a time in 24-hour form like `7:30`.\n\nDefine `convert(time)` that returns the time as a number of hours, so `7:30` becomes `7.5`.\n\n' +
          'Print `breakfast time` for 7:00 to 8:00, `lunch time` for 12:00 to 13:00, and `dinner time` for 18:00 to 19:00, all inclusive. At any other time print nothing.',
          `def main():\n    ...\n\n\ndef convert(time):\n    ...\n\n\nif __name__ == "__main__":\n    main()\n`,
          [
            { name: 'breakfast', stdin: '7:00\n', stdout: 'breakfast time\n' },
            { name: 'breakfast middle', stdin: '7:30\n', stdout: 'breakfast time\n' },
            { name: 'breakfast end', stdin: '8:00\n', stdout: 'breakfast time\n' },
            { name: 'just after breakfast', stdin: '8:01\n', stdout: '' },
            { name: 'lunch', stdin: '12:30\n', stdout: 'lunch time\n' },
            { name: 'lunch end', stdin: '13:00\n', stdout: 'lunch time\n' },
            { name: 'just after lunch', stdin: '13:01\n', stdout: '' },
            { name: 'dinner', stdin: '18:45\n', stdout: 'dinner time\n' },
            { name: 'between meals', stdin: '17:59\n', stdout: '' },
            { name: 'convert()', check: 'assert convert("7:30") == 7.5\nassert convert("18:45") == 18.75\nassert convert("0:00") == 0' },
          ]),
      ],
    },
    {
      slug: 'cs50p-w2',
      title: 'Week 2: Loops',
      summary: 'Repeating work: while, for, lists, dictionaries, and breaking out of loops.',
      lessons: [
        lecture(2, 'Loops', [
          'while loops and counting', 'for loops and range', 'Lists and len', 'Dictionaries', 'break and continue, and looping over text',
        ]),
        quiz('w2-quiz', 'Quiz: Loops', [
          { q: 'What does `for i in range(3): print(i)` print?', options: ['`1 2 3`', '`0 1 2`', '`0 1 2 3`', '`3`'], answer: 1, why: '`range(3)` counts 0, 1, 2. It starts at 0 and stops before 3.' },
          { q: 'Which loop runs forever unless something inside stops it?', options: ['`while False:`', '`for i in range(0):`', '`while True:`', '`for i in []:`'], answer: 2, why: '`while True:` never becomes false, so it needs a `break` (or a return or exit) inside it.' },
          { q: 'What does `len([4, 5, 6])` return?', options: ['`3`', '`6`', '`15`', '`2`'], answer: 0, why: '`len` counts the items in the list. There are three.' },
          { q: 'What does `break` do inside a loop?', options: ['Skips to the next iteration', 'Leaves the loop immediately', 'Pauses the loop', 'Restarts the loop'], answer: 1, why: '`break` ends the nearest enclosing loop right away. Code after the loop then runs.' },
          { q: 'What does `continue` do inside a loop?', options: ['Ends the loop', 'Skips the rest of this pass and starts the next one', 'Runs the loop twice', 'Does nothing'], answer: 1, why: '`continue` jumps back to the top of the loop for the next iteration.' },
          { q: 'With `d = {"a": 1}`, what happens on `d["b"]`?', options: ['It returns `None`', 'It returns `0`', 'It raises a `KeyError`', 'It adds the key'], answer: 2, why: 'Looking up a missing key with square brackets raises KeyError. `d.get("b")` returns None instead.' },
          { q: 'What does `for c in "cat": print(c)` do?', options: ['Prints `cat` once', 'Prints `c`, `a`, `t` on separate lines', 'Prints `3`', 'Raises an error'], answer: 1, why: 'A string is a sequence of characters, so a for loop visits them one at a time.' },
        ]),
        ex('w2-camel-case', 'camelCase',
          'Read a variable name written in camelCase and print it in snake_case: each capital letter becomes an underscore followed by the lowercase letter.\n\nExample: `preferredFirstName` prints `preferred_first_name`.',
          MAIN(),
          [
            { name: 'two words', stdin: 'firstName\n', stdout: 'first_name\n' },
            { name: 'three words', stdin: 'preferredFirstName\n', stdout: 'preferred_first_name\n' },
            { name: 'one word', stdin: 'name\n', stdout: 'name\n' },
          ], 15),
        ex('w2-coke-machine', 'Coke Machine',
          'A coke costs 50 cents. The machine accepts coins of 25, 10, and 5 cents only.\n\n' +
          'Before each coin prompt, print `Amount Due: N`. Read a coin; ignore any other value, and print the same amount due again. Once the total is 50 or more, print `Change Owed: N` and stop.',
          MAIN(),
          [
            { name: 'two quarters', stdin: '25\n25\n', stdout: 'Amount Due: 50\nAmount Due: 25\nChange Owed: 0\n' },
            { name: 'exact in one go is impossible, 50 is ignored', stdin: '50\n25\n25\n', stdout: 'Amount Due: 50\nAmount Due: 50\nAmount Due: 25\nChange Owed: 0\n' },
            { name: 'mixed coins', stdin: '25\n10\n5\n10\n', stdout: 'Amount Due: 50\nAmount Due: 25\nAmount Due: 15\nAmount Due: 10\nChange Owed: 0\n' },
            { name: 'ignores invalid coins', stdin: '30\n25\n25\n', stdout: 'Amount Due: 50\nAmount Due: 50\nAmount Due: 25\nChange Owed: 0\n' },
            { name: 'gives change', stdin: '25\n10\n25\n', stdout: 'Amount Due: 50\nAmount Due: 25\nAmount Due: 15\nChange Owed: 10\n' },
          ], 25),
        ex('w2-twttr', "Just Setting Up My twttr",
          'Read a line of text and print it with every vowel (a, e, i, o, u, in either case) removed.\n\nExample: `Twitter` prints `Twttr`.',
          MAIN(),
          [
            { name: 'Twitter', stdin: 'Twitter\n', stdout: 'Twttr\n' },
            { name: 'with punctuation', stdin: "What's your name?\n", stdout: "Wht's yr nm?\n" },
            { name: 'no vowels', stdin: 'CS50\n', stdout: 'CS50\n' },
            { name: 'capitals', stdin: 'Hello, World\n', stdout: 'Hll, Wrld\n' },
            { name: 'plain', stdin: 'Python\n', stdout: 'Pythn\n' },
            { name: 'capital vowels', stdin: 'Owl, Eagle, Idea\n', stdout: 'wl, gl, d\n' },
          ], 15),
        pset(2, 'Four more problems for this week need your own machine or a later auto-graded version here, such as vanity plate rules and nutrition facts.', ['Vanity Plates', 'Nutrition Facts']),
      ],
    },
    {
      slug: 'cs50p-w3',
      title: 'Week 3: Exceptions',
      summary: 'Handling errors gracefully with try, except, and validated input.',
      lessons: [
        lecture(3, 'Exceptions', ['Syntax errors vs runtime errors', 'try, except, else', 'Handling ValueError and others', 'Asking again until the input is valid', 'pass, and raising your own errors']),
        pset(3, 'Practise catching bad input and re-prompting.', ["Fuel Gauge", "Felipe's Taqueria", 'Grocery List', 'Outdated']),
      ],
    },
    {
      slug: 'cs50p-w4',
      title: 'Week 4: Libraries',
      summary: 'Using the standard library, installing packages, and calling web APIs.',
      lessons: [
        lecture(4, 'Libraries', ['random and statistics', 'Command-line arguments with sys.argv', 'Packages from PyPI with pip', 'Calling APIs with requests and json', 'Making your own library']),
        pset(4, 'Libraries, command-line input, and an API call.', ['Emojize', 'Frame', 'Figlet', 'Adieu, Adieu', 'Guessing Game', 'Little Professor', 'Bitcoin Index']),
      ],
    },
    {
      slug: 'cs50p-w5',
      title: 'Week 5: Unit Tests',
      summary: 'Proving your code works with assert and pytest.',
      lessons: [
        lecture(5, 'Unit Tests', ['Why we test', 'assert', 'pytest and test files', 'Testing for exceptions', 'Organising tests in folders']),
        pset(5, 'Write tests, then fix the code they expose.', ['Testing my twttr', 'Back to the Bank', 'Re-requesting a Vanity Plate', 'Refueling']),
      ],
    },
    {
      slug: 'cs50p-w6',
      title: 'Week 6: File I/O',
      summary: 'Reading and writing files, CSV, and working with images.',
      lessons: [
        lecture(6, 'File I/O', ['open and with', 'Reading and writing text files', 'CSV with the csv module', 'Sorting', 'Binary files and images with Pillow']),
        pset(6, 'Files, CSV, and images.', ['Lines of Code', 'Pizza Py', 'Scourgify', 'CS50 P-Shirt']),
      ],
    },
    {
      slug: 'cs50p-w7',
      title: 'Week 7: Regular Expressions',
      summary: 'Pattern matching with the re module.',
      lessons: [
        lecture(7, 'Regular Expressions', ['re.search, re.match, re.fullmatch', 'Pattern syntax and special characters', 'Groups and flags', 're.sub and re.split', 'Validating and extracting data']),
        pset(7, 'Validate and extract text with patterns.', ['NUMB3RS', 'Watch on YouTube', 'Working 9 to 5', 'Regular, Um, Expressions', 'Response Validation']),
      ],
    },
    {
      slug: 'cs50p-w8',
      title: 'Week 8: Object-Oriented Programming',
      summary: 'Classes, objects, properties, and inheritance.',
      lessons: [
        lecture(8, 'Object-Oriented Programming', ['Classes and objects', 'Methods and instance variables', 'Properties, getters and setters', 'Class methods and static methods', 'Inheritance and operator overloading']),
        pset(8, 'Design small classes of your own. See the official page for this week\'s problem list.', []),
      ],
    },
    {
      slug: 'cs50p-w9',
      title: 'Week 9: Et Cetera',
      summary: 'Sets, type hints, argparse, comprehensions, generators, and more.',
      lessons: [
        lecture(9, 'Et Cetera', ['Sets and global variables', 'Constants and type hints', 'Docstrings and argparse', '*args and **kwargs, map, filter, comprehensions', 'enumerate, generators, and iterators']),
        pset(9, 'The last problem set. See the official page for the problem list.', []),
      ],
    },
    {
      slug: 'cs50p-final',
      title: 'Final Project',
      summary: 'Build something of your own in Python.',
      lessons: [
        {
          slug: 'final-project', type: 'pset', title: 'Your final project', minutes: 600,
          source: `${BASE}project/`,
          body: 'Pick a small program you actually want, ideally related to networking or security: a log parser, a port-check script, or an API client. ' +
            'Write a `project.py` with a `main` function and at least three other functions, plus a `test_project.py` that tests them.\n\n' +
            `Read the official requirements first: [Final Project](${BASE}project/). Press Continue when it is submitted.`,
        },
      ],
    },
  ],
};
