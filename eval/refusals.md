# What the model does with the questions the floor lets through

Three sets of unanswerable questions. The golden set's are the ones its floor
table counts. Each uncovered question names something one document is about
and asks for a detail it does not cover, so that set samples the hard region
on purpose and its rate is not the product's. The adjacent set has the same
shape, asked of the demo handbook alone, as a guest's workspace holds it.

| set | clear the shipped floor | carrying a marker | rendered as a link | unlinked by its form |
| --- | ----------------------- | ----------------- | ------------------ | -------------------- |
| golden | 5 of 10 | 3, 3, 2 of 5 | 0, 0, 0 of 5 | 3, 3, 2 of 5 |
| uncovered | 15 of 15 | 12, 12, 11 of 15 | 0, 0, 0 of 15 | 12, 12, 11 of 15 |
| adjacent | 10 of 10 | 8, 7, 9 of 10 | 1, 0, 1 of 10 | 7, 7, 8 of 10 |

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

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons and that defeating the guard interlock voids the warranty [7], but they do not state the duration or terms of the warranty itself.

## Run 1 — golden — Is there parking included?

Cited: false
Linked on the page: false

The documents do not cover whether parking is included; they cover tenancy agreement terms regarding pets, subletting, and guests.

## Run 1 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover repair times, emergencies such as loss of heat or water, tenant-arranged emergency repairs, and property maintenance responsibilities.

## Run 1 — golden — How many people work in the support team?

Cited: true
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, and data handling procedures [1][2][3][4][5][6][7][8].

## Run 1 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual, safety, hydraulic oil, storage and transport, die changes, and fault codes for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 1 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover the resolution target for a Severity 1 ticket; they cover first response targets (30 minutes for Severity 1) and resolution targets for other severities or general defect scheduling, but do not state a specific resolution time frame for Severity 1 [1][4].

## Run 1 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal terms for support plans [1][2][3].

## Run 1 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they only cover escalation rules, ticket ownership, and severity handling procedures [1][2].

## Run 1 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded mid-term. They do cover that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 1 — uncovered — In which languages do support engineers answer tickets?

Cited: true
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation, credits, data handling, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 1 — uncovered — What does fault code E03 indicate?

Cited: true
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes, indicating low oil level (E01), that the guard interlock is open (E02), over-temperature (E04), and a pressure sensor disagreement (E07) [1][2].

## Run 1 — uncovered — What voltage does the press need?

Cited: false
Linked on the page: false

The documents do not cover the electrical voltage required by the press; they cover safety, operating instructions, hydraulic oil specifications, die changes, daily checks, fault codes, and storage and transport.

## Run 1 — uncovered — How much does the press weigh?

Cited: true
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating force (90 kilonewtons), noise level (84 dB at one metre), oil temperature limits, and other operating and maintenance specifications [1][4].

## Run 1 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover how often pressure sensors should be calibrated, though they do mention that fault code E07 indicates a pressure sensor disagreement where the two sensors differ by more than 5 bar [1].

## Run 1 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 1 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees for rent; they cover rent payment methods, the timing of rent payments, and rent reviews [1][2].

## Run 1 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 1 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they cover pets, subletting, and guests.

## Run 1 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, installations, heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 1 — uncovered — Is the property let furnished?

Cited: false
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 1 — adjacent — What is the warranty on the company laptop?

Cited: true
Linked on the page: true

The documents do not mention a warranty on company laptops; they state that equipment failing within the three-year period is replaced rather than repaired [3].

## Run 1 — adjacent — How much notice do I need to give for unpaid leave?

Cited: true
Linked on the page: false

The documents do not cover unpaid leave; they cover annual leave, sick leave, public holidays, travel policies, and data handling [1][2][3].

## Run 1 — adjacent — Does the company pay toward home internet costs?

Cited: true
Linked on the page: false

The documents do not cover home internet costs; they cover equipment such as laptops, external monitors, and desk chairs [1], as well as peripherals, software licenses, and co-working space expenses [2][3].

