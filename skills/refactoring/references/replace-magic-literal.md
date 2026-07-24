# Replace Magic Literal

**Tag:** organizing-data · **Alias:** Replace Magic Number with Symbolic Constant

## Motivation

A magic literal is a value with special meaning appearing bare in code (`9.81`, `"M"`, `7`).
The reader has to infer what it means, and if the same value appears in several places, a
change means finding all of them. Replace it with a well-named constant that states the
meaning and centralizes the value.

## Mechanics

1. Declare a constant and set it to the value of the literal.
2. Find each occurrence of the literal that has the same meaning as the constant.
3. Replace each such occurrence with the constant, one at a time, running tests.

Only replace literals that share the constant's *meaning* — don't blindly swap every `7`.

## Example

Before:

```ruby
def potential_energy(mass, height)
  mass * height * 9.81
end
```

After:

```ruby
STANDARD_GRAVITY = 9.81

def potential_energy(mass, height)
  mass * height * STANDARD_GRAVITY
end
```

## Related

- For richer values, wrap them: [Replace Primitive with Object](replace-primitive-with-object.md)
- Name a sub-expression instead: [Extract Variable](extract-variable.md)
