# What the model does with the questions the floor lets through

Two sets of unanswerable questions. The golden set's are the ones its floor
table counts. Each uncovered question names something one document is about
and asks for a detail it does not cover, so that set samples the hard region
on purpose and its rate is not the product's.

| set | clear the shipped floor | replies carrying a marker, per run |
| --- | ----------------------- | ---------------------------------- |
| golden | 5 of 10 | 2, 2, 2 of 5 |
| uncovered | 15 of 15 | 11, 9, 9 of 15 |

Rule 4 of the system prompt forbids attaching a marker to a refusal, so a
marker on a refusal is the prompt broken by its own definition. Answers are
verbatim, because whether a reply refused at all is read rather than
matched: a regex over refusal wording would measure the regex. The model
runs with the chat route's tools and step limit.

## Run 1 — golden — What is the warranty period on the hydraulic pump?

Cited: true

The documents do not cover the warranty period on the hydraulic pump; they only mention that defeating the guard interlock voids the warranty for the press [7].

## Run 1 — golden — Is there parking included?

Cited: false

The documents do not cover parking.

## Run 1 — golden — What are the fire evacuation arrangements?

Cited: false

The documents do not cover fire evacuation arrangements; they cover maintenance and repair responsibilities, including emergency repairs, non-emergency repairs, and tenant-arranged emergency repairs.

## Run 1 — golden — How many people work in the support team?

Cited: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling during support, and plan renewals and downgrades.

## Run 1 — golden — Does the press come in a wider bed size?

Cited: true

The documents do not cover whether the press comes in a wider bed size; they cover the Harbourline HL-90 Bench Press (serial range 4400–5200), detailing its safety requirements, hydraulic oil specifications, fault codes, die change procedures, storage, transport, and daily checks [1][2][3][4][5][6].

## Run 1 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true

The documents do not cover resolution targets for Severity 1 tickets; they only specify first response targets (30 minutes) and resolution targets for other severities or general release schedules for defects with workarounds [1][4].

## Run 1 — uncovered — How much does a Premier plan cost each month?

Cited: true

The documents do not cover the monthly cost of a Premier plan; they only mention that Premier plans include continuous coverage, service credits for missing a first response target, and annual renewal terms [1][2][3].

## Run 1 — uncovered — What is the phone number for the duty lead?

Cited: false

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, severity handling, and support plan clocks.

## Run 1 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 1 — uncovered — In which languages do support engineers answer tickets?

Cited: true

The documents do not cover the languages in which support engineers answer tickets. They cover support plan coverage hours, escalation procedures, response and resolution targets, service credits, data handling, and plan renewals and cancellations [1][2][3][4][5][6][7][8].

## Run 1 — uncovered — What does fault code E03 indicate?

Cited: true

The documents do not cover fault code E03; they only cover fault codes E01, E02, E04, and E07 [1][2].

## Run 1 — uncovered — What voltage does the press need?

Cited: false

The documents do not cover the electrical voltage required by the press.

## Run 1 — uncovered — How much does the press weigh?

Cited: false

The documents do not cover the weight of the press.

## Run 1 — uncovered — How often should the pressure sensors be calibrated?

Cited: true

The documents do not cover how often pressure sensors should be calibrated, though they do mention that E07 indicates a pressure sensor disagreement where the two sensors differ by more than 5 bar [1].

## Run 1 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true

The documents do not specify which corrosion inhibitor is approved; they only state that the exposed rod should be coated in a corrosion inhibitor for storage over three months [1].

## Run 1 — uncovered — What is the late payment fee for rent?

Cited: true

The documents do not cover late payment fees for rent; they cover rent payment methods, review frequency, caps, and notice requirements [1][2].

## Run 1 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true

The documents do not cover who is responsible for council tax. They do cover repairs and maintenance responsibilities, stating that the landlord is responsible for the structure, exterior, installations for water, gas, electricity, sanitation, and the heating system, while the tenant is responsible for internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1].

## Run 1 — uncovered — Is smoking allowed in the property?

Cited: true

The documents do not cover whether smoking is allowed in the property. They do cover subletting, guests, and pets [1][2].

## Run 1 — uncovered — Who is responsible for maintaining the garden?

Cited: true

The documents do not cover who is responsible for maintaining the garden; they cover the responsibilities of the landlord (structure, exterior, water, gas, electricity, sanitation installations, and the heating system) and the tenant (internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible) [2].

## Run 1 — uncovered — Is the property let furnished?

Cited: false

The documents do not cover whether the property is let furnished; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 2 — golden — What is the warranty period on the hydraulic pump?

Cited: true

The documents do not cover the warranty period on the hydraulic pump; they only mention that defeating the guard interlock voids the warranty [7].

## Run 2 — golden — Is there parking included?

Cited: false

The documents do not cover parking.

## Run 2 — golden — What are the fire evacuation arrangements?

Cited: false

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 2 — golden — How many people work in the support team?

Cited: true

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling during support, and plan cancellation policies [1][2][3][4][5][6][7][8].

## Run 2 — golden — Does the press come in a wider bed size?

Cited: false

The documents do not cover whether the press comes in a wider bed size. They cover the operation, safety, hydraulic oil, fault codes, storage, transport, and die changes for the Harbourline HL-90 Bench Press.

## Run 2 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true

The documents do not cover resolution targets for Severity 1 tickets; they only specify first response targets (30 minutes) and resolution targets for Severity 3 and 4 (which are deliberately not contractual) [1][4].

## Run 2 — uncovered — How much does a Premier plan cost each month?

Cited: true

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal and cancellation terms for support plans [1][2][3].