## Run 1 — adjacent — What is the mileage rate for driving to a company office?

Cited: false
Linked on the page: false

The documents do not cover the mileage rate for driving to a company office; they cover travel booking, rail and flight rules, hotel caps, and travel during working hours.

## Run 1 — adjacent — How many days of paternity leave do employees get?

Cited: false
Linked on the page: false

The documents do not cover paternity leave; they cover remote work policies including time off (annual leave and sick leave), public holidays, and travel.

## Run 1 — adjacent — Which laptop brand is issued to remote employees?

Cited: true
Linked on the page: false

The documents do not cover which laptop brand is issued to remote employees; they only state that every remote employee receives a choice between a 14-inch and a 16-inch laptop [2].

## Run 1 — adjacent — What is the daily meal allowance when travelling?

Cited: true
Linked on the page: false

The documents do not cover the daily meal allowance when travelling; they cover travel booking methods, expense reimbursement rules, hotel caps, and transit guidelines [1][2][3].

## Run 1 — adjacent — Is unused annual leave paid out when I leave the company?

Cited: true
Linked on the page: false

The documents do not cover whether unused annual leave is paid out when leaving the company; they only state that annual leave is 28 days plus public holidays and that unused leave does not carry over [1].

## Run 1 — adjacent — How many sick days can I take in a year?

Cited: true
Linked on the page: false

The documents do not cover a specific annual limit on sick days; they only state that sick leave is not counted against annual leave and does not require a medical certificate for absences of seven days or fewer [1].

## Run 1 — adjacent — Can I open company documents on public Wi-Fi?

Cited: true
Linked on the page: false

The documents do not cover whether company documents can be opened on public Wi-Fi. They do cover data handling, including restrictions on uploading company documents to unapproved third-party services, requirements for full-disk encryption on laptops, and rules that restricted documents may not leave company-managed devices [1][2][3].

## Run 2 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons, and that defeating the guard interlock voids the warranty [7], but they do not state the duration or terms of the warranty.

## Run 2 — golden — Is there parking included?

Cited: true
Linked on the page: false

The documents do not cover parking; they cover tenancy agreement terms regarding pets, subletting, guests, and deposits [1][2].

## Run 2 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover maintenance responsibilities, repair timeframes, emergency repair procedures, and access.

## Run 2 — golden — How many people work in the support team?

Cited: false
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, credits, data handling during support, and ending a support plan.

## Run 2 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual, safety, hydraulic oil, storage and transport, fault codes, die changes, and daily checks for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 2 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover the resolution target for a Severity 1 ticket; they cover response targets for all severities (30 minutes for Severity 1, two hours for Severity 2, one business day for Severity 3, and three business days for Severity 4) [1] and mention that resolution targets are non-contractual for Severity 3 and 4 [1].

## Run 2 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only cover service credits for missed response targets [1], coverage hours [3], and plan renewal and downgrading [2].

## Run 2 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, ownership of escalated tickets by the duty lead, and how severity levels are handled [1][2].

## Run 2 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term. They do cover downgrading from Premier to Standard, stating that it takes effect at renewal and never mid-term [1].

## Run 2 — uncovered — In which languages do support engineers answer tickets?

Cited: true
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation, credits, data handling during support, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 2 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 2 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover safety, operating instructions, hydraulic oil maintenance, die changes, daily checks, fault codes, and storage and transport for the Harbourline HL-90 Bench Press [1][2][3][4][5][6][7].

## Run 2 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety instructions, hydraulic oil requirements, storage and transport, die changes, daily checks, and fault codes.

## Run 2 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover how often pressure sensors should be calibrated, though they do mention that fault code E07 indicates a pressure sensor disagreement where the two sensors differ by more than 5 bar [1].

## Run 2 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 2 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees for rent; they cover rent payment methods, review frequency and caps, deposit terms, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 2 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 2 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, and guests.

## Run 2 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, water, gas, electricity, sanitation, heating system, internal decoration, light bulbs, smoke alarm batteries, and drains and gutters [1][2].

## Run 2 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting and guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].

