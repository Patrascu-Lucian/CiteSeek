# What the model does with the questions the floor lets through

Two sets of unanswerable questions. The golden set's are the ones its floor
table counts. Each uncovered question names something one document is about
and asks for a detail it does not cover, so that set samples the hard region
on purpose and its rate is not the product's.

| set | clear the shipped floor | carrying a marker | rendered as a link | unlinked by its form |
| --- | ----------------------- | ----------------- | ------------------ | -------------------- |
| golden | 5 of 10 | 4, 1, 3 of 5 | 0, 0, 0 of 5 | 4, 1, 3 of 5 |
| uncovered | 15 of 15 | 8, 11, 9 of 15 | 0, 0, 1 of 15 | 8, 11, 8 of 15 |

Per run. A reply that opens in the declining form links none of its markers
(ADR 058), so "rendered as a link" is what a reader can still click on a
refusal: replies that declined in some other wording. Whether an unlinked
marker pointed at something relevant is read from the answers below, not
counted here.

Rule 4 of the system prompt forbids attaching a marker to a refusal, so a
marker on a refusal is the prompt broken by its own definition. Answers are
verbatim, because whether a reply refused at all is read rather than
matched: a regex over refusal wording would measure the regex. The model
runs with the chat route's tools and step limit.

## Run 1 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that defeating the guard interlock voids the warranty and the machine's CE marking [7].

## Run 1 — golden — Is there parking included?

Cited: true
Linked on the page: false

The documents do not cover whether parking is included; they cover pets, subletting, and guests [1][2].

## Run 1 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover repair times, emergencies such as loss of heat or water, tenant-arranged emergency repairs, and property maintenance responsibilities.

## Run 1 — golden — How many people work in the support team?

Cited: true
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, data handling, and plan renewal and cancellation policies [1][2][3][4][5][6][7][8].

## Run 1 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual for the Harbourline HL-90 Bench Press, including safety, hydraulic oil requirements, storage and transport, fault codes, and die changes [1][2][3][4][5][6].

## Run 1 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover the resolution target for a Severity 1 ticket; they cover first response targets (30 minutes for Severity 1) and note that resolution targets are deliberately non-contractual for Severity 3 and 4, but do not specify a numeric resolution target for Severity 1 or 2 [1][4].

## Run 1 — uncovered — How much does a Premier plan cost each month?

Cited: false
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal terms for support plans.

## Run 1 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they only cover escalation rules, ticket ownership, and severity handling procedures [1][2].

## Run 1 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 1 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, ticket escalation, service credits, data handling during support, and plan renewals.

## Run 1 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 1 — uncovered — What voltage does the press need?

Cited: false
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover safety, hydraulic oil, daily checks, die changes, fault codes, and storage and transport.

## Run 1 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety guidelines, hydraulic oil specifications, die changes, daily checks, and fault codes.

## Run 1 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover sensor calibration; they cover oil and filter change intervals [4], daily operational checks [2], die maintenance [5], fault codes [1][6], storage and transport [1], and hydraulic oil specifications [4].

## Run 1 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that the exposed rod should be coated in a corrosion inhibitor for storage over three months [1].

## Run 1 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees; they cover rent payment methods (monthly in advance by standing order), rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 1 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 1 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, and guests.

## Run 1 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, installations, heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 1 — uncovered — Is the property let furnished?

Cited: false
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting and guests, and pets.

## Run 2 — golden — What is the warranty period on the hydraulic pump?

Cited: false
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons, that the press uses ISO VG 46 mineral oil, and that defeating the guard interlock voids the warranty and the machine's CE marking.

## Run 2 — golden — Is there parking included?

Cited: true
Linked on the page: false

The documents do not cover parking; they cover tenancy terms including pets, subletting, and guests [1][2].

## Run 2 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover maintenance responsibilities, repair timelines, emergency definitions, tenant repair arrangements, and property access.

## Run 2 — golden — How many people work in the support team?

Cited: false
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plan policies, response and resolution targets, coverage hours, escalation rules, credits, data handling, and plan renewal and cancellation.

## Run 2 — golden — Does the press come in a wider bed size?