## Run 2 — uncovered — What is the phone number for the duty lead?

Cited: false

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, severity handling, and support plan clocks.

## Run 2 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 2 — uncovered — In which languages do support engineers answer tickets?

Cited: false

The documents do not cover the languages in which support engineers answer tickets. They cover support plans, coverage hours, ticket severities, response and resolution targets, escalation, service credits, data handling, and plan renewals.

## Run 2 — uncovered — What does fault code E03 indicate?

Cited: true

The documents do not cover fault code E03; they only cover fault codes E01, E02, E04, and E07 [1][2].

## Run 2 — uncovered — What voltage does the press need?

Cited: false

The documents do not cover the electrical voltage required by the press; they cover safety requirements, hydraulic oil specifications, die changes, daily checks, fault codes, and storage and transport.

## Run 2 — uncovered — How much does the press weigh?

Cited: false

The documents do not cover the weight of the press.

## Run 2 — uncovered — How often should the pressure sensors be calibrated?

Cited: false

The documents do not cover how often pressure sensors should be calibrated; they cover error codes such as E07 for pressure sensor disagreement, daily checks, hydraulic oil requirements, die changes, and other fault codes.

## Run 2 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 2 — uncovered — What is the late payment fee for rent?

Cited: true

The documents do not cover late payment fees for rent; they cover rent payment methods, reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 2 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true

The documents do not cover who is responsible for council tax. They do cover repairs and maintenance responsibilities: the landlord is responsible for the structure and exterior, water, gas, electricity, sanitation installations, and the heating system, while the tenant is responsible for internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1].

## Run 2 — uncovered — Is smoking allowed in the property?

Cited: true

The documents do not cover whether smoking is allowed in the property. They do cover subletting and guests, and pets [1][2].

## Run 2 — uncovered — Who is responsible for maintaining the garden?

Cited: true

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure and exterior, installations for water, gas, electricity and sanitation, the heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 2 — uncovered — Is the property let furnished?

Cited: false

The documents do not cover whether the property is let furnished; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 3 — golden — What is the warranty period on the hydraulic pump?

Cited: true

The documents do not cover the warranty period on the hydraulic pump; they mention only that defeating the guard interlock voids the machine's warranty [7].

## Run 3 — golden — Is there parking included?

Cited: false

The documents do not cover whether parking is included; they cover tenancy terms such as subletting, guests, and pets.

## Run 3 — golden — What are the fire evacuation arrangements?

Cited: false

The documents do not cover fire evacuation arrangements; they cover maintenance and repair responsibilities, including emergency repairs, non-emergency repairs, tenant-arranged repairs, and property access.

## Run 3 — golden — How many people work in the support team?

Cited: false

The documents do not cover the number of people who work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling during support, and plan termination.

## Run 3 — golden — Does the press come in a wider bed size?

Cited: true

The documents do not cover whether the press comes in a wider bed size. They cover the Harbourline HL-90 Bench Press (serial range 4400–5200), including safety, hydraulic oil requirements, fault codes, storage, transport, die changes, and daily checks [1][2][3][4][5][6].

## Run 3 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true

The documents do not cover resolution targets for Severity 1 tickets; they only specify first response targets (30 minutes) and resolution targets for other severities or defect categories [1][4].

## Run 3 — uncovered — How much does a Premier plan cost each month?

Cited: true

The documents do not cover the monthly cost of a Premier plan. They only cover service credits for missed targets, renewal and cancellation terms, coverage hours, and ticket escalation rules [1][2][3][4].

## Run 3 — uncovered — What is the phone number for the duty lead?

Cited: false

The documents do not cover the phone number for the duty lead. They cover ticket escalation rules, such as how tickets can be escalated and who owns them after escalation.

## Run 3 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 3 — uncovered — In which languages do support engineers answer tickets?

Cited: true

The documents do not cover the languages in which support engineers answer tickets. They cover support plans, coverage hours, ticket severities, response and resolution targets, escalation, credits, data handling during support, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 3 — uncovered — What does fault code E03 indicate?

Cited: true

The documents do not cover fault code E03; they only cover fault codes E01, E02, E04, and E07 [1][2].

## Run 3 — uncovered — What voltage does the press need?

Cited: false

The documents do not cover the voltage requirements for the press; they cover safety, hydraulic oil, daily checks, fault codes, storage, transport, and die changes.

## Run 3 — uncovered — How much does the press weigh?

Cited: false

The documents do not cover the weight of the press.

## Run 3 — uncovered — How often should the pressure sensors be calibrated?

Cited: false

The documents do not cover how often pressure sensors should be calibrated; they cover error codes like E07 for pressure sensor disagreement, oil levels, hydraulic oil specifications, die changes, and daily checks.

## Run 3 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true

The documents do not cover which specific corrosion inhibitor is approved; they only state to coat the exposed rod in a corrosion inhibitor for storage over three months [1].

## Run 3 — uncovered — What is the late payment fee for rent?

Cited: true

The documents do not cover late payment fees for rent; they cover rent payment methods, reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 3 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: false

The documents do not cover council tax.

## Run 3 — uncovered — Is smoking allowed in the property?

Cited: true

The documents do not cover whether smoking is allowed in the property. They do cover subletting, guests, and pets [1][2].

## Run 3 — uncovered — Who is responsible for maintaining the garden?

Cited: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities for the structure, exterior, installations (water, gas, electricity, sanitation), heating system, internal decoration, light bulbs, smoke alarm batteries, and keeping drains and gutters accessible.

## Run 3 — uncovered — Is the property let furnished?

Cited: true

The documents do not cover whether the property is let furnished; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].
