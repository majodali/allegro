# How this book is organized

This book explains the design of Allegro, a
[programmable language platform](vision.md#1-what-allegro-is) whose
defining feature is provable correctness and safety. The book is written
for you: a working programmer who is curious about language design and
new to Allegro's repository. The book aims to present every design and
implementation decision of Allegro with the options it weighed and the
rationale for the option taken. You are invited into the design of
Allegro, which is still under way. The code is organized so that you can branch it to
try another option for a decision, as the explore block of each
[decision section](#def-decision-section) shows.

Most chapters do not yet
follow the organization this preface describes. The chapters are
being rewritten to this organization one at a time. The
[table of contents](README.md) marks each rewritten chapter. The
principles of this preface also bind every author of the book, human or
agent.

## Decisions in dependency order

Decisions come in dependency order: a decision comes after the decisions
it builds on. Everything a decision rests on is therefore explained
before the decision itself. Among decisions that do not depend on each
other, the more significant one comes first. The decisions that shape
most of Allegro arrive as early as their dependencies allow.

A concept is defined where the book first uses it, or where the book settles its meaning. The book marks
each concept at its definition. Every other chapter links its first use
of a concept back to that definition. A concept never appears before its
meaning.

## The seven blocks of a decision section

A <a id="def-decision-section"></a>**decision section** presents one
decision, or a few tightly related decisions. Most decisions have a
decision section of their own. By default, a decision section has seven
blocks, in this order:

1. The *problem* says what has to be decided.
2. The *forces* are the pressures that any answer must balance.
3. The *options* are the answers worth considering, each with its
   strengths and its costs.
4. The *decision and rationale* name the option taken, with the reasons
   for taking it.
5. The *consequences* say what the decision makes possible and what it
   rules out.
6. The *as implemented* block points to the [unit](units.md#def-unit)
   of code that holds the decision.
7. The *explore* block says how to try another option in the code.

Not every decision needs all seven blocks: a decision taken for reasons
of vision or aesthetics may need fewer.

The decision and rationale block may show how a rejected option fails.
The evidence of such a failure is an experiment written into the book,
one you can run again yourself. Nothing in the book, evidence included,
is drawn from the project's history.

## Swappable and foundational decisions

A <a id="def-swappable-decision"></a>**swappable decision** is one for
which trying another option replaces one [unit](units.md#def-unit) of
code behind the unit's interface. A
<a id="def-foundational-decision"></a>**foundational decision** is one
for which trying another option cascades through the decisions that
depend on it. Each [decision section](#def-decision-section) labels its
decision swappable or foundational. The label depends only on what other
decisions rest on the decision, whatever its rationale. Choosing an
offside-rule grammar, where indentation marks block ends, for aesthetic
reasons would likely be a swappable decision. Choosing purely functional
semantics for aesthetic reasons would be a foundational one.
That label tells you what an alternative costs before you branch the
code.

## Open decisions

An <a id="def-open-decision"></a>**open decision** is a decision the
project has not yet taken. Every open decision in the book takes one
shared form. The section of an open decision takes the seven blocks of a
decision section, with the question still open in place of the decision
and rationale. Each open decision invites you to contribute an
alternative. The explore block says how and where to contribute
one.

## The code organized to match the book

Where the code can manage it, a decision lives in one
[unit](units.md#def-unit).

A unit is the smallest body of code that holds one decision, or a group
of decisions that cannot be taken separately. A unit can be replaced by
another unit that offers the replaced unit's interface. The replacement
needs no edit to the units below the replaced unit. The code is divided
into units today, each with the units it may depend on. A check in the
project's test suite fails when a change adds an import that the order
of the units forbids.

Some source files still hold the decisions of several units.

## Prose for people, an intermediate representation for agents

Each chapter of the book has two forms, one for software agents and one
for people. The form for agents is an
[intermediate representation](https://github.com/majodali/methodology/blob/v1.6.0/docs/vocabulary.md#def-intermediate-representation),
a numbered list of claims. Each claim is a single statement with its
evidence and pointers into the code. A
chapter's intermediate representation sits beside its prose, in a file
whose name ends in `.ir.md`. The form for people is prose, like this
preface. The prose keeps every claim of the intermediate representation.

The prose aims to be clear, brief and engaging.

## Tracking numbers and process detail stay outside the book

The text of the book carries no tracking numbers. Each decision and each
chapter has a short, clear name instead. A name tells you what a
decision is about without a lookup. The numbers live in the
[intermediate representations](https://github.com/majodali/methodology/blob/v1.6.0/docs/vocabulary.md#def-intermediate-representation)
and in the project's records, such as its
[decision register](../decisions.md).

The project's process, measurements, file maps and studies live outside
the book's narrative. That separation keeps the narrative on the design
and its reasons.

<!-- render map: C3→¶1 C1→¶1 C4→¶1 C5→¶1 C6→¶1 C78→¶2 C8→¶2 C71→¶2 C2→¶2 C10→¶3 C11→¶3 C12→¶3 C62→¶3 C16→¶4 C17→¶4 C18→¶4 C64→¶4 C19→¶5 C20→¶5 C21→¶5 C22→¶6 C23→¶6 C24→¶6 C25→¶6 C26→¶6 C27→¶6 C28→¶6 C30→¶7 C31→¶8 C32→¶8 C33→¶8 C34→¶9 C35→¶9 C36→¶9 C74→¶9 C75→¶9 C76→¶9 C37→¶9 C38→¶10 C39→¶10 C72→¶10 C40→¶10 C41→¶10 C43→¶11 C44→¶12 C45→¶12 C69→¶12 C46→¶12 C47→¶12 C48→¶13 C50→¶14 C51→¶14 C79→¶14 C52→¶14 C53→¶14 C54→¶14 C55→¶15 C59→¶16 C60→¶16 C67→¶16 C61→¶16 C58→¶17 C73→¶17 -->
