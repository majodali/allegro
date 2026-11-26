// Tests of next/ext/lib/meaning.alg. That the module is the one the
// bootstrap gives, by identity, for every text of the corpus, is
// next/ext/modules.ts and its test; here are the rules' own parts.
capability output
import allegretto
import engine
import meaning

p = engine.prepared(allegretto.language)
tree(text) => engine.parse(p, text)
// No shipped primitive and no imported module. Of Allegretto's own
// functions, the one every statement is written with, here of one line:
// a statement claims that its value is no failure.
own = tree("is_failure(x) => false\n")
nothing = {shipped: [], modules: [], own: own}
module(text) => meaning.module_of(tree(text), nothing)

// A module is a function of no parameter where the text has no header line.
m = module("x = 2\nexport y = [x, x]\n")
claim(!is_failure(m) && m.keys == 0 && count(m.declares) == 0)
claim(m.description.form == `function && m.description.parameters == 0)
// The kernel builds the function, and applied it yields what the text exports.
claim(count(build(m.description, {})().y) == 2 && build(m.description, {})().y[1] == 2)

// Each header line is a parameter: the keys first, and `declares` says what each of the others is.
h = module("capability output\ninput n\nkey k\nexport f() => n\n")
claim(!is_failure(h) && h.keys == 1 && h.description.parameters == 3)
claim(count(h.declares) == 2 && h.declares[0].role == "capability" && h.declares[0].name == "output" && h.declares[1].role == "input" && h.declares[1].name == "n")

// A parameter is written by how many functions out it is and its place: `a` of the outer function, from the inner, is one out.
f = module("export f(a, b) => (c) => b\n")
inner = f.description.body.arguments[0].entries.f.body
claim(inner.form == `function && inner.body.form == `param && inner.body.function == 1 && inner.body.index == 1)

// A name nothing binds is a finding, with its place; so is a name bound twice in one block.
u = module("x = 1\n[x, nowhere]\n")
claim(is_failure(u) && u.failure == `not_a_module && count(u.findings) == 1)
claim(u.findings[0].message == "the name nowhere is bound nowhere in the text" && u.findings[0].at.start.line == 2 && u.findings[0].at.start.column == 5)
t = module("x = 1\nx = 2\nx\n")
claim(is_failure(t) && t.findings[0].message == "the name x is bound twice in one block" && t.findings[0].at.start.line == 2)
// Every finding of a text is given, not the first alone.
claim(count(module("[a, b, c]\n").findings) == 3)

// An operator stands for a shipped primitive, named by its hash: where the primitive is not given, the text is refused.
claim(is_failure(module("1 + 2\n")) && module("1 + 2\n").findings[0].message == "the name int.add is bound nowhere in the text")
claim(!is_failure(meaning.module_of(tree("1 + 2\n"), {shipped: [{name: "int.add", hash: "sha256:00"}], modules: [], own: own})))

// A module that is imported and not supplied is a finding.
i = module("import lib\nlib.f()\n")
claim(is_failure(i) && count(i.findings) == 1)

// An import supplied: its declarations are met from this module's own header lines, and the import is declared with its identity.
lib = {name: "lib", declares: [{role: "capability", name: "output"}], identity: "sha256:00"}
g = meaning.module_of(tree("capability output\nimport lib\nlib.f()\n"), {shipped: [], modules: [lib], own: own})
claim(!is_failure(g) && count(g.declares) == 2 && g.declares[1].role == "module" && g.declares[1].name == "lib" && g.declares[1].identity == "sha256:00")
// The same import where this module holds no `output` is refused.
claim(is_failure(meaning.module_of(tree("import lib\nlib.f()\n"), {shipped: [], modules: [lib], own: own})))

output.write("done")
// expect: done
// end: completed
// summary: decided
