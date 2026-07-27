# Dialect: Sorbet (typed Ruby)

**Scope:** overlay for Sorbet-typed codebases — load *on top of* [ruby.md](ruby.md).
Everything here is editorial: the books predate Sorbet.

**Placement rule:** refactoring-specific, mechanics-changing guidance lives inline in that
refactoring's reference file (as a **With Sorbet** note); this file carries only
cross-cutting guidance, and points at inline notes rather than duplicating them.

## The big mechanical upgrade: `srb tc` finds every caller

Most mechanics include steps like "find all callers; change them one at a time, testing
after each." In `typed: true` (or stricter) files, the type checker does the finding:
change the declaration, run `srb tc`, and every red site is a caller to fix. This
strengthens [Change Function Declaration](../change-function-declaration.md),
[Rename Field](../rename-field.md), [Move Function](../move-function.md),
[Introduce Parameter Object](../introduce-parameter-object.md), and every other
signature-touching refactoring. Tests still gate each step — the checker verifies shape,
not behavior.

When a region you're refactoring sits in a `typed: false` file, consider raising the sigil
first; it's the typed equivalent of adding characterization tests.

## Exceptions at a glance

| Refactoring | Status | Why |
|---|---|---|
| [Replace Conditional with Polymorphism](../replace-conditional-with-polymorphism.md) | argument inverted | `sealed!` + exhaustive `case` + `T.absurd` gives compiler-checked dispatch; see below |
| [Replace Conditional with Visitor](../replace-conditional-with-visitor.md) | usually unnecessary | same reason; see its inline note |
| [Introduce Assertion](../introduce-assertion.md) | partially subsumed | `sig` runtime checking already asserts types at boundaries; assertions remain useful for value-level invariants |
| [Encapsulate Downcast](../encapsulate-downcast.md) | reframed | now `T.cast`/`T.must` hygiene; see its file |
| [Dynamic Method Definition](../dynamic-method-definition.md) and the metaprogramming set | friction | dynamically defined methods are invisible to `srb tc` without RBI (tapioca); typed code prefers parse-time definitions |

## The `sealed!` inversion

The 2nd edition's headline advice — repeated type-switches should become polymorphism —
rests on the compiler being unable to tell you when a `case` misses a variant. Sorbet can:

```ruby
module Shape
  extend T::Helpers
  sealed!
end

sig { params(shape: Shape).returns(Float) }
def area(shape)
  case shape
  when Circle then Math::PI * shape.radius**2
  when Square then shape.side**2
  else T.absurd(shape)
  end
end
```

Adding a variant now produces a type error at every unhandled `case`. That makes exhaustive
dispatch a *peer* of polymorphism, not a smell: prefer `case`/`T.absurd` when operations
outnumber variants or logic wants to stay together; prefer polymorphism when variants grow
faster. `T::Enum` gives the same exhaustiveness for enumerated values
([Replace Magic Literal](../replace-magic-literal.md) targets, type codes that don't need
subclasses).

## `T::Struct` is the record target

Where [ruby.md](ruby.md) says `Data.define`, a Sorbet codebase may prefer `T::Struct` for
typed fields: the natural target for [Encapsulate Record](../encapsulate-record.md),
[Introduce Parameter Object](../introduce-parameter-object.md),
[Replace Primitive with Object](../replace-primitive-with-object.md), and the intermediate
data of [Split Phase](../split-phase.md). Use `const` (not `prop`) unless mutation is
required — same immutability reasoning as ruby.md.

## Inheritance chapter gets teeth

`abstract!` + `sig { abstract... }` and `override` make hierarchy contracts checkable:
[Pull Up Method](../pull-up-method.md), [Form Template Method](../form-template-method.md),
and [Extract Interface](../extract-interface.md) (via `interface!`) produce declarations
the checker enforces, instead of comments and `NotImplementedError` conventions.

## Special cases delete `T.must` noise

A concentration of `T.must`/`T.nilable` juggling around one concept is the typed signature
of the smell [Introduce Special Case](../introduce-special-case.md) fixes: returning a
special-case object instead of `nil` turns `T.nilable(Customer)` into `Customer` and the
`T.must` calls disappear.