## Run 2 — adjacent — What is the warranty on the company laptop?

Cited: true
Linked on the page: false

The documents do not cover a laptop warranty; they cover equipment failure by stating that equipment failing within the three-year period is replaced rather than repaired [3].

## Run 2 — adjacent — How much notice do I need to give for unpaid leave?

Cited: false
Linked on the page: false

The documents do not cover unpaid leave; they cover annual leave, sick leave, public holidays, travel policies, and data handling rules.

## Run 2 — adjacent — Does the company pay toward home internet costs?

Cited: true
Linked on the page: false

The documents do not cover home internet costs; they cover equipment, software licenses, co-working space, travel, annual leave, and sick leave [3][4][5].

## Run 2 — adjacent — What is the mileage rate for driving to a company office?

Cited: false
Linked on the page: false

The documents do not cover mileage rates for driving to a company office; they cover travel bookings, rail defaults, flight classes, hotel caps, and travel during working hours.

## Run 2 — adjacent — How many days of paternity leave do employees get?

Cited: false
Linked on the page: false

The documents do not cover paternity leave; they cover remote work policies including annual leave, sick leave, public holidays, and travel.

## Run 2 — adjacent — Which laptop brand is issued to remote employees?

Cited: true
Linked on the page: false

The documents do not cover which laptop brand is issued to remote employees; they only state that every remote employee receives a laptop (with a choice between a 14-inch and a 16-inch model) [1][2].

## Run 2 — adjacent — What is the daily meal allowance when travelling?

Cited: true
Linked on the page: false

The documents do not cover the daily meal allowance when travelling; they cover travel booking methods, expense reimbursement rules, hotel caps, and flight/rail guidelines [1][2][3].

## Run 2 — adjacent — Is unused annual leave paid out when I leave the company?

Cited: true
Linked on the page: false

The documents do not cover whether unused annual leave is paid out when leaving the company. They do state that annual leave is 28 days plus public holidays and that unused leave does not carry over [1].

## Run 2 — adjacent — How many sick days can I take in a year?

Cited: true
Linked on the page: false

The documents do not cover the annual limit for sick days, but they do state that sick leave is not counted against annual leave and does not require a medical certificate for absences of seven days or fewer [1].

## Run 2 — adjacent — Can I open company documents on public Wi-Fi?

Cited: true
Linked on the page: false

The documents do not cover whether company documents can be opened on public Wi-Fi. They do cover data handling rules regarding company documents, laptop full-disk encryption, and restrictions on uploading documents to unapproved third-party services [1][2][3].

## Run 3 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons [7], detail hydraulic oil specifications, intervals, and fault codes [1][2][3][4][5], and outline support policies regarding data handling and screen sharing [8].

## Run 3 — golden — Is there parking included?

Cited: false
Linked on the page: false

The documents do not cover parking.

## Run 3 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 3 — golden — How many people work in the support team?

Cited: true
Linked on the page: false

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, service credits, and data handling procedures [1][2][3][4][5][6][7][8].

## Run 3 — golden — Does the press come in a wider bed size?

Cited: false
Linked on the page: false

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual for the Harbourline HL-90 Bench Press, including safety, hydraulic oil, storage and transport, fault codes, die changes, and daily checks.

## Run 3 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false

The documents do not cover the resolution target for a Severity 1 ticket; they only cover first response targets (30 minutes for Severity 1) [1], triage definitions [4], coverage hours [2], escalation rules [3][5], credits [6], data handling [7], and plan renewals/cancellations [8].

## Run 3 — uncovered — How much does a Premier plan cost each month?

Cited: false
Linked on the page: false

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal terms for support plans.

## Run 3 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false

The documents do not cover the phone number for the duty lead; they only cover escalation rules, ticket ownership, and severity handling procedures [1][2].

## Run 3 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term. They do cover downgrading from Premier to Standard, which takes effect at renewal and never mid-term [1].

## Run 3 — uncovered — In which languages do support engineers answer tickets?

Cited: true
Linked on the page: false

