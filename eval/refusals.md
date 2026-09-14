# What the model does with the questions the floor lets through

Two sets of unanswerable questions. The golden set's are the ones its floor
table counts. Each uncovered question names something one document is about
and asks for a detail it does not cover, so that set samples the hard region
on purpose and its rate is not the product's.

| set | clear the shipped floor | replies carrying a marker, per run |
| --- | ----------------------- | ---------------------------------- |
| golden | 5 of 10 | 2, 2, 2 of 5 |
| uncovered | 15 of 15 | 13, 11, 11 of 15 |

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

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 1 — golden — How many people work in the support team?

Cited: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling, and plan renewals and downgrades.

## Run 1 — golden — Does the press come in a wider bed size?

Cited: true

The documents do not cover whether the press comes in a wider bed size. They cover the Harbourline HL-90 Bench Press (serial range 4400–5200), including safety guidelines, hydraulic oil specifications, fault codes, die changes, storage, transport, and daily checks [1][2][3][4][5][6].

## Run 1 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true

The documents do not cover resolution targets for Severity 1 tickets; they only specify first response targets (30 minutes) and resolution targets for Severity 3 and 4 (which are deliberately not contractual and scheduled against the release train) [1].

## Run 1 — uncovered — How much does a Premier plan cost each month?

Cited: true

The documents do not cover the monthly cost of a Premier plan. They only cover service credits for missed response targets, coverage hours, and plan renewals and cancellations [1][2][3].

## Run 1 — uncovered — What is the phone number for the duty lead?

Cited: true

The documents do not cover the phone number for the duty lead. They cover ticket escalation rules, such as how tickets can be escalated and who owns them after escalation [1][2].

## Run 1 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 1 — uncovered — In which languages do support engineers answer tickets?

Cited: true

The documents do not cover the languages in which support engineers answer tickets. They cover support plans, coverage hours, ticket severities, response and resolution targets, escalation, credits, data handling during support, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 1 — uncovered — What does fault code E03 indicate?

Cited: true

The documents do not cover fault code E03; they only cover fault codes E01, E02, E04, and E07 [1][2].

## Run 1 — uncovered — What voltage does the press need?

Cited: true

The documents do not cover the electrical voltage required by the press. They do cover operating specifications such as the press development of 90 kilonewtons [2], hydraulic oil requirements [1], fault codes [6], and die change procedures [4].

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

The documents do not cover late payment fees for rent; they cover rent payment methods, reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 1 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true

The documents do not cover council tax. They do, however, cover repairs, rent, deposits, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 1 — uncovered — Is smoking allowed in the property?

Cited: true

The documents do not cover whether smoking is allowed in the property. They do cover subletting and guests, and pets [1][2].

## Run 1 — uncovered — Who is responsible for maintaining the garden?

Cited: true

The documents do not cover who is responsible for maintaining the garden; they cover repairs, including the landlord's responsibility for the structure, exterior, heating, and utility installations, and the tenant's responsibility for internal decoration, light bulbs, smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 1 — uncovered — Is the property let furnished?

Cited: false

The documents do not cover whether the property is let furnished; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 2 — golden — What is the warranty period on the hydraulic pump?

Cited: true

The documents do not cover the warranty period on the hydraulic pump. They do mention that defeating the guard interlock voids the warranty for the press [7].

## Run 2 — golden — Is there parking included?

Cited: false

The documents do not cover parking.

## Run 2 — golden — What are the fire evacuation arrangements?

Cited: false

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, and tenant-arranged emergency repairs.

## Run 2 — golden — How many people work in the support team?

Cited: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling during support, and plan renewals and downgrades.

## Run 2 — golden — Does the press come in a wider bed size?

Cited: true

The documents do not cover whether the press comes in a wider bed size; they cover the Harbourline HL-90 Bench Press (serial range 4400–5200), including safety requirements, hydraulic oil specifications, fault codes, die changes, and daily checks [1][2][3][4][5][6].

## Run 2 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true

The documents do not cover resolution targets for Severity 1 tickets; they only specify first response targets (30 minutes) and resolution targets for Severity 3 and 4 (which are deliberately not contractual) [1][4].

## Run 2 — uncovered — How much does a Premier plan cost each month?

Cited: true

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, service credits, coverage hours, and renewal terms for support plans [1][2][3].

## Run 2 — uncovered — What is the phone number for the duty lead?

Cited: false

The documents do not cover the phone number for the duty lead; they only cover ticket escalation rules, ownership of escalated tickets, and how escalations affect ticket severity and customer expectations.

## Run 2 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 2 — uncovered — In which languages do support engineers answer tickets?

Cited: false

The documents do not cover the languages in which support engineers answer tickets. They cover support plan coverage hours, escalation procedures, response and resolution targets, service credits, data handling during support, and plan renewals and downgrades.

## Run 2 — uncovered — What does fault code E03 indicate?

Cited: true

The documents do not cover fault code E03; they only cover fault codes E01, E02, E04, and E07 [1][2].

## Run 2 — uncovered — What voltage does the press need?

Cited: true

