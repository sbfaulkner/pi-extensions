# Change Function Declaration

**Tag:** basic · **Aliases:** Add Parameter, Remove Parameter, Rename Function, Rename Method, Change Signature

## Motivation

A function's name and parameter list are its interface — the primary way callers
understand it. A good name lets you read a call without reading the body. If you can think
of a better name, rename it. Similarly, add, remove, or reorder parameters to make the
function easier to use and to reduce coupling (e.g., pass a value it needs rather than
something it must reach through). There are two ways to do this: a **simple** all-at-once
change, and a **migration** approach for widely-used or published APIs.

## Mechanics (simple)

Use when you can find and change all callers easily.

1. If removing a parameter, check it isn't referenced in the body.
2. Change the function declaration to the desired name / parameters.
3. Find all references to the old declaration and update them to the new one.
4. Run the tests.

## Mechanics (migration — for published or widely-used functions)

Use when you can't (or don't want to) change all callers in one step.

1. If needed, refactor the body first so the change will be easy.
2. Use [Extract Function](extract-function.md) to extract the body into a **new** function
   with the desired declaration. (If the new name would clash, give it a temporary name.)
3. If the extracted function needs extra parameters, add them with the simple mechanics.
4. Run the tests.
5. Apply [Inline Function](inline-function.md) to the old function, so callers now call the
   new one. (Or deprecate the old one and migrate callers gradually.)
6. If you used a temporary name, use Change Function Declaration again to restore it.
7. Run the tests.

## Example

Rename a poorly-named predicate:

```ruby
# before
def circum(radius)
  2 * Math::PI * radius
end

# after
def circumference(radius)
  2 * Math::PI * radius
end
```

Change coupling by passing what's needed. Before, the function reaches into the whole
customer to test one attribute:

```ruby
def in_new_england?(customer)
  %w[MA CT ME VT NH RI].include?(customer.address.state)
end

# callers:
new_englanders = customers.select { |c| in_new_england?(c) }
```

After, take the state code directly, so the function is reusable and less coupled:

```ruby
def state_in_new_england?(state_code)
  %w[MA CT ME VT NH RI].include?(state_code)
end

# callers:
new_englanders = customers.select { |c| state_in_new_england?(c.address.state) }
```

## Related

- Reduce a long parameter list: [Introduce Parameter Object](introduce-parameter-object.md), [Preserve Whole Object](preserve-whole-object.md)
- Remove a boolean flag: [Remove Flag Argument](remove-flag-argument.md)
- Swap a parameter for a computed value or vice versa: [Replace Parameter with Query](replace-parameter-with-query.md), [Replace Query with Parameter](replace-query-with-parameter.md)
- Rename a variable/field instead: [Rename Variable](rename-variable.md), [Rename Field](rename-field.md)
