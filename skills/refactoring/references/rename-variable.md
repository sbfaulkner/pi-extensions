# Rename Variable

**Tag:** basic

## Motivation

Names are how we communicate intent. A well-named variable saves the reader from deducing
its purpose. Rename as soon as a better name occurs to you — the more widely the variable
is used, the more the rename pays off (and the more care it needs).

## Mechanics

1. If the variable is used widely, consider [Encapsulate Variable](encapsulate-variable.md)
   first, so all access goes through accessor methods and the rename is localized.
2. Find all references to the variable and change each one.
   - If the variable is confined to a single function, a straightforward rename is enough.
   - Watch for other code bases (e.g., a variable that's part of a serialized/exported
     interface) that you can't reach — those need the migration approach.
3. Run the tests.

For a constant (or an effectively read-only variable) that is widely used, you can copy it
to a new name, change references gradually, then remove the old name — no encapsulation
needed since it's not being reassigned.

## Example

```ruby
# before
a = height * width

# after — the intent is now obvious at the point of use
area = height * width
```

A wider example, renaming a constant referenced from many places. Introduce the new name,
migrate references, then delete the old one:

```ruby
# before
TPD = 2  # tires per driver?

# after
TIRES_PER_DRIVER = 2
```

## Related

- Rename a function or its parameters: [Change Function Declaration](change-function-declaration.md)
- Rename a field on a record/class: [Rename Field](rename-field.md)
- To localize a wide-reaching rename first: [Encapsulate Variable](encapsulate-variable.md)
- If a variable serves two purposes, split before renaming: [Split Variable](split-variable.md)
