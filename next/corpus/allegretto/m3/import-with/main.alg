// with hands an expression for the input the imported module declares.
// The expression may use any name of the importing module, its bindings
// included: here the binding who.
capability output
import greeter with name: who ++ "!"
who = "world"
greeter.greet()
// expect: hello, world!
// end: completed
