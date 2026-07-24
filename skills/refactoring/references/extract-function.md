# Extract Function

**Tag:** basic · **Alias:** Extract Method · **Inverse:** [Inline Function](inline-function.md)

## Motivation

Extract a fragment of code into its own function named after *what it does*, not how it
does it. Do this whenever you have to spend effort understanding a chunk of code — wrap
that understanding in a well-named function so you never have to re-read the body. Small,
well-named functions make code read like prose, remove duplication, and make further
refactorings (like [Move Function](move-function.md)) possible. Don't worry about
short functions being slow; the clarity almost always wins, and named functions are
easier to optimize later.

## Mechanics

1. Create a new function and name it after its **intention** (what it does, not how).
2. Copy the extracted code from the source into the new function body.
3. Scan the extracted code for references to variables that are local in scope to the
   source function. These become **parameters** or, if only used inside, local variables.
   - If a variable is only *read*, pass it as a parameter.
   - If a variable is *assigned to*, be careful:
     - A temp assigned and used only within the extracted code stays a local variable.
     - A variable assigned inside and used later outside should be **returned**. If more
       than one such variable exists, prefer extracting a different piece, or apply
       [Split Variable](split-variable.md) / [Replace Temp with Query](replace-temp-with-query.md) first.
4. Compile / load the code once all variables are sorted out.
5. Replace the extracted fragment in the source with a **call** to the new function.
6. Run the tests.
7. Look for other code that duplicates the extracted fragment and consider replacing it
   with a call too (this is often where the payoff is).

## Example

Before — a long method that prints owing details inline:

```ruby
def print_owing(invoice)
  outstanding = 0

  puts "***********************"
  puts "**** Customer Owes ****"
  puts "***********************"

  invoice[:orders].each { |o| outstanding += o[:amount] }

  puts "name: #{invoice[:customer]}"
  puts "amount: #{outstanding}"
end
```

After extracting the banner and the details:

```ruby
def print_owing(invoice)
  print_banner
  outstanding = calculate_outstanding(invoice)
  print_details(invoice, outstanding)
end

def print_banner
  puts "***********************"
  puts "**** Customer Owes ****"
  puts "***********************"
end

def calculate_outstanding(invoice)
  invoice[:orders].sum { |o| o[:amount] }
end

def print_details(invoice, outstanding)
  puts "name: #{invoice[:customer]}"
  puts "amount: #{outstanding}"
end
```

`print_banner` needed no parameters. `calculate_outstanding` returns the value assigned
inside it. `print_details` takes the two read-only values it needs.

## Related

- Inverse: [Inline Function](inline-function.md)
- If a temp gets in the way of extraction: [Replace Temp with Query](replace-temp-with-query.md), [Split Variable](split-variable.md)
- Too many parameters afterward: [Introduce Parameter Object](introduce-parameter-object.md), [Preserve Whole Object](preserve-whole-object.md)
- To relocate the new function: [Move Function](move-function.md)
