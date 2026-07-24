# Collapse Hierarchy

**Tag:** dealing-with-inheritance

## Motivation

Over time a class hierarchy can evolve until a subclass and its superclass are no longer
different enough to justify being separate — the subclass adds almost nothing (a form of
**Speculative Generality** / **Lazy Element**). Merge them into a single class.

## Mechanics

1. Choose which class to remove (superclass or subclass — usually keep the one with the more
   meaningful name).
2. Use [Pull Up Field](pull-up-field.md) / [Pull Up Method](pull-up-method.md) (or push down)
   to move all elements into the one class you're keeping.
3. Adjust references to the removed class to use the retained one.
4. Remove the empty class.
5. Run the tests.

## Example

Before — a subclass that no longer adds anything:

```ruby
class Party
  def initialize(name)
    @name = name
  end
end

class Department < Party
end
```

After collapsing:

```ruby
class Department
  def initialize(name)
    @name = name
  end
end
```

## Related

- Inverse in spirit: [Extract Superclass](extract-superclass.md)
- Uses [Pull Up Method](pull-up-method.md), [Pull Up Field](pull-up-field.md)
- Class-level equivalent: [Inline Class](inline-class.md)
