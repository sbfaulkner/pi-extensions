# Replace Hash with Object

**Tag:** organizing-data · **Source:** *Refactoring: Ruby Edition*

## Motivation

Hashes are Ruby's universal data carrier, and that's the problem: a hash that travels
between methods accreting keys becomes an implicit, undocumented, unenforceable type. No
method advertises which keys it reads or writes; a typo'd key returns `nil` instead of
failing; behavior that belongs with the data has nowhere to live. When a hash has a stable
set of keys and an identity in your domain, promote it to an object. In modern Ruby,
`Data.define` (3.2+) or `Struct` gets you there in one line; grow to a full class when
behavior accumulates.

**With Sorbet:** hash shapes type as `T::Hash[Symbol, T.untyped]` — effectively opting the
data out of checking. `T::Struct` is the typed target: named, typed, checked fields. This
refactoring is often the single highest-leverage typing improvement in a legacy Sorbet
codebase.

## Mechanics

1. Create a class (or `Data.define`/`T::Struct`) with an attribute per hash key.
2. Find where the hash is constructed and build the object there instead.
3. Replace each `hash[:key]` read with the attribute call, one call site at a time, running
   tests as you go. (A transitional trick: have the new class also answer `[]` for
   not-yet-migrated readers, then delete it at the end.)
4. Move behavior that manipulates the data onto the new class
   ([Move Function](move-function.md)).
5. Run the tests.

## Example

Before — a hash with an identity crisis:

```ruby
def build_summary(reading)
  { customer: reading[:customer], units: reading[:units], cost: reading[:units] * rate_for(reading[:customer]) }
end

summary = build_summary(reading)
puts "#{summary[:customer]}: #{summary[:cost]}"
```

After promoting it to an object:

```ruby
Summary = Data.define(:customer, :units, :cost) do
  def to_s
    "#{customer}: #{cost}"
  end
end

def build_summary(reading)
  Summary.new(
    customer: reading[:customer],
    units: reading[:units],
    cost: reading[:units] * rate_for(reading[:customer]),
  )
end

puts build_summary(reading)
```

Typos now raise, the shape is documented by the definition, and `to_s` has a home.

## Related

- The 2nd-edition cousin for records generally: [Encapsulate Record](encapsulate-record.md)
- Same promotion for scalars: [Replace Primitive with Object](replace-primitive-with-object.md)
- Hash-shaped parameter lists: [Introduce Parameter Object](introduce-parameter-object.md)
