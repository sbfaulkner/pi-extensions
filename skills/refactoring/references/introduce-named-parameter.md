# Introduce Named Parameter

**Tag:** refactoring-apis · **Source:** *Refactoring: Ruby Edition*

## Motivation

A call like `books.find(:all, nil, true)` forces the reader to the method definition to
learn what each position means. When arguments aren't self-explanatory at the call site —
especially booleans and optional values — name them. The Ruby Edition's mechanics predate
real keyword arguments and used an options hash; in modern Ruby, use actual keyword
arguments, which give you the readability plus arity checking for free.

**With Sorbet:** keyword arguments are typed natively in sigs, so this refactoring doubles
as type documentation. Options hashes, by contrast, degrade to
`T::Hash[Symbol, T.untyped]` — one more reason to prefer real kwargs.

## Mechanics

1. Use [Change Function Declaration](change-function-declaration.md): convert the unclear
   trailing parameters to keyword arguments (keep genuinely self-explanatory leading
   parameters positional).
2. Update each caller to pass the named form. Run tests after each.
3. If the parameter list is long or travels together, consider
   [Introduce Parameter Object](introduce-parameter-object.md) instead.

## Example

Before — opaque call sites:

```ruby
def find_books(selection, order, include_hidden)
  # ...
end

find_books(:recent, nil, true)
```

After naming the non-obvious parameters:

```ruby
def find_books(selection, order: nil, include_hidden: false)
  # ...
end

find_books(:recent, include_hidden: true)
```

The call now reads without consulting the definition, and defaults absorb the `nil` noise.

## Related

- Inverse: [Remove Named Parameter](remove-named-parameter.md)
- Built on [Change Function Declaration](change-function-declaration.md)
- For clumps of parameters: [Introduce Parameter Object](introduce-parameter-object.md)
- Boolean parameters may hide two functions: [Remove Flag Argument](remove-flag-argument.md)
