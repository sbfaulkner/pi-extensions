# Pull Up Constructor Body

**Tag:** dealing-with-inheritance

## Motivation

Constructors are special — you can't treat them exactly like ordinary methods, so pulling up
common constructor logic needs its own care. When subclass constructors share initialization
code, move that shared code into the superclass constructor and have subclasses call it via
`super`.

## Mechanics

1. If the superclass has no constructor, add one; ensure subclass constructors call `super`
   first.
2. Use [Slide Statements](slide-statements.md) to move the common statements to just after the
   `super` call in each subclass.
3. Move the common code into the superclass constructor, adding any parameters `super` needs.
4. Remove the common code from each subclass constructor.
5. Run the tests after each change.

## Example

Before — both subclasses repeat name initialization:

```ruby
class Party
end

class Employee < Party
  def initialize(name, id, monthly_cost)
    @name = name
    @id = id
    @monthly_cost = monthly_cost
  end
end
```

After pulling the common part up:

```ruby
class Party
  def initialize(name)
    @name = name
  end
end

class Employee < Party
  def initialize(name, id, monthly_cost)
    super(name)
    @id = id
    @monthly_cost = monthly_cost
  end
end
```

## Related

- Companions: [Pull Up Method](pull-up-method.md), [Pull Up Field](pull-up-field.md)
- Uses [Slide Statements](slide-statements.md)
