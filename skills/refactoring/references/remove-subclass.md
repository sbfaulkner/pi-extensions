# Remove Subclass

**Tag:** dealing-with-inheritance · **Alias:** Replace Subclass with Fields · **Inverse:** [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)

## Motivation

Subclasses are useful while they carry distinct behavior, but as a system evolves a subclass
may dwindle until it does so little it's no longer worth the reader's effort to understand it
(a **Lazy Element**). Replace the subclass with a field on the superclass that captures what
little distinguished it.

## Mechanics

1. Use [Replace Constructor with Factory Function](replace-constructor-with-factory-function.md)
   so callers create instances via a factory rather than the subclass constructor directly.
2. If any code tests the object's type, [Extract Function](extract-function.md) the test and
   [Move Function](move-function.md) it onto the superclass; run tests.
3. Create a field on the superclass to represent the type / distinguishing value.
4. Change methods that referred to the subclass to use the new field.
5. Delete the subclass.
6. Run the tests.

## Example

Before — a subclass whose only difference is a boolean:

```ruby
class Person
  def initialize(name)
    @name = name
  end
end

class Male < Person
  def male?
    true
  end

  def gender_code
    "M"
  end
end
```

After replacing the subclass with fields:

```ruby
class Person
  def initialize(name, gender_code)
    @name = name
    @gender_code = gender_code
  end

  attr_reader :gender_code

  def self.create_male(name)
    new(name, "M")
  end
end
```

## Related

- Inverse: [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)
- Uses [Replace Constructor with Factory Function](replace-constructor-with-factory-function.md), [Move Function](move-function.md)
