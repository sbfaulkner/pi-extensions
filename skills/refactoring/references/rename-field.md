# Rename Field

**Tag:** organizing-data

## Motivation

The names of fields in record/data structures are central to understanding — they're part
of the ubiquitous language of the program. As understanding grows, rename fields to reflect
it. The same care applies to getter/setter names on classes.

## Mechanics

1. If the record has limited scope, rename all field accesses directly and run tests — done.
2. Otherwise, if the record isn't already encapsulated, apply [Encapsulate Record](encapsulate-record.md).
3. Rename the private field inside the class, and adjust the internal methods that use it.
4. Run the tests.
5. If the constructor / accessors use the old name, rename them with
   [Change Function Declaration](change-function-declaration.md).
6. Rename the accessors.
7. Run the tests.

## Example

Before:

```ruby
class Organization
  def initialize(data)
    @name = data[:name]
  end

  attr_accessor :name
end
```

After renaming `name` to `title`:

```ruby
class Organization
  def initialize(data)
    @title = data[:title] || data[:name]
  end

  attr_accessor :title
end
```

## Related

- Depends on [Encapsulate Record](encapsulate-record.md)
- Rename methods/params: [Change Function Declaration](change-function-declaration.md)
- Rename locals: [Rename Variable](rename-variable.md)
