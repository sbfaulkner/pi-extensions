# Replace Error Code with Exception

**Tag:** refactoring-apis · **Inverse:** [Replace Exception with Precheck](replace-exception-with-precheck.md)

## Motivation

Returning a special error code forces every caller to check for it and pass it up the chain,
tangling error handling into normal logic. Exceptions cleanly separate the error path: code
that can't handle a problem doesn't have to mention it; the error propagates until something
catches it. Use exceptions for genuinely *exceptional* conditions — things outside the normal
expected behavior — not for ordinary control flow.

## Mechanics

1. Decide on the exception type (create one if needed).
2. Find the topmost place the error code is handled, and wrap it (or the relevant call) in a
   handler that rescues the exception.
3. Run the tests.
4. In the function that produces the error, replace the error-code return with raising the
   exception.
5. Change each caller to stop checking the error code, letting the exception propagate. Run
   tests after each.
6. Remove the error-code handling once no caller relies on it.

## Example

Before — a sentinel error code:

```ruby
def local_ship_rate(country)
  data = ShippingRates.for(country)
  return -23 if data.nil? # error code

  data[:rate]
end

rate = local_ship_rate(country)
handle_unknown_country if rate == -23
```

After raising an exception:

```ruby
class UnknownCountryError < StandardError; end

def local_ship_rate(country)
  data = ShippingRates.for(country)
  raise UnknownCountryError, country if data.nil?

  data[:rate]
end

begin
  rate = local_ship_rate(country)
rescue UnknownCountryError
  handle_unknown_country
end
```

## Related

- Inverse / follow-up: [Replace Exception with Precheck](replace-exception-with-precheck.md)
- Document assumptions: [Introduce Assertion](introduce-assertion.md)
