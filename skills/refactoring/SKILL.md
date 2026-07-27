---
name: refactoring
description: Safely apply refactorings from Martin Fowler's Refactoring catalog (2nd edition + Ruby Edition) to improve code without changing behavior. Use when asked to "refactor", "clean up", "improve", "simplify", or "restructure" code, when tackling code smells (long method, duplicated code, large class, feature envy, etc.), or when you need the safe step-by-step mechanics for a named refactoring like Extract Function, Move Function, or Replace Conditional with Polymorphism.
---

# Refactoring

Refactoring is a **disciplined technique for restructuring existing code, altering its
internal structure without changing its external behavior**. This skill is a dispatcher:
it maps code smells to refactorings, indexes the catalog, and links each refactoring to a
reference file with the safe mechanics you should follow.

## Core principle: small, behavior-preserving steps

The value of refactoring is in *how* you do it, not just the end state. Always:

1. **Start green.** Make sure you have tests and they pass before you touch anything. If a
   region lacks tests, add characterization tests first.
2. **Take the smallest step the mechanics allow.** Each numbered step in a reference file
   is designed to keep the code working.
3. **Run the tests after every step.** If they go red, you either made a mistake or the
   step was too big — revert to green and take a smaller step.
4. **Commit frequently.** Small commits let you back out a bad step cheaply. Keep
   refactoring commits separate from behavior-changing commits.
5. **Never mix refactoring with feature work.** Put on one "hat" at a time (Kent Beck's
   Two Hats): either you are adding behavior *or* you are refactoring, never both at once.

If you don't have tests and can't add them, say so and proceed with extra caution using
the most conservative (automated, if available) mechanics.

## When NOT to refactor

- When you're about to rewrite the code anyway.
- When you can't get it green (no tests, can't add them, and the change is risky).
- Deadline-driven: only if the refactoring won't pay off before the deadline. "Refactor
  when you add a function, when you fix a bug, and when you do a code review" (the Rule of
  Three: refactor on the third duplication).

## Code smell → refactoring lookup

Use this to go from a symptom to the refactorings that address it. Follow the links to the
reference files for mechanics.

