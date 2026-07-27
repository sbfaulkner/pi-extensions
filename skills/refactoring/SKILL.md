---
name: refactoring
description: Safely apply refactorings from Martin Fowler's Refactoring catalog (2nd edition + Ruby Edition) to improve code without changing behavior. Use when asked to "refactor", "clean up", "improve", "simplify", or "restructure" code, when tackling code smells (long method, duplicated code, large class, feature envy, etc.), or when you need the safe step-by-step mechanics for a named refactoring like Extract Function, Move Function, or Replace Conditional with Polymorphism. Includes dialect notes for modern Ruby, Sorbet-typed codebases, and Rust.
---

# Refactoring

Refactoring is a **disciplined technique for restructuring existing code, altering its
internal structure without changing its external behavior**. This skill is a dispatcher:
it maps code smells to refactorings, indexes the catalog, and names each refactoring's
reference file with the safe mechanics you should follow.

**Reference files:** mechanics for every refactoring named in this file live at
`references/<kebab-case-name>.md` — e.g. Extract Function → `references/extract-function.md`,
Replace Nested Conditional with Guard Clauses →
`references/replace-nested-conditional-with-guard-clauses.md`.

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

## Dialects

Examples throughout are Ruby. Before applying mechanics, load the dialect note for your
working context:

- [Modern Ruby](references/dialects/ruby.md) — baseline for any Ruby codebase: `Data.define`
  targets, pattern matching, keyword arguments, `&.`, immutability.
- [Sorbet](references/dialects/sorbet.md) — typed-Ruby overlay (load with the Ruby note):
  `srb tc`-driven mechanics, the `sealed!`/`T.absurd` inversion, `T::Struct` targets.
- [Rust](references/dialects/rust.md) — cross-language remap: inheritance → traits/enums,
  exceptions → `Result`, borrow-aware extraction.

## Code smell → refactoring lookup

Use this to go from a symptom to the refactorings that address it, then load the
reference files for mechanics.

| Smell | Try these refactorings |
|-------|------------------------|
| **Mysterious Name** | Change Function Declaration, Rename Variable, Rename Field |
| **Duplicated Code** | Extract Function, Slide Statements, Pull Up Method, Extract Surrounding Method, Extract Module |
| **Long Function** | Extract Function, Replace Temp with Query, Introduce Parameter Object, Preserve Whole Object, Decompose Conditional, Replace Conditional with Polymorphism, Split Loop |
| **Long Parameter List** | Replace Parameter with Query, Preserve Whole Object, Introduce Parameter Object, Remove Flag Argument, Combine Functions into Class |
| **Global Data / Mutable Data** | Encapsulate Variable, Split Variable, Slide Statements, Extract Function, Separate Query from Modifier, Remove Setting Method, Replace Derived Variable with Query, Change Reference to Value |
| **Divergent Change** | Split Phase, Move Function, Extract Function, Extract Class |
| **Shotgun Surgery** | Move Function, Move Field, Combine Functions into Class, Combine Functions into Transform, Inline Function, Inline Class |
| **Feature Envy** | Move Function, Extract Function |
| **Data Clumps** | Extract Class, Introduce Parameter Object, Preserve Whole Object |
| **Primitive Obsession** | Replace Primitive with Object, Replace Type Code with Subclasses, Replace Conditional with Polymorphism, Extract Class, Introduce Parameter Object |
| **Repeated Switches** | Replace Conditional with Polymorphism, Replace Conditional with Visitor |
| **Loops** | Replace Loop with Pipeline, Split Loop |
| **Lazy Element** | Inline Function, Inline Class, Collapse Hierarchy |
| **Speculative Generality** | Collapse Hierarchy, Inline Function, Inline Class, Change Function Declaration, Remove Dead Code |
| **Temporary Field** | Extract Class, Move Function, Introduce Special Case |
| **Message Chains** | Hide Delegate, Extract Function, Move Function |
| **Middle Man** | Remove Middle Man, Inline Function, Replace Superclass with Delegate, Replace Subclass with Delegate |
| **Insider Trading** | Move Function, Move Field, Hide Delegate, Replace Subclass with Delegate |
| **Large Class** | Extract Class, Extract Superclass, Replace Type Code with Subclasses |
| **Alternative Classes with Different Interfaces** | Change Function Declaration, Move Function, Extract Superclass |
| **Data Class** | Encapsulate Record, Remove Setting Method, Move Function, Extract Function, Split Phase |
| **Refused Bequest** | Push Down Method, Push Down Field, Replace Subclass with Delegate, Replace Superclass with Delegate |
| **Comments (explaining bad code)** | Extract Function, Change Function Declaration, Introduce Assertion |
| **Incomplete Library Class** | Introduce Foreign Method, Introduce Local Extension, Introduce Gateway |
| **Opaque `method_missing`** | Replace Dynamic Receptor with Dynamic Method Definition, Isolate Dynamic Receptor |
| **Hash-Driven Data** (a hash accreting keys) | Replace Hash with Object, Encapsulate Record, Introduce Parameter Object |
| **Complex Conditional** | Decompose Conditional, Consolidate Conditional Expression, Replace Nested Conditional with Guard Clauses, Replace Conditional with Polymorphism, Reverse Conditional, Remove Double Negative |

