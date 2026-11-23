// Imported by main.alg: it declares the capability report, which main
// hands by default.
capability report
export warn(t) => report.message({level: `warning, text: t, file: "lint.alg", line: 4})
export code = 1
