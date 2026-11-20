// realises: test:modules:module: unknown module ID
// No text nonexistent.alg is beside this one: the driver refuses the
// text, naming the import. Nothing is launched.
capability output
import nonexistent
output.write("never")
// end: refused: the text nonexistent.alg, which import nonexistent names, is not found in the directory of module-unknown.alg
