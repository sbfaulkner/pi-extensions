# Encapsulate Downcast

**Tag:** refactoring-apis · **Source:** *Refactoring* (1st edition)

## Motivation

A method returns a value typed more generally than what it actually returns, forcing every
caller to cast the result down before using it. Move the cast *into* the method and declare
the specific type, so callers receive what they can use directly — the provider states the
truth once instead of every client restating it.

In untyped Ruby this refactoring has no purchase — there are no casts. **With Sorbet it's
essential hygiene**: methods whose sigs return `T.untyped`, an over-wide base class, or
`T.nilable` when presence is guaranteed push `T.cast`/`T.must` noise into every caller.
Tighten the sig and hoist the cast (with a meaningful failure) into the provider. Each
caller-side `T.cast`/`T.must` you delete is one fewer place a wrong assumption can hide.

## Mechanics

1. Find a method whose callers cast (`T.cast`, `T.must`) its result.
2. Move the cast into the method, converting it to a checked, well-messaged failure if the
   assumption can be violated; tighten the sig's return type to what callers actually need.
3. Run the type checker and the tests.
4. Delete the now-redundant casts at each call site, one at a time.

## Example

Before — every caller must `T.must` the last reading:

```ruby
class Site
  extend T::Sig

  sig { returns(T.nilable(Reading)) }
  def last_reading
    readings.last
  end
end

# callers:
value = T.must(site.last_reading).value
```

After encapsulating the cast — the domain guarantees a site has readings:

```ruby
class Site
  extend T::Sig

  sig { returns(Reading) }
  def last_reading
    T.must(readings.last) # invariant: sites are created with an initial reading
  end
end

# callers:
value = site.last_reading.value
```

The invariant is asserted once, next to the code that maintains it, with one place to look
when it breaks.

## Related

- The same instinct for nil at system edges: [Introduce Special Case](introduce-special-case.md)
- Stating invariants explicitly: [Introduce Assertion](introduce-assertion.md)
- Provider-side simplification generally: [Replace Parameter with Query](replace-parameter-with-query.md)