## Catalog (grouped by tag)

Each entry has a reference file with **Motivation**, **Mechanics** (safe numbered
steps), a **Ruby example**, and **inverse / related** cross-links. Names in *italics*
are aliases — older or alternate names for the same refactoring. Entries marked
*(Ruby Edition)* come from *Refactoring: Ruby Edition* (Fields, Harvie, Fowler), and
entries marked *(1st edition)* survive only from the original 1999 book; neither group is
carded on the 2nd-edition catalog index page. Entries marked *(guest)* are guest
contributions hosted on the refactoring.com catalog, credited to their authors.

### basic

- Extract Function — *(alias: Extract Method)*
- Inline Function — *(alias: Inline Method)*
- Extract Variable — *(alias: Introduce Explaining Variable)*
- Inline Variable — *(alias: Inline Temp)*
- Change Function Declaration — *(aliases: Add Parameter, Remove Parameter, Rename Function/Method, Change Signature)*
- Encapsulate Variable — *(aliases: Encapsulate Field, Self-Encapsulate Field)*
- Rename Variable
- Introduce Parameter Object
- Combine Functions into Class
- Combine Functions into Transform
- Split Phase
- Extract Surrounding Method — *(Ruby Edition)*
- Introduce Class Annotation — *(Ruby Edition)*
- Dynamic Method Definition — *(Ruby Edition)*
- Replace Dynamic Receptor with Dynamic Method Definition — *(Ruby Edition)*
- Isolate Dynamic Receptor — *(Ruby Edition)*
- Move Eval from Runtime to Parse Time — *(Ruby Edition)*
- Replace Temp with Chain — *(Ruby Edition)*

### encapsulation

- Encapsulate Record — *(alias: Replace Record with Data Class)*
- Encapsulate Collection
- Replace Primitive with Object — *(aliases: Replace Data Value with Object, Replace Type Code with Class)*
- Replace Temp with Query
- Extract Class
- Inline Class
- Hide Delegate
- Remove Middle Man
- Substitute Algorithm

### moving-features

- Move Function — *(alias: Move Method)*
- Move Field
- Move Statements into Function
- Move Statements to Callers
- Replace Inline Code with Function Call
- Slide Statements — *(related: Consolidate Duplicate Conditional Fragments)*
- Split Loop
- Replace Loop with Pipeline — *(alias: Replace Loop with Collection Closure Method)*
- Remove Dead Code
- Introduce Gateway — *(Ruby Edition)*
- Introduce Expression Builder — *(Ruby Edition)*
- Introduce Foreign Method — *(1st edition)*
- Introduce Local Extension — *(1st edition)*
- Replace Iteration with Recursion — *(guest: Dave Whipp)*
- Replace Recursion with Iteration — *(guest: Ivan Mitrovic)*

### organizing-data

