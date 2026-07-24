# Pull Up Method

**Tag:** dealing-with-inheritance · **Inverse:** [Push Down Method](push-down-method.md)

## Motivation

When subclasses have methods that do the same thing, move the method up to the superclass to
eliminate the duplication. Duplicated behavior across siblings is a maintenance hazard — a
change in one is easily forgotten in the others. If the methods are similar but not
identical, use [Extract Function](extract-function.md) first to isolate the identical part.

## Mechanics

1. Inspect the candidate methods to ensure they're truly identical. If not, refactor them
   until they are (e.g., [Extract Function](extract-function.md), rename parameters with
   [Change Function Declaration](change-function-declaration.md)).
2. Ensure any methods/fields the method calls are accessible from the superclass (pull those
   up first if needed — [Pull Up Field](pull-up-field.md)).
3. Copy the method into the superclass.
4. Run static checks.
5. Delete one subclass's copy.
6. Run the tests.
7. Delete the remaining subclass copies one by one, running tests.

## Example

Before — both subclasses define an identical `annual_cost`:

```ruby
class Employee < Party; end
class Department < Party; end

class Employee
  def annual_cost
    monthly_cost * 12
  end
end

class Department
  def annual_cost
    monthly_cost * 12
  end
end
```

After pulling `annual_cost` up:

```ruby
class Party
  def annual_cost
    monthly_cost * 12
  end
end

class Employee < Party; end
class Department < Party; end
```

## Related

- Inverse: [Push Down Method](push-down-method.md)
- Companions: [Pull Up Field](pull-up-field.md), [Pull Up Constructor Body](pull-up-constructor-body.md)
- Create the shared superclass first: [Extract Superclass](extract-superclass.md)