The documents do not cover the languages in which support engineers answer tickets; they cover support plan coverage hours, escalation procedures, response and resolution targets, service credits, data handling during support, and support plan renewals and cancellations [1][2][3][4][5][6][7][8].

## Run 3 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 3 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false

The documents do not cover the voltage requirements for the press; they cover the Harbourline HL-90 Bench Press operating manual, including safety, hydraulic oil specifications, die changes, fault codes, and daily checks [1][2][3][4][5][6][7].

## Run 3 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false

The documents do not cover the weight of the press; they cover its operating manual, safety rules, hydraulic oil specifications, die changes, daily checks, and fault codes.

## Run 3 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false

The documents do not cover how often pressure sensors should be calibrated, though they do mention that fault code E07 indicates a pressure sensor disagreement where the two sensors differ by more than 5 bar [1].

## Run 3 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false

The documents do not cover which specific corrosion inhibitor is approved; they only state to coat the exposed rod in a corrosion inhibitor for storage over three months [1].

## Run 3 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false

The documents do not cover late payment fees for rent; they cover rent payment methods, the timing of rent payments, and annual rent reviews [1][2].

## Run 3 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 3 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, guests, and tenancy notifications.

## Run 3 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, water, gas, electricity, sanitation, heating system, internal decoration, light bulbs, smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 3 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting and guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].

## Run 3 — adjacent — What is the warranty on the company laptop?

Cited: true
Linked on the page: true

The documents do not mention a warranty on the company laptop, but they do state that equipment which fails within the three-year period is replaced rather than repaired [3].

## Run 3 — adjacent — How much notice do I need to give for unpaid leave?

Cited: true
Linked on the page: false

The documents do not cover unpaid leave; they cover annual leave, sick leave, public holidays, travel, and data handling [1][2][3].

## Run 3 — adjacent — Does the company pay toward home internet costs?

Cited: true
Linked on the page: false

The documents do not cover home internet costs; they cover equipment such as laptops, external monitors, and desk chairs [1], as well as reimbursement rules for software licenses, co-working space, and peripheral expenses like a second monitor, standing desk, or ergonomic keyboard [2][3].

## Run 3 — adjacent — What is the mileage rate for driving to a company office?

Cited: true
Linked on the page: false

The documents do not cover the mileage rate for driving to a company office; they cover travel bookings, expenses, rail and flight rules, and hotel caps [1][2].

## Run 3 — adjacent — How many days of paternity leave do employees get?

Cited: false
Linked on the page: false

The documents do not cover paternity leave; they cover remote work policies including time off (annual leave and sick leave), public holidays, and travel.

## Run 3 — adjacent — Which laptop brand is issued to remote employees?

Cited: true
Linked on the page: false

The documents do not cover which laptop brand is issued to remote employees; they only state that every remote employee receives a laptop (with a choice between a 14-inch and a 16-inch model) along with an external monitor and a desk chair [2].

## Run 3 — adjacent — What is the daily meal allowance when travelling?

Cited: true
Linked on the page: false

The documents do not cover the daily meal allowance when travelling; they cover travel booking methods, transportation modes, flight cabin classes, hotel price caps, and expense reimbursement rules such as receipt requirements and payroll cut-off dates [1][2][3].

## Run 3 — adjacent — Is unused annual leave paid out when I leave the company?

Cited: true
Linked on the page: false

The documents do not cover whether unused annual leave is paid out when leaving the company; they only state that annual leave is 28 days plus public holidays and unused leave does not carry over [1].

## Run 3 — adjacent — How many sick days can I take in a year?

Cited: true
Linked on the page: false

The documents do not cover a specific annual limit on sick days; they only state that sick leave is not counted against annual leave and does not require a medical certificate for absences of seven days or fewer [1].

## Run 3 — adjacent — Can I open company documents on public Wi-Fi?

Cited: true
Linked on the page: false

The documents do not cover whether company documents can be opened on public Wi-Fi. They do cover data handling, including restrictions on uploading company documents to unapproved third-party services, and requirements for full-disk encryption on laptops [1][3].
