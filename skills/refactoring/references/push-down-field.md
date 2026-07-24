# Push Down Field

**Tag:** dealing-with-inheritance · **Inverse:** [Pull Up Field](pull-up-field.md)

## Motivation

The mirror of [Pull Up Field](pull-up-field.md). A field declared on the superclass but used by
only one (or a few) subclasses belongs down in those subclasses. Keeping it in the superclass
misleads readers into thinking all subclasses share the data.

## Mechanics

1. Declare the field in each subclass that needs it.
2. Remove the field from the superclass.
3. Run the tests.
4. Remove the field from any subclass that doesn't use it.
5. Run the tests.

## Example

Before — `@quota` on the base class, used only by salespeople:

```ruby
class Employee
  def initialize
    @quota = nil
  end
end

class Salesperson < Employee; end
class Engineer < Employee; end
```

After pushing it down:

```ruby
class Employee; end

class Salesperson < Employee
  def initialize
    @quota = nil
  end
end

class Engineer < Employee; end
```

## Related

- Inverse: [Pull Up Field](pull-up-field.md)
- Behavior equivalent: [Push Down Method](push-down-method.md)
