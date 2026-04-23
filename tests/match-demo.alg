use match_expr

x = match 1 with 1 => "one" | 2 => "two"
y = match 2 with 1 => "one" | 2 => "two"
z = match 3 with 1 => "one" | 2 => "two" | 3 => "three"

print(x)           // expect: one
print(y)           // expect: two
print(z)           // expect: three
