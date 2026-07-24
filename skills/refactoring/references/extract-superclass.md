# Extract Superclass

**Tag:** dealing-with-inheritance

## Motivation

When two classes have similar features, introduce a superclass and move the common parts up
into it. This is one path to removing duplication (the alternative being
[Extract Class](extract-class.md) with delegation). Reach for a superclass when the shared
behavior and data represent a genuine "is-a" generalization of both classes.

## Mechanics

1. Create an empty superclass and make the two classes inherit from it.
2. Run the tests.
3. Use [Pull Up Constructor Body](pull-up-constructor-body.md), [Pull Up Method](pull-up-method.md),
   and [Pull Up Field](pull-up-field.md) to move common elements up, one at a time.
4. Run the tests after each move.
5. Review clients of the subclasses; consider whether some should use the new superclass
   interface.

## Example

Before — `Employee` and `Department` both track name and monthly cost:

```ruby
class Employee
  def initialize(name, monthly_cost)
    @name = name
    @monthly_cost = monthly_cost
  end

  def annual_cost
    @monthly_cost * 12
  end
end

class Department
  def initialize(name, staff)
    @name = name
    @staff = staff
  end

  def monthly_cost
    @staff.sum(&:monthly_cost)
  end

  def annual_cost
    monthly_cost * 12
  end
end
```

After extracting a `Party` superclass:

```ruby
class Party
  def initialize(name)
    @name = name
  end

  def annual_cost
    monthly_cost * 12
  end
end

class Employee < Party
  def initialize(name, monthly_cost)
    super(name)
    @monthly_cost = monthly_cost
  end

  attr_reader :monthly_cost
end

class Department < Party
  def initialize(name, staff)
    super(name)
    @staff = staff
  end

  def monthly_cost
    @staff.sum(&:monthly_cost)
  end
end
```

## Related

- Delegation-based alternative: [Extract Class](extract-class.md)
- Uses [Pull Up Method](pull-up-method.md), [Pull Up Field](pull-up-field.md), [Pull Up Constructor Body](pull-up-constructor-body.md)
- Undo it: [Collapse Hierarchy](collapse-hierarchy.md)
