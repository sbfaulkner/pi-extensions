# Encapsulate Collection

**Tag:** encapsulation

## Motivation

Encapsulating a field is common, but people often stop halfway with collections: they
provide a getter that returns the collection itself, letting callers mutate it directly and
bypassing the owner's control. Instead, the owner should return a **copy** (or read-only
view) and provide dedicated add/remove methods, so all changes go through the class.

## Mechanics

1. If the collection isn't already encapsulated, apply [Encapsulate Variable](encapsulate-variable.md).
2. Add `add`/`remove` methods to the class for modifying the collection.
3. Run static checks.
4. Find callers that modify the collection directly and change them to use the new methods,
   one at a time, running tests.
5. Change the getter to return a copy (or frozen/read-only view) of the collection.
6. Run the tests.

## Example

```ruby
class Person
  def initialize
    @courses = []
  end

  # return a copy so callers can't mutate internal state
  def courses
    @courses.dup
  end

  def add_course(course)
    @courses << course
  end

  def remove_course(course)
    @courses.delete(course)
  end
end
```

## Related

- Built on [Encapsulate Variable](encapsulate-variable.md)
- Record equivalent: [Encapsulate Record](encapsulate-record.md)