| Smell | Try these refactorings |
|-------|------------------------|
| **Mysterious Name** | [Change Function Declaration](references/change-function-declaration.md), [Rename Variable](references/rename-variable.md), [Rename Field](references/rename-field.md) |
| **Duplicated Code** | [Extract Function](references/extract-function.md), [Slide Statements](references/slide-statements.md), [Pull Up Method](references/pull-up-method.md), [Extract Surrounding Method](references/extract-surrounding-method.md), [Extract Module](references/extract-module.md) |
| **Long Function** | [Extract Function](references/extract-function.md), [Replace Temp with Query](references/replace-temp-with-query.md), [Introduce Parameter Object](references/introduce-parameter-object.md), [Preserve Whole Object](references/preserve-whole-object.md), [Decompose Conditional](references/decompose-conditional.md), [Replace Conditional with Polymorphism](references/replace-conditional-with-polymorphism.md), [Split Loop](references/split-loop.md) |
| **Long Parameter List** | [Replace Parameter with Query](references/replace-parameter-with-query.md), [Preserve Whole Object](references/preserve-whole-object.md), [Introduce Parameter Object](references/introduce-parameter-object.md), [Remove Flag Argument](references/remove-flag-argument.md), [Combine Functions into Class](references/combine-functions-into-class.md) |
| **Global Data / Mutable Data** | [Encapsulate Variable](references/encapsulate-variable.md), [Split Variable](references/split-variable.md), [Slide Statements](references/slide-statements.md), [Extract Function](references/extract-function.md), [Separate Query from Modifier](references/separate-query-from-modifier.md), [Remove Setting Method](references/remove-setting-method.md), [Replace Derived Variable with Query](references/replace-derived-variable-with-query.md), [Change Reference to Value](references/change-reference-to-value.md) |
| **Divergent Change** | [Split Phase](references/split-phase.md), [Move Function](references/move-function.md), [Extract Function](references/extract-function.md), [Extract Class](references/extract-class.md) |
| **Shotgun Surgery** | [Move Function](references/move-function.md), [Move Field](references/move-field.md), [Combine Functions into Class](references/combine-functions-into-class.md), [Combine Functions into Transform](references/combine-functions-into-transform.md), [Inline Function](references/inline-function.md), [Inline Class](references/inline-class.md) |
| **Feature Envy** | [Move Function](references/move-function.md), [Extract Function](references/extract-function.md) |
| **Data Clumps** | [Extract Class](references/extract-class.md), [Introduce Parameter Object](references/introduce-parameter-object.md), [Preserve Whole Object](references/preserve-whole-object.md) |
| **Primitive Obsession** | [Replace Primitive with Object](references/replace-primitive-with-object.md), [Replace Type Code with Subclasses](references/replace-type-code-with-subclasses.md), [Replace Conditional with Polymorphism](references/replace-conditional-with-polymorphism.md), [Extract Class](references/extract-class.md), [Introduce Parameter Object](references/introduce-parameter-object.md) |
| **Repeated Switches** | [Replace Conditional with Polymorphism](references/replace-conditional-with-polymorphism.md), [Replace Conditional with Visitor](references/replace-conditional-with-visitor.md) |
| **Loops** | [Replace Loop with Pipeline](references/replace-loop-with-pipeline.md), [Split Loop](references/split-loop.md) |
| **Lazy Element** | [Inline Function](references/inline-function.md), [Inline Class](references/inline-class.md), [Collapse Hierarchy](references/collapse-hierarchy.md) |
| **Speculative Generality** | [Collapse Hierarchy](references/collapse-hierarchy.md), [Inline Function](references/inline-function.md), [Inline Class](references/inline-class.md), [Change Function Declaration](references/change-function-declaration.md), [Remove Dead Code](references/remove-dead-code.md) |
| **Temporary Field** | [Extract Class](references/extract-class.md), [Move Function](references/move-function.md), [Introduce Special Case](references/introduce-special-case.md) |
| **Message Chains** | [Hide Delegate](references/hide-delegate.md), [Extract Function](references/extract-function.md), [Move Function](references/move-function.md) |
| **Middle Man** | [Remove Middle Man](references/remove-middle-man.md), [Inline Function](references/inline-function.md), [Replace Superclass with Delegate](references/replace-superclass-with-delegate.md), [Replace Subclass with Delegate](references/replace-subclass-with-delegate.md) |
| **Insider Trading** | [Move Function](references/move-function.md), [Move Field](references/move-field.md), [Hide Delegate](references/hide-delegate.md), [Replace Subclass with Delegate](references/replace-subclass-with-delegate.md) |
| **Large Class** | [Extract Class](references/extract-class.md), [Extract Superclass](references/extract-superclass.md), [Replace Type Code with Subclasses](references/replace-type-code-with-subclasses.md) |
| **Alternative Classes with Different Interfaces** | [Change Function Declaration](references/change-function-declaration.md), [Move Function](references/move-function.md), [Extract Superclass](references/extract-superclass.md) |
| **Data Class** | [Encapsulate Record](references/encapsulate-record.md), [Remove Setting Method](references/remove-setting-method.md), [Move Function](references/move-function.md), [Extract Function](references/extract-function.md), [Split Phase](references/split-phase.md) |
| **Refused Bequest** | [Push Down Method](references/push-down-method.md), [Push Down Field](references/push-down-field.md), [Replace Subclass with Delegate](references/replace-subclass-with-delegate.md), [Replace Superclass with Delegate](references/replace-superclass-with-delegate.md) |
| **Comments (explaining bad code)** | [Extract Function](references/extract-function.md), [Change Function Declaration](references/change-function-declaration.md), [Introduce Assertion](references/introduce-assertion.md) |
| **Incomplete Library Class** | [Introduce Foreign Method](references/introduce-foreign-method.md), [Introduce Local Extension](references/introduce-local-extension.md), [Introduce Gateway](references/introduce-gateway.md) |
| **Opaque `method_missing`** | [Replace Dynamic Receptor with Dynamic Method Definition](references/replace-dynamic-receptor-with-dynamic-method-definition.md), [Isolate Dynamic Receptor](references/isolate-dynamic-receptor.md) |
| **Hash-Driven Data** (a hash accreting keys) | [Replace Hash with Object](references/replace-hash-with-object.md), [Encapsulate Record](references/encapsulate-record.md), [Introduce Parameter Object](references/introduce-parameter-object.md) |
| **Complex Conditional** | [Decompose Conditional](references/decompose-conditional.md), [Consolidate Conditional Expression](references/consolidate-conditional-expression.md), [Replace Nested Conditional with Guard Clauses](references/replace-nested-conditional-with-guard-clauses.md), [Replace Conditional with Polymorphism](references/replace-conditional-with-polymorphism.md), [Reverse Conditional](references/reverse-conditional.md), [Remove Double Negative](references/remove-double-negative.md) |

