// units.alg — units-of-measure DSL, core algebra (B-092 U1).
//
// Dimensions are structural DATA: a 7-exponent vector over the SI base
// dimensions [L, M, T, I, Θ, N, J], an abelian group under elementwise
// exponent addition. Dimension equality is kernel structural equality;
// named dimensions are REFINEMENTS over the one Quantity record — so
// dimensional soundness is refinement discharge, the same machinery as
// PositiveInt (plan: .claude/plans/units-dsl.md, U-R1).

// --- Dimension vectors -------------------------------------------------

dimensionless = [0, 0, 0, 0, 0, 0, 0]
length_dim    = [1, 0, 0, 0, 0, 0, 0]
mass_dim      = [0, 1, 0, 0, 0, 0, 0]
time_dim      = [0, 0, 1, 0, 0, 0, 0]
current_dim   = [0, 0, 0, 1, 0, 0, 0]

dim_mul(a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4], a[5] + b[5], a[6] + b[6]]
dim_div(a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3], a[4] - b[4], a[5] - b[5], a[6] - b[6]]
dim_pow(a, n) => [a[0] * n, a[1] * n, a[2] * n, a[3] * n, a[4] * n, a[5] * n, a[6] * n]

velocity_dim     = dim_div(length_dim, time_dim)
acceleration_dim = dim_div(velocity_dim, time_dim)
force_dim        = dim_mul(mass_dim, acceleration_dim)
energy_dim       = dim_mul(force_dim, length_dim)
power_dim        = dim_div(energy_dim, time_dim)
pressure_dim     = dim_div(force_dim, dim_mul(length_dim, length_dim))

// --- Dimension rendering (domain vocabulary for errors) ----------------

dim_sym(i) => ["m", "kg", "s", "A", "K", "mol", "cd"][i]

dim_render_from(d, i) =>
  if i == 7
    then ""
    else
      rest = dim_render_from(d, i + 1)
      e = d[i]
      if e == 0
        then rest
        else
          piece = if e == 1 then dim_sym(i) else dim_sym(i) + "^" + e.toString()
          if rest == "" then piece else piece + "·" + rest

dim_render(d) =>
  r = dim_render_from(d, 0)
  if r == "" then "dimensionless" else r

dim_name(d) =>
  when d
    is x and x == length_dim then "length"
    is x and x == mass_dim then "mass"
    is x and x == time_dim then "time"
    is x and x == velocity_dim then "velocity"
    is x and x == acceleration_dim then "acceleration"
    is x and x == force_dim then "force"
    is x and x == energy_dim then "energy"
    is x and x == power_dim then "power"
    is x and x == pressure_dim then "pressure"
    is _ then dim_render(d)

// --- Unit: {name, dim, scale} — scale relative to the coherent SI unit --

wrap_name(n) => if n.includes("·") || n.includes("/") then "(" + n + ")" else n

u_mul(self, other) =>
  if other instanceof Unit
    then Unit(self.name + "·" + wrap_name(other.name), dim_mul(self.dim, other.dim), self.scale * other.scale)
    else error "a unit can only multiply another unit — use qty(n, u) to build a quantity"

u_div(self, other) =>
  if other instanceof Unit
    then Unit(self.name + "/" + wrap_name(other.name), dim_div(self.dim, other.dim), self.scale / other.scale)
    else error "a unit can only divide another unit"

u_pow(self, n) => Unit(wrap_name(self.name) + "^" + n.toString(), dim_pow(self.dim, n), self.scale.pow(n.toFloat()))

u_toString(self) => self.name

Unit = Type.define({
  name: String,
  dim: Array,
  scale: Float,
  mul: u_mul,
  div: u_div,
  pow: u_pow,
  toString: u_toString
})

// Rename a computed unit (N, J, W, …) keeping its dimension and scale.
named(u, n) => Unit(n, u.dim, u.scale)

// --- Quantity: {mag, dim, unit} ----------------------------------------

// Normalized magnitude (in coherent SI terms) — the comparison basis.
q_norm(q) => q.mag * q.unit.scale

q_add(self, other) =>
  if !(other instanceof Quantity)
    then error "cannot add {self.unit.name} and a bare number — wrap it with qty(n, unit)"
    else if self.dim == other.dim
      then Quantity(self.mag + q_norm(other) / self.unit.scale, self.dim, self.unit)
      else error "cannot add {self.unit.name} and {other.unit.name}: {dim_name(self.dim)} vs {dim_name(other.dim)}"

