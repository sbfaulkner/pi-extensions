# Remove Named Parameter

**Tag:** refactoring-apis · **Source:** *Refactoring: Ruby Edition* · **Inverse:** [Introduce Named Parameter](introduce-named-parameter.md)

## Motivation

The mirror of [Introduce Named Parameter](introduce-named-parameter.md). Naming has a cost:
ceremony at every call site and a hash-like signature that invites unchecked growth. When a
parameter is obvious from the method name and position — `find(id: 42)` says nothing that
`find(42)` doesn't — the name is noise. Remove it and let the method name carry the meaning.

## Mechanics

1. Use [Change Function Declaration](change-function-declaration.md): convert the keyword
   argument back to a positional parameter.
2. Update each caller to the positional form. Run tests after each.

## Example

Before — naming the self-evident:

```ruby
def find_book(id:)
  # ...
end

find_book(id: 18)
```

After:

```ruby
def find_book(id)
  # ...
end

find_book(18)
```

## Related

- Inverse: [Introduce Named Parameter](introduce-named-parameter.md)
- Built on [Change Function Declaration](change-function-declaration.md)
- Prune parameters nobody uses: [Remove Unused Default Parameter](remove-unused-default-parameter.md)
