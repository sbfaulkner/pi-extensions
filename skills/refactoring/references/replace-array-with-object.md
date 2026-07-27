# Replace Array with Object

**Tag:** organizing-data · **Source:** *Refactoring* (1st edition)

## Motivation

An array where each *position* means something different — `row[0]` is a name, `row[1]` is
a score — is a record wearing an array costume. Nothing enforces or documents the
convention; every reader must reconstruct it. Replace the array with an object whose named
attributes make each element's meaning explicit and give derived behavior a home. (Arrays
are for collections of *like* things; the moment positions have distinct meanings, you've
outgrown them.) In modern Ruby, `Data.define` makes the object one line.

**With Sorbet:** positional heterogeneous arrays are nearly untypeable —
`T::Array[T.any(String, Integer)]` loses which position is which. `T::Struct` restores
named, typed fields.

## Mechanics

1. Create a class with an attribute per array slot (`Data.define`, `Struct`, or a class).
2. Change the code that constructs the array to build the object.
3. Replace each indexed read (`row[0]`) with the named attribute, one at a time, running
   tests as you go.
4. Move behavior that interpreted the array onto the new class.
5. Run the tests.

## Example

Before — positions with secret meanings:

```ruby
row = ["Liverpool", 15]
puts "#{row[0]} have #{row[1]} wins"
```

After:

```ruby
Performance = Data.define(:team, :wins)

row = Performance.new(team: "Liverpool", wins: 15)
puts "#{row.team} have #{row.wins} wins"
```

## Related

- The hash-shaped twin (Ruby's more common costume): [Replace Hash with Object](replace-hash-with-object.md)
- Scalar version: [Replace Primitive with Object](replace-primitive-with-object.md)
- Record encapsulation generally: [Encapsulate Record](encapsulate-record.md)
