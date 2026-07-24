# Pull Up Field

**Tag:** dealing-with-inheritance · **Inverse:** [Push Down Field](push-down-field.md)

## Motivation

When subclasses each declare a field that's used the same way, move it to the superclass. This
removes duplicated data declarations and enables behavior that uses the field to be pulled up
too ([Pull Up Method](pull-up-method.md)).

## Mechanics

1. Inspect the candidate fields to confirm they're used identically across the subclasses.
2. If they have different names, rename them so they share a name
   ([Rename Field](rename-field.md)).
3. Create a field in the superclass (accessible to subclasses).
4. Delete the subclass fields.
5. Run the tests.

## Example

Before:

```ruby
class Employee < Party
  def initialize
    @name = ""
  end
end

class Department < Party
  def initialize
    @name = ""
  end
end
```

After pulling `@name` up:

```ruby
class Party
  def initialize
    @name = ""
  end
end

class Employee < Party; end
class Department < Party; end
```

## Related

- Inverse: [Push Down Field](push-down-field.md)
- Companion: [Pull Up Method](pull-up-method.md)
- Uses [Rename Field](rename-field.md)