The documents do not cover the voltage requirements for the press; they cover the Harbourline HL-90 Bench Press's safety rules, hydraulic oil specifications, die changes, daily checks, fault codes, and storage and transport [1][2][3][4][5][6][7].

## Run 2 — uncovered — How much does the press weigh?

Cited: false

The documents do not cover the weight of the press.

## Run 2 — uncovered — How often should the pressure sensors be calibrated?

Cited: true

The documents do not cover how often pressure sensors should be calibrated, though they do mention that E07 indicates a pressure sensor disagreement where the two sensors differ by more than 5 bar [1].

## Run 2 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true

The documents do not cover which specific corrosion inhibitor is approved; they only state to coat the exposed rod in a corrosion inhibitor for storage over three months [1].

## Run 2 — uncovered — What is the late payment fee for rent?

Cited: true

The documents do not cover late payment fees for rent; they cover rent payment methods, review frequency, caps, and notice requirements [1][2].

## Run 2 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true

The documents do not cover council tax. They cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][5][6][7].

## Run 2 — uncovered — Is smoking allowed in the property?

Cited: true

The documents do not cover whether smoking is allowed in the property. They do cover subletting and guests [2], as well as pets [1].

## Run 2 — uncovered — Who is responsible for maintaining the garden?

Cited: true

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure and exterior, installations for water, gas, electricity and sanitation, the heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 2 — uncovered — Is the property let furnished?

Cited: false

The documents do not cover whether the property is let furnished; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 3 — golden — What is the warranty period on the hydraulic pump?

Cited: true

The documents do not cover the warranty period on the hydraulic pump; they mention that the warranty is voided if the guard interlock is defeated [7].

## Run 3 — golden — Is there parking included?

Cited: true

The documents do not cover parking. They do cover subletting and guests, and pets [1][2].

## Run 3 — golden — What are the fire evacuation arrangements?

Cited: false

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, and tenant-arranged emergency repairs.

## Run 3 — golden — How many people work in the support team?

Cited: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling, and plan renewal and cancellation policies.

## Run 3 — golden — Does the press come in a wider bed size?

Cited: false

The documents do not cover whether the press comes in a wider bed size; they cover the Harbourline HL-90 Bench Press (serial range 4400–5200), detailing its safety requirements, hydraulic oil specifications, fault codes, die change procedures, and operating instructions.

## Run 3 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true

The documents do not cover resolution targets for Severity 1 tickets; they only specify first response targets (30 minutes) and resolution targets for Severity 3 and 4 (which are deliberately not contractual and scheduled against the release train) [1].

## Run 3 — uncovered — How much does a Premier plan cost each month?

Cited: true

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal and cancellation terms for support plans [1][2][3].

## Run 3 — uncovered — What is the phone number for the duty lead?

Cited: true

The documents do not cover the phone number for the duty lead; they only cover ticket escalation rules, ownership, and behavior regarding Severity 1, 3, and 4 tickets [1][2].

## Run 3 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 3 — uncovered — In which languages do support engineers answer tickets?

Cited: true

The documents do not cover the languages in which support engineers answer tickets. They cover support plans, coverage hours, ticket severities, response and resolution targets, escalation, credits, data handling, and ending support plans [1][2][3][4][5][6][7][8].

## Run 3 — uncovered — What does fault code E03 indicate?

Cited: false

The documents do not cover fault code E03. They do cover other fault codes including E01 (low oil level), E02 (guard interlock open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 3 — uncovered — What voltage does the press need?

Cited: true

The documents do not cover the electrical voltage required by the press. They do cover operating specifications such as the press developing 90 kilonewtons [2], hydraulic oil requirements (ISO VG 46 mineral oil) [1], and various safety, maintenance, and fault code procedures.

## Run 3 — uncovered — How much does the press weigh?

Cited: false

The documents do not cover the weight of the press.

## Run 3 — uncovered — How often should the pressure sensors be calibrated?

Cited: false

The documents do not cover how often pressure sensors should be calibrated; they cover error codes related to pressure sensors (such as E07 for a sensor disagreement) and hydraulic oil/filter change intervals.

## Run 3 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 3 — uncovered — What is the late payment fee for rent?

Cited: true

The documents do not cover late payment fees for rent; they cover rent payment methods, the annual rent review, and other tenancy terms such as deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 3 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true

The documents do not cover council tax. They do cover repairs and maintenance responsibilities, such as structural and exterior repairs by the landlord and internal decoration, light bulbs, smoke alarm batteries, and keeping drains and gutters accessible by the tenant [1].

## Run 3 — uncovered — Is smoking allowed in the property?

Cited: true

The documents do not cover whether smoking is allowed in the property. They do cover subletting and guests [2], as well as pets [1][2].

## Run 3 — uncovered — Who is responsible for maintaining the garden?

Cited: true

The documents do not cover who is responsible for maintaining the garden; they cover tenant and landlord responsibilities for repairs such as the structure and exterior, water, gas, electricity, sanitation, heating, internal decoration, light bulbs, smoke alarm batteries, and drains and gutters [1][2].

## Run 3 — uncovered — Is the property let furnished?

Cited: false

The documents do not cover whether the property is let furnished; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.
