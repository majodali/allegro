# How this book is organized

> **Reader.** You are a working programmer who is curious about language design and has never seen Allegro's repository.
>
> **Authority.** The principles of this preface bind every author of the book, human or agent.

This book explains the design of Allegro, a
[programmable language platform](vision.md#1-what-allegro-is) whose
defining feature is provable correctness and safety. The book presents
every design and implementation decision of Allegro with the options the
decision weighed and the rationale for the option taken. Designing
Allegro is an open journey that the book invites you to join. The code
is organized so that you can branch it to try another option for a
decision.

Most chapters do not yet follow the organization this preface describes.
The book is being rewritten to this organization one chapter at a time.
The tour that is to open the book is not yet written.

## Decisions in dependency order

A decision comes after the decisions it builds on. You therefore meet
each decision with everything it rests on already explained. Among
decisions that do not depend on each other, the more significant one
comes first. You meet the decisions that shape the most of Allegro as
early as their dependencies allow.

A tour opens the book by telling Allegro's big bets as a story. The tour
points forward to the full treatment of each bet. After the tour, the
book descends through the decisions in dependency order. The tour lets
you see where the descent is going before it begins.

A concept is defined where the book first uses it, or where the book
decides it. The book marks each concept at its definition. Every other
chapter links its first use of a concept back to that definition. You
therefore meet the meaning of each concept no later than its first use.

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

The seven-block shape is a default. A decision about the language's
vision or aesthetics may need fewer blocks.

An option's rationale may show how the option fails. The evidence of a
failure is an experiment written for the book and included in it. Any
reader can run an experiment in the book again. Nothing in the book is
drawn from the project's history.

## Swappable and foundational decisions

A <a id="def-swappable-decision"></a>**swappable decision** is one for
which trying another option replaces one [unit](units.md#def-unit) of
code behind the unit's interface. A
<a id="def-foundational-decision"></a>**foundational decision** is one
for which trying another option cascades through the decisions that
depend on it. Each [decision section](#def-decision-section) labels its
decision swappable or foundational. The label tells you what an
alternative costs before you branch the code.

## Open decisions as invitations

An <a id="def-open-decision"></a>**open decision** is a decision the
project has not yet taken. Every open decision in the book takes one
shared form. Each open decision invites you to contribute an
alternative. The section of an open decision says how to make the
contribution.

## The code organized to match the book [partial]

The code is organized to match the book. Where the code can manage it, a
decision lives in one [unit](units.md#def-unit).

A unit is the smallest body of code that holds one decision, or a group
of decisions that cannot be taken separately. A unit can be replaced by
another unit that offers the replaced unit's interface, without editing
the units below it. The code is divided into units today, each with the
units it may depend on. A check in the project's test gate fails when a
change adds an import that the order of the units forbids.

Some source files still hold the decisions of several units. Such a file
is split when its code is next changed for another reason.

## Two forms of each chapter

Each chapter of the book has two forms, one for software agents and one
for people. The form for agents is an
[intermediate representation](https://github.com/majodali/methodology/blob/v1.6.0/docs/vocabulary.md#def-intermediate-representation):
numbered claims, each with its evidence and pointers into the code. A
chapter's intermediate representation sits beside its prose, in a file
whose name ends in `.ir.md`. The form for people is prose, like this
preface. The prose keeps every claim of the intermediate representation.

The prose aims to be engaging, clear and succinct. Writing the prose
from the claims helps break the phrasing habits that agents fall into.
Many of those habits make text less clear.

## Process detail and tracking numbers stay outside the book

How the project is worked on lives outside the book's narrative: its
process, its measurements, its file maps and its studies. The narrative
therefore stays on the design and the reasons for it.

The text of the book carries no tracking numbers. Each decision and each
chapter has a short, clear name instead. A name tells you what a
decision is about without a lookup. The numbers live in the
[intermediate representations](https://github.com/majodali/methodology/blob/v1.6.0/docs/vocabulary.md#def-intermediate-representation)
and in the project's registers.

<!-- render map: C1→¶1 C2→¶1 C3→¶2 C4→¶2 C5→¶2 C6→¶2 C7→¶3 C8→¶3 C9→¶3 C10→¶4 C11→¶4 C12→¶4 C62→¶4 C13→¶5 C14→¶5 C15→¶5 C63→¶5 C16→¶6 C17→¶6 C18→¶6 C64→¶6 C19→¶7 C20→¶7 C21→¶7 C22→¶8 C23→¶8 C24→¶8 C25→¶8 C26→¶8 C27→¶8 C28→¶8 C29→¶9 C30→¶9 C31→¶10 C32→¶10 C65→¶10 C33→¶10 C34→¶11 C35→¶11 C36→¶11 C37→¶11 C38→¶12 C39→¶12 C40→¶12 C41→¶12 C42→¶13 C43→¶13 C44→¶14 C45→¶14 C46→¶14 C47→¶14 C48→¶15 C49→¶15 C50→¶16 C51→¶16 C52→¶16 C53→¶16 C54→¶16 C55→¶17 C56→¶17 C57→¶17 C58→¶18 C66→¶18 C59→¶19 C60→¶19 C67→¶19 C61→¶19 -->
