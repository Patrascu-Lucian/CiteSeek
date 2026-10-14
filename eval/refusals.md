# What the model does with the questions the floor lets through

Two sets of unanswerable questions. The golden set's are the ones its floor
table counts. Each uncovered question names something one document is about
and asks for a detail it does not cover, so that set samples the hard region
on purpose and its rate is not the product's.

| set | clear the shipped floor | carrying a marker | rendered as a link | unlinked by its form |
| --- | ----------------------- | ----------------- | ------------------ | -------------------- |
| golden | 5 of 10 | 1, 2, 2 of 5 | 0, 0, 0 of 5 | 1, 2, 2 of 5 |
| uncovered | 15 of 15 | 10, 11, 12 of 15 | 0, 0, 0 of 15 | 10, 11, 12 of 15 |

Per run, every column reading markers as the page does. A reply that opens
in a declining form the page recognizes links none of its markers (ADR 058),
so "rendered as a link" is what a reader can still click on a refusal:
replies that declined in a wording the page does not recognize. Whether an
unlinked marker pointed at something relevant is read from the answers
below, not counted here.

Rule 4 of the system prompt forbids attaching a marker to a refusal, so a
marker on a refusal is the prompt broken by its own definition. Answers are
verbatim, because whether a reply refused at all is read rather than
matched: a regex over refusal wording would measure the regex. The model
runs with the chat route's tools and step limit.

## Run 1 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that the Harbourline HL-90 Bench Press has a warranty that is voided if the guard interlock is defeated [7], but they do not provide warranty details for individual components.

## Run 1 — golden — Is there parking included?

Cited: false
Linked on the page: false

The documents do not cover parking; they cover tenancy agreement terms regarding pets, subletting, guests, and notifications.

## Run 1 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover maintenance responsibilities, repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 1 — golden — How many people work in the support team?

Cited: false
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling, and plan endings.

## Run 1 — golden — Does the press come in a wider bed size?

Cited: false
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the Harbourline HL-90 Bench Press specifications, safety, hydraulic oil requirements, die changes, and fault codes.

## Run 1 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover resolution targets for Severity 1 tickets; they only cover first response targets (30 minutes) and mention that resolution targets are deliberately non-contractual for Severity 3 and 4 [1][4].

## Run 1 — uncovered — How much does a Premier plan cost each month?

Cited: false
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal policies for support plans.

## Run 1 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, ownership of escalated tickets, and how severity levels are handled [1][2].

## Run 1 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term (they only specify that downgrading from Premier to Standard takes effect at renewal, never mid-term) [1].

## Run 1 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation, service credits, data handling during support, and ending a support plan.

## Run 1 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes, specifically E01 (low oil level), E02 (guard interlock open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 1 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover the Harbourline HL-90 Bench Press operating manual, including safety, hydraulic oil specifications, die changes, fault codes, daily checks, and storage and transport [1][2][3][4][5][6][7].

## Run 1 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety instructions, hydraulic oil requirements, storage and transport procedures, die changes, daily checks, and fault codes.

## Run 1 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover the calibration frequency for pressure sensors; they cover fault code E07 indicating a pressure sensor disagreement [1], and note that a gauge reading zero with the pump running indicates a failed sensor [2][3].

## Run 1 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that the exposed rod should be coated in a corrosion inhibitor for storage over three months [1].

## Run 1 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees; they cover rent payment methods, rent review terms, deposit rules, repairs, landlord access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 1 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [3][4][1][2][6][7].

## Run 1 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, and guests.

## Run 1 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, installations, heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 1 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting and guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].

## Run 2 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons [7], detail hydraulic oil specifications and maintenance intervals [1][2], and note that defeating the guard interlock voids the warranty [7], but they contain no information about the warranty duration for individual components like the pump.

## Run 2 — golden — Is there parking included?

Cited: false
Linked on the page: false

The documents do not cover parking; they cover tenancy terms including pets, subletting, and guests.

## Run 2 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 2 — golden — How many people work in the support team?

Cited: false
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, credits, data handling, and plan renewals.

## Run 2 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual, safety, hydraulic oil, storage and transport, fault codes, and die changes for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 2 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover resolution targets for Severity 1 tickets; they only cover first response targets (30 minutes for Severity 1) [1] and mention that resolution targets are not contractual for Severity 3 and 4 [1].

## Run 2 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal policies for the plans [1][2][3].

## Run 2 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they only cover escalation rules, ticket ownership, and severity handling procedures [1][2].

## Run 2 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term (they only mention that downgrading from Premier to Standard takes effect at renewal, never mid-term) [1].

## Run 2 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation, credits, data handling during support, and ending a support plan.

## Run 2 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 2 — uncovered — What voltage does the press need?

Cited: false
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover safety, hydraulic oil, storage and transport, die changes, fault codes, and daily checks.

## Run 2 — uncovered — How much does the press weigh?

Cited: true
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating force (90 kilonewtons), noise level (84 dB at one metre), oil specifications, and other operating and maintenance procedures [1][2][4].

## Run 2 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover sensor calibration; they cover oil and filter change intervals, daily checks, and fault codes including E07 for a pressure sensor disagreement [1][2][4][6].

## Run 2 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 2 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees for rent; they cover rent payment methods (monthly in advance by standing order), rent reviews, and the return of transfers arriving without a tenancy reference [1][2].

## Run 2 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 2 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, guests, and tenancy notifications.

## Run 2 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, installations for water, gas, electricity, sanitation, heating, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 2 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, landlord access, ending the tenancy, subletting, guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].

## Run 3 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons, that the press has a hydraulic oil and system with specific maintenance requirements, and that defeating the guard interlock voids the warranty and CE marking, but they do not state warranty terms for specific components [1][7].

## Run 3 — golden — Is there parking included?

Cited: false
Linked on the page: false

The documents do not cover parking.

## Run 3 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, and tenant access regarding repairs.

## Run 3 — golden — How many people work in the support team?

Cited: false
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling during support, and plan renewals and downgrades.

## Run 3 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual, safety guidelines, maintenance intervals, fault codes, and die change procedures for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 3 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover resolution targets for Severity 1 tickets; they only cover first response targets (which are 30 minutes) [1] and mention resolution targets for Severity 3 and 4 (which are deliberately not contractual) [1].

## Run 3 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credits, coverage hours, and renewal terms for support plans [1][2][3].

## Run 3 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they only cover escalation rules, ticket ownership, and severity handling procedures [1][2].

## Run 3 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term. They do cover downgrading from Premier to Standard, which only takes effect at renewal [1].

## Run 3 — uncovered — In which languages do support engineers answer tickets?

Cited: true
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, response and resolution targets, coverage hours, escalation, credits, data handling during support, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 3 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 3 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover the Harbourline HL-90 Bench Press's safety rules, hydraulic oil and filter maintenance, fault codes, die changes, daily checks, and storage and transport instructions [1][2][3][4][5][6][7].

## Run 3 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety rules, hydraulic oil requirements, die changes, daily checks, and fault codes.

## Run 3 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover the calibration frequency for pressure sensors; they cover fault code E07 indicating a pressure sensor disagreement [1], and note that a gauge reading zero with the pump running indicates a failed sensor [2][3].

## Run 3 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 3 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees; they cover rent payment methods (monthly in advance by standing order), rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 3 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [3][4][1][2][6][7].

## Run 3 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, guests, and tenancy notifications.

## Run 3 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, installations for water, gas, electricity, sanitation, heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 3 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting and guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].