q_sub(self, other) =>
  if !(other instanceof Quantity)
    then error "cannot subtract a bare number from {self.unit.name} — wrap it with qty(n, unit)"
    else if self.dim == other.dim
      then Quantity(self.mag - q_norm(other) / self.unit.scale, self.dim, self.unit)
      else error "cannot subtract {other.unit.name} from {self.unit.name}: {dim_name(self.dim)} vs {dim_name(other.dim)}"

q_mul(self, other) =>
  when other
    is o and o instanceof Quantity then Quantity(self.mag * o.mag, dim_mul(self.dim, o.dim), self.unit.mul(o.unit))
    is o and o instanceof Unit then Quantity(self.mag, dim_mul(self.dim, o.dim), self.unit.mul(o))
    is o and o instanceof Int then Quantity(self.mag * o.toFloat(), self.dim, self.unit)
    is o and o instanceof Float then Quantity(self.mag * o, self.dim, self.unit)
    is _ then error "cannot multiply {self.unit.name} by that value"

q_div(self, other) =>
  when other
    is o and o instanceof Quantity then Quantity(self.mag / o.mag, dim_div(self.dim, o.dim), self.unit.div(o.unit))
    is o and o instanceof Unit then Quantity(self.mag, dim_div(self.dim, o.dim), self.unit.div(o))
    is o and o instanceof Int then Quantity(self.mag / o.toFloat(), self.dim, self.unit)
    is o and o instanceof Float then Quantity(self.mag / o, self.dim, self.unit)
    is _ then error "cannot divide {self.unit.name} by that value"

// Convert to another unit of the SAME dimension.
q_to(self, target) =>
  if !(target instanceof Unit)
    then error "to(...) expects a unit"
    else if self.dim == target.dim
      then Quantity(q_norm(self) / target.scale, self.dim, target)
      else error "cannot convert {self.unit.name} to {target.name}: {dim_name(self.dim)} vs {dim_name(target.dim)}"

q_eq(self, other) =>
  if other instanceof Quantity && self.dim == other.dim
    then q_norm(self) == q_norm(other)
    else false

q_lt(self, other) =>
  if other instanceof Quantity && self.dim == other.dim
    then q_norm(self) < q_norm(other)
    else error "cannot compare {self.unit.name} with an incompatible value"

q_gt(self, other) =>
  if other instanceof Quantity && self.dim == other.dim
    then q_norm(self) > q_norm(other)
    else error "cannot compare {self.unit.name} with an incompatible value"

q_toString(self) => "{self.mag} {self.unit.name}"

Quantity = Type.define({
  mag: Float,
  dim: Array,
  unit: Unit,
  add: q_add,
  sub: q_sub,
  mul: q_mul,
  div: q_div,
  to: q_to,
  eq: q_eq,
  lt: q_lt,
  gt: q_gt,
  toString: q_toString
})

// The blessed constructor: qty(3, m), qty(9.8, m.div(s.pow(2))).
qty(v, u) =>
  mag = when v
    is n and n instanceof Int then n.toFloat()
    is n then n
  Quantity(mag, u.dim, u)

// --- Named dimensions: refinements over Quantity (U-R1) -----------------

Length       = Quantity & _.dim == length_dim
Mass         = Quantity & _.dim == mass_dim
Duration     = Quantity & _.dim == time_dim
Velocity     = Quantity & _.dim == velocity_dim
Acceleration = Quantity & _.dim == acceleration_dim
Force        = Quantity & _.dim == force_dim
Energy       = Quantity & _.dim == energy_dim

// --- SI units (U-R5: mechanics-focused set) -----------------------------

m  = Unit("m",  length_dim, 1.0)
km = Unit("km", length_dim, 1000.0)
cm = Unit("cm", length_dim, 0.01)
mm = Unit("mm", length_dim, 0.001)
s  = Unit("s",  time_dim, 1.0)
minute = Unit("min", time_dim, 60.0)
hour   = Unit("h",   time_dim, 3600.0)
kg = Unit("kg", mass_dim, 1.0)
g  = Unit("g",  mass_dim, 0.001)

N  = named(kg.mul(m).div(s.pow(2)), "N")
J  = named(N.mul(m), "J")
W  = named(J.div(s), "W")
Pa = named(N.div(m.pow(2)), "Pa")
