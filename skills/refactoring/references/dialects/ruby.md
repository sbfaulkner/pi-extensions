# Dialect: Modern Ruby

**Scope:** baseline for any Ruby codebase. The catalog's examples are Ruby, but the books
predate much of the modern language (*Refactoring: Ruby Edition* targets ~1.8). This note
updates targets and mechanics for Ruby 3.x. In a Sorbet-typed codebase, also load
[sorbet.md](sorbet.md) on top of this note.

## Exceptions at a glance

| Refactoring | Status | Why |
|---|---|---|
| [Introduce Named Parameter](../introduce-named-parameter.md) / [Remove Named Parameter](../remove-named-parameter.md) | superseded | real keyword arguments (2.0+) replace the options-hash simulation; the move is now a [Change Function Declaration](../change-function-declaration.md) |
| [Replace Hash with Object](../replace-hash-with-object.md) / [Replace Array with Object](../replace-array-with-object.md) | retargeted | the target is `Data.define`, not a hand-rolled class |
| [Duplicate Observed Data](../duplicate-observed-data.md) | historical | desktop-GUI observer plumbing; already marked as such |
| [Recompose Conditional](../recompose-conditional.md) | extended | `case/in` pattern matching joins the idiom list |

## `Data.define` is the value-object target (3.2+)

Wherever the books say "create a small class" — [Replace Primitive with Object](../replace-primitive-with-object.md),
[Introduce Parameter Object](../introduce-parameter-object.md), [Change Reference to Value](../change-reference-to-value.md),
[Replace Hash with Object](../replace-hash-with-object.md) — reach for `Data.define`:
immutable, value-equal, keyword-constructed, with `with` for derived copies.

```ruby
Money = Data.define(:amount, :currency) do
  def to_s = format("%.2f %s", amount, currency)
end

price = Money.new(amount: 10.0, currency: "CAD")
discounted = price.with(amount: price.amount * 0.9)
```

Use `Struct` only when you genuinely need mutability; a mutable value object defeats
[Change Reference to Value](../change-reference-to-value.md).

## Pattern matching (`case/in`)

Deconstruction absorbs a lot of conditional shuffling: a `case/in` over shapes can be the
honest endpoint of [Decompose Conditional](../decompose-conditional.md), and for a small,
closed set of variants it is a legitimate alternative to
[Replace Conditional with Polymorphism](../replace-conditional-with-polymorphism.md) —
prefer polymorphism when the variant set or operation count is growing, pattern matching
when it is stable and local.

```ruby
case response
in { status: 200, body: }
  parse(body)
in { status: 404 }
  :missing
in { status: 500.., body: }
  raise ServerError, body
end
```

## Keyword arguments

- [Change Function Declaration](../change-function-declaration.md): migrating positional →
  keyword parameters is the modern form of its "add parameter" mechanics — add the keyword
  with a default, migrate callers one by one, then drop the default.
- [Remove Flag Argument](../remove-flag-argument.md): a boolean keyword is still a flag
  argument; the refactoring applies unchanged.

## Safe navigation and nil

`&.` is a *local* nil-guard. One `&.` is idiomatic; the same `&.` chain repeated across
call sites is the smell that [Introduce Special Case](../introduce-special-case.md)
resolves properly.

## Immutability signals

Freeze what you intend to be constant: `# frozen_string_literal: true`, `CONSTANT.freeze`
on collection constants, `Data.define` over `Struct`. This gives
[Remove Setting Method](../remove-setting-method.md) and
[Change Reference to Value](../change-reference-to-value.md) teeth — mutation attempts
fail fast instead of silently aliasing.
