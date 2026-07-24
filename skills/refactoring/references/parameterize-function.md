# Parameterize Function

**Tag:** refactoring-apis · **Alias:** Parameterize Method

## Motivation

When two or more functions do essentially the same thing with different literal values baked
in, combine them into one function that takes those values as a parameter. This removes
duplication and makes the function more general — new variations become new arguments rather
than new functions.

## Mechanics

1. Select one of the similar functions.
2. Use [Change Function Declaration](change-function-declaration.md) to add parameters for
   the values that differ between the variants.
3. Update callers of that function to pass the correct literals.
4. Change the body to use the new parameters in place of the baked-in literals.
5. Run the tests.
6. For each of the other similar functions, replace its calls with calls to the parameterized
   function, then delete it. Run tests after each.

## Example

Before — three near-identical raise functions:

```ruby
def five_percent_raise(person)
  person.salary = (person.salary * 1.05).round
end

def ten_percent_raise(person)
  person.salary = (person.salary * 1.10).round
end
```

After parameterizing:

```ruby
def raise_salary(person, factor)
  person.salary = (person.salary * (1 + factor)).round
end

raise_salary(person, 0.05)
raise_salary(person, 0.10)
```

## Related

- Uses [Change Function Declaration](change-function-declaration.md)
- Opposite of specializing via [Remove Flag Argument](remove-flag-argument.md)
