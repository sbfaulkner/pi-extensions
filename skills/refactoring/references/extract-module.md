# Extract Module

**Tag:** dealing-with-inheritance · **Source:** *Refactoring: Ruby Edition*

## Motivation

The mixin sibling of [Extract Class](extract-class.md). When behavior is duplicated across
classes — or a cohesive cluster of methods deserves its own home but needs to operate as
part of its host (calling the host's methods, using its state) — extract it into a module
and `include` it. Choose a module over a class-with-delegation when the extracted behavior
genuinely belongs to the host's interface; choose [Extract Class](extract-class.md) when it
can stand alone behind its own boundary. Beware the module trap: mixins share the host's
namespace and state, so an over-mixed class is a Large Class wearing a disguise.

## Mechanics

1. Create the module, named for the behavior it captures.
2. `include` it in the source class.
3. Move each method of the cluster from the class to the module, one at a time, running
   tests after each. Note what host methods/state the module depends on — keep that surface
   small and explicit.
4. Repeat the `include` for other classes duplicating the behavior, deleting their copies.
5. Run the tests.

## Example

Before — two classes duplicate account-number formatting:

```ruby
class BankAccount
  def masked_account_number
    "****#{@account_number[-4..]}"
  end
end

class CreditCard
  def masked_account_number
    "****#{@account_number[-4..]}"
  end
end
```

After extracting a module:

```ruby
module AccountNumberMasking
  def masked_account_number
    "****#{@account_number[-4..]}"
  end
end

class BankAccount
  include AccountNumberMasking
end

class CreditCard
  include AccountNumberMasking
end
```

## Related

- Inverse: [Inline Module](inline-module.md)
- Standalone-boundary alternative: [Extract Class](extract-class.md)
- Superclass alternative when is-a holds: [Extract Superclass](extract-superclass.md)
- Whole-superclass-to-module conversion: [Replace Abstract Superclass with Module](replace-abstract-superclass-with-module.md)
