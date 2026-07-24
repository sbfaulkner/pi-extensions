# Push Down Method

**Tag:** dealing-with-inheritance · **Inverse:** [Pull Up Method](pull-up-method.md)

## Motivation

The mirror of [Pull Up Method](pull-up-method.md). When a method on the superclass is relevant
to only one (or a few) subclasses, move it down to those subclasses. This keeps the superclass
focused on what's genuinely common and removes irrelevant behavior from siblings that don't
need it (a form of the **Refused Bequest** smell).

## Mechanics

1. Copy the method into every subclass that needs it.
2. Remove the method from the superclass.
3. Run the tests.
4. Remove the method from any subclass that doesn't need it.
5. Run the tests.

## Example

Before — `quota` on the superclass but only salespeople have one:

```ruby
class Employee
  def quota
    @quota
  end
end

class Salesperson < Employee; end
class Engineer < Employee; end
```

After pushing `quota` down:

```ruby
class Employee; end

class Salesperson < Employee
  def quota
    @quota
  end
end

class Engineer < Employee; end
```

## Related

- Inverse: [Pull Up Method](pull-up-method.md)
- Data equivalent: [Push Down Field](push-down-field.md)
