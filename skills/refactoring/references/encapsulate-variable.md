# Encapsulate Variable

**Tag:** basic · **Aliases:** Encapsulate Field, Self-Encapsulate Field

## Motivation

Data is harder to refactor than functions, because references to it are scattered and
can't be redirected in one place. Routing all access to a variable (especially widely-used
or global data) through accessor functions gives you a single choke point: a place to add
validation, logging, or lazy computation, and a seam that makes later changes (renaming,
changing representation, moving) safe and local. Encapsulating mutable data is one of the
most valuable things you can do to tame a large codebase.

## Mechanics

1. Create encapsulating getter and setter functions for the variable.
2. Run static checks.
3. For each reference to the variable, replace it (one at a time) with a call to the
   appropriate accessor. Run tests after each.
4. Restrict the variable's visibility (make it private / harder to reach directly).
5. Run the tests.
6. If the value is a record or mutable object, consider [Encapsulate Record](encapsulate-record.md)
   or returning a copy to prevent aliasing bugs.

## Example

Before — a global spaceship default read and written directly everywhere:

```ruby
$default_owner = { first_name: "Martin", last_name: "Fowler" }

# scattered usage
spaceship[:owner] = $default_owner
```

After encapsulating access behind methods:

```ruby
$default_owner_data = { first_name: "Martin", last_name: "Fowler" }

def default_owner
  $default_owner_data.dup # return a copy to protect the shared value
end

def default_owner=(arg)
  $default_owner_data = arg
end

# usage
spaceship[:owner] = default_owner
```

## Related

- Deepen protection for records: [Encapsulate Record](encapsulate-record.md), [Encapsulate Collection](encapsulate-collection.md)
- Makes safe: [Rename Variable](rename-variable.md), [Move Field](move-field.md)
- Replace a variable with a computed accessor: [Replace Derived Variable with Query](replace-derived-variable-with-query.md)
