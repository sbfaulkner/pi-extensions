# Introduce Foreign Method

**Tag:** moving-features · **Source:** *Refactoring* (1st edition)

## Motivation

You need a method on a class you can't (or shouldn't) modify — a stdlib class, a gem's
class. Write the method in *your* code, taking an instance of the foreign class as its
first argument, and name it as if it belonged there. This is the smallest, safest answer to
the **Incomplete Library Class** smell. In Ruby the tempting alternative is reopening the
class — see [Introduce Local Extension](introduce-local-extension.md) for why that
escalation should be deliberate. Mark the foreign method as such; if many accumulate for
one class, upgrade to a local extension.

**With Sorbet:** a foreign method is a plain sig-able method — fully typed with zero RBI
maintenance, which is exactly what a monkey-patch isn't. Prefer this form in typed
codebases.

## Mechanics

1. Create a method in the client class whose first parameter is the foreign-class instance.
2. Implement it using only the foreign class's public interface.
3. Replace the inline logic at call sites with calls to it.
4. Run the tests.
5. Comment it as a foreign method, noting where it really belongs.

## Example

Before — date arithmetic cluttering the caller:

```ruby
new_start = Date.new(previous_end.year, previous_end.month, previous_end.day + 1)
```

After introducing a foreign method:

```ruby
# Foreign method: belongs on Date.
def next_day(date)
  Date.new(date.year, date.month, date.day + 1)
end

new_start = next_day(previous_end)
```

## Related

- Several foreign methods for one class: [Introduce Local Extension](introduce-local-extension.md)
- Wrapping a whole external system rather than one class: [Introduce Gateway](introduce-gateway.md)
- The move you'd make if you *did* own the class: [Move Function](move-function.md)
