# Remove Dead Code

**Tag:** moving-features

## Motivation

Unused code is a burden: readers still try to understand it, wondering why it doesn't seem
to do anything and whether it matters. Once code is no longer used, delete it. Don't comment
it out "just in case" — version control remembers it if you ever need it back.

## Mechanics

1. If the dead code is referenced from outside (e.g., a public API), verify it's truly
   unreferenced before removing.
2. Remove the dead code.
3. Run the tests.

## Example

```ruby
# before
def reason_for_visit(patient)
  # legacy handling, no longer reachable
  if false
    log_legacy_reason(patient)
  end
  patient.chief_complaint
end

# after
def reason_for_visit(patient)
  patient.chief_complaint
end
```

## Related

- Often follows [Replace Query with Parameter](replace-query-with-parameter.md), [Remove Flag Argument](remove-flag-argument.md), and other simplifications that leave code orphaned
- Related to trimming Speculative Generality via [Collapse Hierarchy](collapse-hierarchy.md), [Inline Class](inline-class.md)