- Split Variable — *(aliases: Remove Assignments to Parameters, Split Temp)*
- Rename Field
- Replace Derived Variable with Query
- Change Reference to Value
- Change Value to Reference
- Replace Magic Literal — *(alias: Replace Magic Number with Symbolic Constant)*
- Lazily Initialized Attribute — *(Ruby Edition)*
- Eagerly Initialized Attribute — *(Ruby Edition)*
- Replace Hash with Object — *(Ruby Edition)*
- Replace Array with Object — *(1st edition)*
- Duplicate Observed Data — *(1st edition; largely historical)*
- Change Unidirectional Association to Bidirectional — *(1st edition)*
- Change Bidirectional Association to Unidirectional — *(1st edition)*
- Reduce Scope of Variable — *(guest: Mats Henricson)*
- Replace Assignment with Initialization — *(guest: Mats Henricson)*

### simplify-conditional-logic

- Decompose Conditional
- Consolidate Conditional Expression
- Replace Nested Conditional with Guard Clauses
- Replace Conditional with Polymorphism
- Introduce Special Case — *(alias: Introduce Null Object)*
- Introduce Assertion
- Replace Control Flag with Break — *(alias: Remove Control Flag)*
- Recompose Conditional — *(Ruby Edition)*
- Reverse Conditional — *(guest: Bill Murphy & Martin Fowler)*
- Remove Double Negative — *(guest: Ashley Frieze & Martin Fowler)*
- Replace Conditional with Visitor — *(guest: Martin Fowler)*

### refactoring-apis

- Separate Query from Modifier
- Parameterize Function — *(alias: Parameterize Method)*
- Remove Flag Argument — *(alias: Replace Parameter with Explicit Methods)*
- Preserve Whole Object
- Replace Parameter with Query — *(alias: Replace Parameter with Method)*
- Replace Query with Parameter
- Remove Setting Method
- Replace Constructor with Factory Function — *(alias: Replace Constructor with Factory Method)*
- Replace Function with Command — *(alias: Replace Method with Method Object)*
- Replace Command with Function
- Return Modified Value
- Replace Error Code with Exception
- Replace Exception with Precheck — *(alias: Replace Exception with Test)*
- Introduce Named Parameter — *(Ruby Edition)*
- Remove Named Parameter — *(Ruby Edition)*
- Remove Unused Default Parameter — *(Ruby Edition)*
- Encapsulate Downcast — *(1st edition; reframed for Sorbet's `T.cast`/`T.must`)*
- Hide Method — *(1st edition)*

### dealing-with-inheritance

- Pull Up Method
- Pull Up Field
- Pull Up Constructor Body
- Push Down Method
- Push Down Field
- Replace Type Code with Subclasses — *(aliases: Extract Subclass, Replace Type Code with State/Strategy, Replace Type Code with Polymorphism)*
- Remove Subclass — *(alias: Replace Subclass with Fields)*
- Extract Superclass
- Collapse Hierarchy
- Replace Subclass with Delegate
- Replace Superclass with Delegate — *(alias: Replace Inheritance with Delegation)*
- Replace Abstract Superclass with Module — *(Ruby Edition)*
- Extract Module — *(Ruby Edition)*
- Inline Module — *(Ruby Edition)*
- Replace Type Code with Module Extension — *(Ruby Edition)*
- Form Template Method — *(1st edition)*
- Extract Interface — *(1st edition)*
- Replace Delegation with Inheritance — *(1st edition; Ruby Edition variant: Replace Delegation with Hierarchy)*

## How to use this skill

1. Identify the smell or the named refactoring the user wants.
2. Look it up in the table or catalog above and load its reference file
   (`references/<kebab-case-name>.md`).
3. Confirm tests are green, then execute the numbered mechanics one step at a time,
   running tests after each.
4. Commit the refactoring separately from any behavior change.

Source: Martin Fowler, *Refactoring: Improving the Design of Existing Code*, 2nd ed.
(and *Refactoring: Ruby Edition*, Fields, Harvie, Fowler & Beck). Online catalog:
<https://refactoring.com/catalog/>.
