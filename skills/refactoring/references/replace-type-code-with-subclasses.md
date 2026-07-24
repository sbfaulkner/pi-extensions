# Replace Type Code with Subclasses

**Tag:** dealing-with-inheritance · **Aliases:** Extract Subclass, Replace Type Code with State/Strategy · **Inverse:** [Remove Subclass](remove-subclass.md)

## Motivation

A type code field (e.g., `employee_type == "engineer"`) that drives conditional behavior is a
candidate for subclasses. Subclasses let you use [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)
for behavior that varies by type, and let you add fields/methods that only apply to one type.
Use direct subclassing when the type is fixed for an object's lifetime; when it can change (or
an object can have several type-driven aspects), prefer the state/strategy variant where the
subclass hangs off a separate field.

## Mechanics

1. [Encapsulate Variable](encapsulate-variable.md) the type code if it isn't already.
2. Pick one type-code value. Create a subclass for it. Override the type-code getter to return
   the literal value.
3. Create a factory (or selector) that maps the type code to the right subclass instance
   (see [Replace Constructor with Factory Function](replace-constructor-with-factory-function.md)).
4. Run the tests.
5. Repeat for each type-code value, creating a subclass each time.
6. Remove the type-code field.
7. Use [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md) and
   [Push Down Method](push-down-method.md) / [Push Down Field](push-down-field.md) to move
   type-specific behavior into the subclasses.

## Example

Before — behavior keyed off a type string:

```ruby
class Employee
  def initialize(name, type)
    @name = name
    @type = type
  end

  attr_reader :type
end
```

After introducing subclasses via a factory:

```ruby
class Employee
  def self.create(name, type)
    klass = { "engineer" => Engineer, "manager" => Manager, "salesperson" => Salesperson }
    klass.fetch(type).new(name)
  end

  def initialize(name)
    @name = name
  end
end

class Engineer < Employee
  def type
    "engineer"
  end
end
```

## Related

- Inverse: [Remove Subclass](remove-subclass.md)
- Then apply [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)
- Uses [Encapsulate Variable](encapsulate-variable.md), [Replace Constructor with Factory Function](replace-constructor-with-factory-function.md)
