// Imported by main.alg. It hands out its key by an exported binding.
key secret
export opener = secret
export make(n) => { shown: n, [secret]: n * 2 }
