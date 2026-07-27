# Remove Unused Default Parameter

**Tag:** refactoring-apis · **Source:** *Refactoring: Ruby Edition*

## Motivation

A parameter with a default that **no caller ever passes** is speculative generality made
concrete: the method advertises flexibility nobody uses, and every reader must consider a
code path that never runs. Delete the parameter and let the method do the one thing it
actually does. (If a variant is someday needed, it's cheap to reintroduce — or better,
introduce it as a separate, named function.)

## Mechanics

1. Verify no caller passes the parameter (search the codebase; with a type checker or good
   test coverage, removing it and checking is itself the verification).
2. Remove the parameter, and simplify the body by pruning the now-constant conditional
   paths it controlled.
3. Run the tests.

## Example

Before — `sorted` is never passed by anyone:

```ruby
def products(sorted: false)
  result = catalog.products
  result = result.sort_by(&:name) if sorted
  result
end

products
```

After:

```ruby
def products
  catalog.products
end
```

## Related

- The general move: [Change Function Declaration](change-function-declaration.md)
- Sibling cleanups: [Remove Dead Code](remove-dead-code.md), [Remove Flag Argument](remove-flag-argument.md)
