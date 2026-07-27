# Dialect: Rust

**Scope:** cross-language remap. The catalog's mechanics are language-agnostic but assume
an OO language with inheritance, exceptions, and a GC. Rust has none of the three, so
several refactorings remap, invert, or disappear. Examples here are Rust, not Ruby.

## Exceptions at a glance

| Refactoring | Status | Why |
|---|---|---|
| [Replace Error Code with Exception](../replace-error-code-with-exception.md) | inverted | `Result` *is* the idiom; the useful move is the reverse — replace `panic!`/`unwrap` with `Result` (see below) |
| [Collapse Hierarchy](../collapse-hierarchy.md), [Replace Delegation with Inheritance](../replace-delegation-with-inheritance.md) | N/A | no implementation inheritance to collapse or delegate to |
| Ruby metaprogramming set ([Dynamic Method Definition](../dynamic-method-definition.md), [Isolate Dynamic Receptor](../isolate-dynamic-receptor.md), …) | N/A | no open classes or `method_missing`; macros are a different tool with different refactorings |
| [Introduce Special Case](../introduce-special-case.md) | absorbed | `Option<T>` + `unwrap_or_default`/`impl Default` is the built-in null object |
| [Change Value to Reference](../change-value-to-reference.md) / [Change Reference to Value](../change-reference-to-value.md) | literalized | this is ownership design: value = owned/`Clone`, reference = `Rc`/`Arc`; the borrow checker enforces what the books ask you to be careful about |

## Inheritance chapter → traits and enums

| Book refactoring | Rust move |
|---|---|
| [Extract Superclass](../extract-superclass.md) | extract a trait (default methods carry shared behavior) |
| [Extract Interface](../extract-interface.md) | extract a trait (this one maps exactly) |
| [Replace Type Code with Subclasses](../replace-type-code-with-subclasses.md) | make it an `enum`; `match` is exhaustive by default |
| [Replace Conditional with Polymorphism](../replace-conditional-with-polymorphism.md) | closed set → `enum` + `match` (the compiler checks exhaustiveness — same inversion as Sorbet's `sealed!`); open set → trait objects (`dyn Trait`) or generics |
| [Pull Up Method](../pull-up-method.md) | move method into a default trait implementation |
| [Replace Subclass with Delegate](../replace-subclass-with-delegate.md) / [Replace Superclass with Delegate](../replace-superclass-with-delegate.md) | composition is already the only option; the smell they fix can't arise |
| [Form Template Method](../form-template-method.md) | trait with default method calling required methods |

## Errors: Replace Panic with Result

The catalog's exception advice runs backwards here. The refactoring worth doing is
mechanical de-panicking, using [Replace Error Code with Exception](../replace-error-code-with-exception.md)'s
mechanics with the direction flipped:

```rust
// Before
fn parse_port(s: &str) -> u16 {
    s.parse().expect("invalid port")
}

// After
fn parse_port(s: &str) -> Result<u16, ParseIntError> {
    s.parse()
}
```

Change one function to return `Result`, let the compiler flag every caller (the `srb tc`
analogue), propagate with `?`, and reserve `panic!` for genuine programming errors —
which is what [Introduce Assertion](../introduce-assertion.md) becomes (`assert!`,
`debug_assert!`).

## Loops → iterator chains

[Replace Loop with Pipeline](../replace-loop-with-pipeline.md) is strictly better in Rust:
iterator adapters are zero-cost and often *more* optimizable than the loop. [Split Loop](../split-loop.md)'s
"but performance" caveat usually dissolves — two chained passes over an iterator fuse well.

## Extract Function's variable analysis becomes borrow analysis

The book's hard part — which locals go in, which come out — gains a dimension: extracting
code that mutates two fields of `self` into a method borrows `&mut self` twice and fails
the borrow check, even though the inline original compiled.

Remedies, in preference order:

1. Extract a *free function* taking exactly the fields it needs (`fn update(a: &mut A, b: &B)`)
   — disjoint field borrows are fine when they're separate parameters.
2. [Extract Class](../extract-class.md): if two fields are always borrowed together, they
   want to be one struct with the method on it.
3. Restructure to take values and [Return Modified Value](../return-modified-value.md)
   instead of mutating through borrows.

The compiler error is information: the extraction boundary you chose crosses an ownership
seam, which is the same signal Feature Envy gives in OO code.

## Visibility

[Hide Method](../hide-method.md) / [Encapsulate Variable](../encapsulate-variable.md):
Rust's default is already private; the graded `pub(crate)`/`pub(super)` scopes make
"reduce visibility to the minimum that compiles" a mechanical loop the compiler drives.