## Catalog (grouped by tag)

Each entry links to a reference file with **Motivation**, **Mechanics** (safe numbered
steps), a **Ruby example**, and **inverse / related** cross-links. Names in *italics*
are aliases — older or alternate names for the same refactoring. Entries marked
*(Ruby Edition)* come from *Refactoring: Ruby Edition* (Fields, Harvie, Fowler), and
entries marked *(1st edition)* survive only from the original 1999 book; neither group is
carded on the 2nd-edition catalog index page. Entries marked *(guest)* are guest
contributions hosted on the refactoring.com catalog, credited to their authors.

### basic

- [Extract Function](references/extract-function.md) — *(alias: Extract Method)*
- [Inline Function](references/inline-function.md) — *(alias: Inline Method)*
- [Extract Variable](references/extract-variable.md) — *(alias: Introduce Explaining Variable)*
- [Inline Variable](references/inline-variable.md) — *(alias: Inline Temp)*
- [Change Function Declaration](references/change-function-declaration.md) — *(aliases: Add Parameter, Remove Parameter, Rename Function/Method, Change Signature)*
- [Encapsulate Variable](references/encapsulate-variable.md) — *(aliases: Encapsulate Field, Self-Encapsulate Field)*
- [Rename Variable](references/rename-variable.md)
- [Introduce Parameter Object](references/introduce-parameter-object.md)
- [Combine Functions into Class](references/combine-functions-into-class.md)
- [Combine Functions into Transform](references/combine-functions-into-transform.md)
- [Split Phase](references/split-phase.md)
- [Extract Surrounding Method](references/extract-surrounding-method.md) — *(Ruby Edition)*
- [Introduce Class Annotation](references/introduce-class-annotation.md) — *(Ruby Edition)*
- [Dynamic Method Definition](references/dynamic-method-definition.md) — *(Ruby Edition)*
- [Replace Dynamic Receptor with Dynamic Method Definition](references/replace-dynamic-receptor-with-dynamic-method-definition.md) — *(Ruby Edition)*
- [Isolate Dynamic Receptor](references/isolate-dynamic-receptor.md) — *(Ruby Edition)*
- [Move Eval from Runtime to Parse Time](references/move-eval-from-runtime-to-parse-time.md) — *(Ruby Edition)*
- [Replace Temp with Chain](references/replace-temp-with-chain.md) — *(Ruby Edition)*

### encapsulation

- [Encapsulate Record](references/encapsulate-record.md) — *(alias: Replace Record with Data Class)*
- [Encapsulate Collection](references/encapsulate-collection.md)
- [Replace Primitive with Object](references/replace-primitive-with-object.md) — *(aliases: Replace Data Value with Object, Replace Type Code with Class)*
- [Replace Temp with Query](references/replace-temp-with-query.md)
- [Extract Class](references/extract-class.md)
- [Inline Class](references/inline-class.md)
- [Hide Delegate](references/hide-delegate.md)
- [Remove Middle Man](references/remove-middle-man.md)
- [Substitute Algorithm](references/substitute-algorithm.md)