Cited: false
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual for the Harbourline HL-90 Bench Press, including safety guidelines, hydraulic oil specifications, fault codes, storage, and die changes.

## Run 2 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover the resolution target for a Severity 1 ticket; they only cover first response targets (30 minutes for Severity 1) [1], triage definitions [4], escalation procedures [3][5], coverage hours [2], credits [6], data handling [7], and plan renewals [8].

## Run 2 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only cover service credits for missed response targets, coverage hours, renewal terms, and plan downgrades [1][2][3].

## Run 2 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, ownership of escalated tickets, and how severity levels are handled [1][2].

## Run 2 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term (they only specify that downgrading from Premier to Standard takes effect at renewal and never mid-term) [1].

## Run 2 — uncovered — In which languages do support engineers answer tickets?

Cited: true
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation, credits, data handling, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 2 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 2 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover safety, hydraulic oil, storage and transport, die changes, fault codes, and daily checks for the Harbourline HL-90 Bench Press [1][2][3][4][5][6][7].

## Run 2 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety guidelines, hydraulic oil specifications, die changes, daily checks, and fault codes.

## Run 2 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover the calibration frequency for pressure sensors; they cover daily checks, oil and filter change intervals, die bolt torque specifications, storage and transport procedures, fault codes (E01, E02, E04, E07), and operating temperature limits [1][2][4][5][6].

## Run 2 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 2 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees for rent; they cover rent payment methods, rent review terms, deposit rules, repairs, access, ending the tenancy, subletting and guests, and pets [1][2][3][4][5][6].

## Run 2 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 2 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they cover pets, subletting, and guests.

## Run 2 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities for the structure, exterior, installations, heating system, internal decoration, light bulbs, smoke alarm batteries, and drains and gutters [1][2].

## Run 2 — uncovered — Is the property let furnished?

Cited: false
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 3 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that defeating the guard interlock voids the warranty [7], but do not specify the duration of the warranty.

## Run 3 — golden — Is there parking included?

Cited: false
Linked on the page: false

The documents do not cover parking.

## Run 3 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover maintenance responsibilities, emergency and non-emergency repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 3 — golden — How many people work in the support team?

Cited: true
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation, credits, data handling, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 3 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false

The documents do not cover bed sizes for the press; they cover the operating manual, safety guidelines, hydraulic oil specifications, fault codes, and die change procedures for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 3 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: true

The documents do not specify a resolution target for a Severity 1 ticket; they only cover first response targets (30 minutes for Severity 1) [1] and mention that resolution targets are deliberately non-contractual for Severity 3 and 4 [1].

## Run 3 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, service credits, coverage hours, and renewal terms for support plans [1][2][3].

## Run 3 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, ownership of escalated tickets, and how severity levels are handled [1][2].

## Run 3 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term (they only specify that downgrading from Premier to Standard takes effect at renewal and never mid-term) [1].

## Run 3 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation procedures, credits, data handling during support, and plan renewals and cancellations.

## Run 3 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 3 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false

The documents do not cover the electrical voltage required by the press. They do cover the operating manual, safety instructions, hydraulic oil requirements, die changes, daily checks, and fault codes for the Harbourline HL-90 Bench Press [1][2][3][4][5][6][7].

## Run 3 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety rules, hydraulic oil requirements, die changes, daily checks, and fault codes.

## Run 3 — uncovered — How often should the pressure sensors be calibrated?

Cited: false
Linked on the page: false

The documents do not cover how often pressure sensors should be calibrated, though they do cover other maintenance items such as changing the hydraulic oil and filter every 2,000 operating hours or annually.

## Run 3 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state to coat the exposed rod in a corrosion inhibitor for storage over three months [1].

## Run 3 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees for rent; they cover rent payment methods, the rent review process, deposits, repairs, access, ending the tenancy, subletting and guests, and pets [1][2][3][4][5][6].

## Run 3 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 3 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, and guests.

## Run 3 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities for the structure, exterior, installations (water, gas, electricity, sanitation), heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 3 — uncovered — Is the property let furnished?

Cited: false
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.