### moving-features

- [Move Function](references/move-function.md) — *(alias: Move Method)*
- [Move Field](references/move-field.md)
- [Move Statements into Function](references/move-statements-into-function.md)
- [Move Statements to Callers](references/move-statements-to-callers.md)
- [Replace Inline Code with Function Call](references/replace-inline-code-with-function-call.md)
- [Slide Statements](references/slide-statements.md) — *(related: Consolidate Duplicate Conditional Fragments)*
- [Split Loop](references/split-loop.md)
- [Replace Loop with Pipeline](references/replace-loop-with-pipeline.md) — *(alias: Replace Loop with Collection Closure Method)*
- [Remove Dead Code](references/remove-dead-code.md)
- [Introduce Gateway](references/introduce-gateway.md) — *(Ruby Edition)*
- [Introduce Expression Builder](references/introduce-expression-builder.md) — *(Ruby Edition)*
- [Introduce Foreign Method](references/introduce-foreign-method.md) — *(1st edition)*
- [Introduce Local Extension](references/introduce-local-extension.md) — *(1st edition)*
- [Replace Iteration with Recursion](references/replace-iteration-with-recursion.md) — *(guest: Dave Whipp)*
- [Replace Recursion with Iteration](references/replace-recursion-with-iteration.md) — *(guest: Ivan Mitrovic)*

### organizing-data

- [Split Variable](references/split-variable.md) — *(aliases: Remove Assignments to Parameters, Split Temp)*
- [Rename Field](references/rename-field.md)
- [Replace Derived Variable with Query](references/replace-derived-variable-with-query.md)
- [Change Reference to Value](references/change-reference-to-value.md)
- [Change Value to Reference](references/change-value-to-reference.md)
- [Replace Magic Literal](references/replace-magic-literal.md) — *(alias: Replace Magic Number with Symbolic Constant)*
- [Lazily Initialized Attribute](references/lazily-initialized-attribute.md) — *(Ruby Edition)*
- [Eagerly Initialized Attribute](references/eagerly-initialized-attribute.md) — *(Ruby Edition)*
- [Replace Hash with Object](references/replace-hash-with-object.md) — *(Ruby Edition)*
- [Replace Array with Object](references/replace-array-with-object.md) — *(1st edition)*
- [Duplicate Observed Data](references/duplicate-observed-data.md) — *(1st edition; largely historical)*
- [Change Unidirectional Association to Bidirectional](references/change-unidirectional-association-to-bidirectional.md) — *(1st edition)*
- [Change Bidirectional Association to Unidirectional](references/change-bidirectional-association-to-unidirectional.md) — *(1st edition)*
- [Reduce Scope of Variable](references/reduce-scope-of-variable.md) — *(guest: Mats Henricson)*
- [Replace Assignment with Initialization](references/replace-assignment-with-initialization.md) — *(guest: Mats Henricson)*

### simplify-conditional-logic

- [Decompose Conditional](references/decompose-conditional.md)
- [Consolidate Conditional Expression](references/consolidate-conditional-expression.md)
- [Replace Nested Conditional with Guard Clauses](references/replace-nested-conditional-with-guard-clauses.md)
- [Replace Conditional with Polymorphism](references/replace-conditional-with-polymorphism.md)
- [Introduce Special Case](references/introduce-special-case.md) — *(alias: Introduce Null Object)*
- [Introduce Assertion](references/introduce-assertion.md)
- [Replace Control Flag with Break](references/replace-control-flag-with-break.md) — *(alias: Remove Control Flag)*
- [Recompose Conditional](references/recompose-conditional.md) — *(Ruby Edition)*
- [Reverse Conditional](references/reverse-conditional.md) — *(guest: Bill Murphy & Martin Fowler)*
- [Remove Double Negative](references/remove-double-negative.md) — *(guest: Ashley Frieze & Martin Fowler)*
- [Replace Conditional with Visitor](references/replace-conditional-with-visitor.md) — *(guest: Martin Fowler)*

### refactoring-apis

- [Separate Query from Modifier](references/separate-query-from-modifier.md)
- [Parameterize Function](references/parameterize-function.md) — *(alias: Parameterize Method)*
- [Remove Flag Argument](references/remove-flag-argument.md) — *(alias: Replace Parameter with Explicit Methods)*
- [Preserve Whole Object](references/preserve-whole-object.md)
- [Replace Parameter with Query](references/replace-parameter-with-query.md) — *(alias: Replace Parameter with Method)*
- [Replace Query with Parameter](references/replace-query-with-parameter.md)
- [Remove Setting Method](references/remove-setting-method.md)
- [Replace Constructor with Factory Function](references/replace-constructor-with-factory-function.md) — *(alias: Replace Constructor with Factory Method)*
- [Replace Function with Command](references/replace-function-with-command.md) — *(alias: Replace Method with Method Object)*
- [Replace Command with Function](references/replace-command-with-function.md)
- [Return Modified Value](references/return-modified-value.md)
- [Replace Error Code with Exception](references/replace-error-code-with-exception.md)
- [Replace Exception with Precheck](references/replace-exception-with-precheck.md) — *(alias: Replace Exception with Test)*
- [Introduce Named Parameter](references/introduce-named-parameter.md) — *(Ruby Edition)*
- [Remove Named Parameter](references/remove-named-parameter.md) — *(Ruby Edition)*
- [Remove Unused Default Parameter](references/remove-unused-default-parameter.md) — *(Ruby Edition)*
- [Encapsulate Downcast](references/encapsulate-downcast.md) — *(1st edition; reframed for Sorbet's `T.cast`/`T.must`)*
- [Hide Method](references/hide-method.md) — *(1st edition)*

### dealing-with-inheritance

- [Pull Up Method](references/pull-up-method.md)
- [Pull Up Field](references/pull-up-field.md)
- [Pull Up Constructor Body](references/pull-up-constructor-body.md)
- [Push Down Method](references/push-down-method.md)
- [Push Down Field](references/push-down-field.md)
- [Replace Type Code with Subclasses](references/replace-type-code-with-subclasses.md) — *(aliases: Extract Subclass, Replace Type Code with State/Strategy, Replace Type Code with Polymorphism)*
- [Remove Subclass](references/remove-subclass.md) — *(alias: Replace Subclass with Fields)*
- [Extract Superclass](references/extract-superclass.md)
- [Collapse Hierarchy](references/collapse-hierarchy.md)
- [Replace Subclass with Delegate](references/replace-subclass-with-delegate.md)
- [Replace Superclass with Delegate](references/replace-superclass-with-delegate.md) — *(alias: Replace Inheritance with Delegation)*
- [Replace Abstract Superclass with Module](references/replace-abstract-superclass-with-module.md) — *(Ruby Edition)*
- [Extract Module](references/extract-module.md) — *(Ruby Edition)*
- [Inline Module](references/inline-module.md) — *(Ruby Edition)*
- [Replace Type Code with Module Extension](references/replace-type-code-with-module-extension.md) — *(Ruby Edition)*
- [Form Template Method](references/form-template-method.md) — *(1st edition)*
- [Extract Interface](references/extract-interface.md) — *(1st edition)*
- [Replace Delegation with Inheritance](references/replace-delegation-with-inheritance.md) — *(1st edition; Ruby Edition variant: Replace Delegation with Hierarchy)*

## How to use this skill

1. Identify the smell or the named refactoring the user wants.
2. Look it up in the table or catalog above and open the reference file.
3. Confirm tests are green, then execute the numbered mechanics one step at a time,
   running tests after each.
4. Commit the refactoring separately from any behavior change.

Source: Martin Fowler, *Refactoring: Improving the Design of Existing Code*, 2nd ed.
(and *Refactoring: Ruby Edition*, Fields, Harvie, Fowler & Beck). Online catalog:
<https://refactoring.com/catalog/>.
